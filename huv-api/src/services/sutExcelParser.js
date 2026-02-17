// ============================================
// SUT EXCEL PARSER SERVICE
// ============================================
// SUT Excel dosyalarını parse etme ve validate etme
// HUV parser'a benzer ama SUT yapısına özel
// ============================================

const XLSX = require('xlsx');
const { fixTurkishEncoding } = require('../utils/turkishCharFix');
const { getPool, sql } = require('../config/database');

// ============================================
// Dosya adından tarihi çıkar
// ============================================
const extractDateFromFilename = (filename) => {
  try {
    const match = filename.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    return null;
  } catch (err) {
    return null;
  }
};

// ============================================
// Excel dosyasını oku ve parse et
// Başlık satırını otomatik bul
// ============================================
const parseSutExcel = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath, {
      type: 'buffer',
      codepage: 65001, // UTF-8
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Önce tüm satırları array olarak oku (başlık satırını bulmak için)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const allRows = [];
    
    // İlk 20 satırı kontrol et (başlık satırını bulmak için)
    const maxHeaderSearchRows = Math.min(20, range.e.r + 1);
    let headerRowIndex = 0;
    
    // Başlık satırını bul (SUT kolonlarını içeren satır)
    const sutColumnKeywords = ['sut', 'kod', 'işlem', 'puan', 'açıklama', 'ana', 'kategori', 'hiyerarşi'];
    
    for (let rowIndex = 0; rowIndex < maxHeaderSearchRows; rowIndex++) {
      const row = [];
      for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = worksheet[cellAddress];
        const value = cell ? (cell.v !== undefined ? cell.v : '') : '';
        row.push(value ? fixTurkishEncoding(value.toString().toLowerCase()) : '');
      }
      
      // Bu satırda SUT kolon anahtar kelimelerinden en az 2 tanesi var mı?
      const matchingKeywords = sutColumnKeywords.filter(keyword => 
        row.some(cellValue => cellValue.includes(keyword))
      );
      
      if (matchingKeywords.length >= 2) {
        headerRowIndex = rowIndex;
        break;
      }
    }
    
    // Başlık satırı bulunamadıysa ilk satırı kullan
    
    // Başlık satırını manuel oku
    const headerRow = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex });
      const cell = worksheet[cellAddress];
      const value = cell ? (cell.v !== undefined ? cell.v : '') : '';
      headerRow.push(value ? fixTurkishEncoding(value.toString()) : `__EMPTY_${colIndex}`);
    }
    
    // Veri satırlarını oku (başlık satırından sonraki satırlar)
    const dataRows = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex++) {
      const row = {};
      let hasData = false;
      
      for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = worksheet[cellAddress];
        // Puan kolonu için formatted text kullan (Türkçe format: 374,97)
        const headerName = headerRow[colIndex - range.s.c];
        const isPuanColumn = headerName && headerName.toLowerCase().includes('puan');
        
        let value;
        if (cell) {
          // cell.w genelde undefined olduğu için cell.v kullan (doğru değeri verir)
          value = cell.v !== undefined ? cell.v : null;
        } else {
          value = null;
        }
        
        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
          row[headerName] = value;
        } else {
          row[headerName] = null;
        }
      }
      
      // Boş satırları atla
      if (hasData) {
        dataRows.push(row);
      }
    }
    
    // Türkçe karakterleri düzelt
    const fixedData = dataRows.map(row => {
      const fixed = {};
      for (const key in row) {
        const value = row[key];
        if (typeof value === 'string') {
          fixed[key] = fixTurkishEncoding(value);
        } else {
          fixed[key] = value;
        }
      }
      return fixed;
    });
    
    return {
      success: true,
      data: fixedData,
      rowCount: fixedData.length,
      sheetName: sheetName,
      headerRowIndex: headerRowIndex + 1 // 1-based index
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// Türkçe tarih formatını parse et
// ============================================
// parseTurkishDate fonksiyonu kaldırıldı (kullanılmıyordu)

// ============================================
// Kolon isimlerini normalize et (Excel -> DB)
// ESNEK EŞLEŞTİRME
// ============================================
const normalizeColumnNames = (data) => {
  if (!data || data.length === 0) return [];
  
  const firstRow = data[0];
  const actualColumns = Object.keys(firstRow);
  
  // SUT kolon eşleştirme map'i
  // Excel'deki gerçek kolon isimleri: "İŞLEM KODU", "İŞLEM ADI", "AÇIKLAMA", "İŞLEM PUANI"
  const columnMap = {
    // SutKodu eşleştirmeleri
    'İŞLEM KODU': 'SutKodu',
    'İşlem Kodu': 'SutKodu',
    'İşlem Kodu': 'SutKodu',
    'SUT Kodu': 'SutKodu',
    'SutKodu': 'SutKodu',
    'SUTKODU': 'SutKodu',
    'Sut Kodu': 'SutKodu',
    // IslemAdi eşleştirmeleri
    'İŞLEM ADI': 'IslemAdi',
    'İşlem Adı': 'IslemAdi',
    'İşlem Adi': 'IslemAdi',
    'İşlem': 'IslemAdi',
    'Islem': 'IslemAdi',
    'İŞLEM': 'IslemAdi',
    // Aciklama eşleştirmeleri
    'AÇIKLAMA': 'Aciklama',
    'Açıklama': 'Aciklama',
    'Aciklama': 'Aciklama',
    // Puan eşleştirmeleri
    'İŞLEM PUANI': 'Puan',
    'İşlem Puanı': 'Puan',
    'İşlem Puani': 'Puan',
    'Puan': 'Puan',
    'PUAN': 'Puan',
    // Diğer kolonlar (opsiyonel)
    'Ana Başlık': 'AnaBaslikNo',
    'AnaBaslik': 'AnaBaslikNo',
    'Ana Baslik': 'AnaBaslikNo',
    'Ana Başlık No': 'AnaBaslikNo',
    'AnaBaslikNo': 'AnaBaslikNo',
    'Kategori': 'KategoriAdi',
    'Kategori Adı': 'KategoriAdi',
    'Kategori Adi': 'KategoriAdi',
    'KATEGORİ': 'KategoriAdi',
    'Hiyerarşi': 'HiyerarsiID',
    'Hiyerarsi': 'HiyerarsiID',
    'Hiyerarşi ID': 'HiyerarsiID',
    'HiyerarsiID': 'HiyerarsiID'
  };
  
  // Esnek kolon eşleştirme fonksiyonu
  const findColumnMatch = (excelColName) => {
    // Önce tam eşleşme
    if (columnMap[excelColName]) {
      return columnMap[excelColName];
    }
    
    // Normalize et
    const normalized = fixTurkishEncoding(excelColName.trim());
    const lower = normalized.toLowerCase();
    
    // Esnek eşleştirme
    for (const [key, value] of Object.entries(columnMap)) {
      const keyNormalized = fixTurkishEncoding(key.trim().toLowerCase());
      if (keyNormalized === lower) {
        return value;
      }
    }
    
    // Kısmi eşleştirme
    if (lower.includes('sut') && lower.includes('kod')) return 'SutKodu';
    if (lower.includes('işlem') || lower.includes('islem')) return 'IslemAdi';
    if (lower.includes('puan')) return 'Puan';
    if (lower.includes('açıklama') || lower.includes('aciklama')) return 'Aciklama';
    if (lower.includes('ana') && (lower.includes('başlık') || lower.includes('baslik'))) {
      if (lower.includes('no') || lower.includes('numara')) return 'AnaBaslikNo';
      return 'AnaBaslikAdi';
    }
    if (lower.includes('kategori')) return 'KategoriAdi';
    if (lower.includes('hiyerarşi') || lower.includes('hiyerarsi')) return 'HiyerarsiID';
    
    return null;
  };
  
  // Kolon mapping'i oluştur
  const columnMapping = {};
  actualColumns.forEach(excelCol => {
    const dbCol = findColumnMatch(excelCol);
    if (dbCol) {
      columnMapping[excelCol] = dbCol;
    }
  });
  
  // Tüm satırları normalize et
  return data.map(row => {
    const normalized = {};
    
    // Eşleşen kolonları kopyala
    for (const [excelCol, dbCol] of Object.entries(columnMapping)) {
      if (row[excelCol] !== undefined) {
        normalized[dbCol] = row[excelCol];
      }
    }
    
    // Eşleşmeyen kolonları da ekle (debug için)
    for (const excelCol of actualColumns) {
      if (!columnMapping[excelCol] && row[excelCol] !== undefined) {
        normalized[`_${excelCol}`] = row[excelCol];
      }
    }
    
    return normalized;
  });
};

// ============================================
// SUT verilerini validate et
// ============================================
const validateSutData = (data) => {
  const errors = [];
  const warnings = [];
  const validData = [];
  
  // Kolon isimlerini önce normalize et
  const normalizedData = normalizeColumnNames(data);
  
  // Gerekli kolonları kontrol et
  const requiredColumns = ['SutKodu', 'IslemAdi'];
  
  if (normalizedData.length > 0) {
    // Kategori başlıklarını atla, gerçek bir veri satırı bul
    let sampleRow = null;
    for (const row of normalizedData) {
      // SutKodu varsa gerçek bir veri satırı
      if (row.SutKodu && row.SutKodu !== null && row.SutKodu !== '') {
        sampleRow = row;
        break;
      }
    }
    
    // Hiç veri satırı yoksa hata
    if (!sampleRow) {
      const originalColumns = Object.keys(data[0] || {});
      return {
        valid: false,
        validData: [],
        errors: [{
          row: 0,
          type: 'VERİ_YOK',
          message: `Excel'de geçerli veri satırı bulunamadı. Tüm satırlar kategori başlığı gibi görünüyor.`,
          severity: 'critical',
          excelColumns: originalColumns
        }],
        warnings: [],
        stats: {
          total: data.length,
          valid: 0,
          invalid: data.length,
          warnings: 0
        }
      };
    }
    
    // Örnek satırda gerekli kolonlar var mı kontrol et
    const missingColumns = requiredColumns.filter(col => !(col in sampleRow));
    
    if (missingColumns.length > 0) {
      const originalColumns = Object.keys(data[0] || {});
      const normalizedColumns = Object.keys(sampleRow || {});
      
      console.error('❌ Gerekli kolonlar eksik:');
      console.error('   Aranan kolonlar:', requiredColumns);
      console.error('   Eksik kolonlar:', missingColumns);
      console.error('   Orijinal kolonlar:', originalColumns);
      console.error('   Normalize edilmiş kolonlar:', normalizedColumns);
      
      return {
        valid: false,
        validData: [],
        errors: [{
          row: 0,
          type: 'KOLON_EKSIK',
          message: `Gerekli kolonlar bulunamadı: ${missingColumns.join(', ')}. Excel'deki kolonlar: ${originalColumns.join(', ')}`,
          severity: 'critical',
          excelColumns: originalColumns,
          missingColumns: missingColumns
        }],
        warnings: [],
        stats: {
          total: data.length,
          valid: 0,
          invalid: data.length,
          warnings: 0
        }
      };
    }
  }
  
  // Duplicate kontrolü için set
  const seenSutKodlari = new Set();
  
  normalizedData.forEach((row, index) => {
    const rowErrors = [];
    const rowWarnings = [];
    const rowNumber = index + 2; // Excel'de 1. satır başlık
    
    // Satır tipini belirle
    const hasSutKodu = row.SutKodu && row.SutKodu !== null && row.SutKodu !== '';
    const hasIslemAdi = row.IslemAdi && row.IslemAdi !== null && row.IslemAdi !== '';
    const hasPuan = row.Puan && row.Puan !== null && row.Puan !== '';
    
    // Satır tipi belirleme:
    // 1. SutKodu var -> ISLEM (gerçek işlem)
    // 2. SutKodu yok, IslemAdi var, Puan yok -> KATEGORI/ANA_BASLIK (hiyerarşi)
    // 3. Boş satır -> Atla
    
    // Tamamen boş satırları atla
    if (!hasSutKodu && !hasIslemAdi && !hasPuan) {
      return;
    }
    
    // "NOT:" veya açıklama satırlarını atla
    // (SutKodu "NOT:" ile başlıyor ama IslemAdi yok)
    if (hasSutKodu && !hasIslemAdi) {
      const sutKoduStr = row.SutKodu.toString().trim().toUpperCase();
      if (sutKoduStr.startsWith('NOT:') || sutKoduStr.startsWith('AÇIKLAMA') || sutKoduStr.startsWith('DİKKAT')) {
        // Bu bir açıklama/not satırı, atla
        return;
      }
    }
    
    // İşlem satırı kontrolü (SutKodu varsa)
    if (hasSutKodu) {
      // İşlem satırları için IslemAdi zorunlu
      if (!hasIslemAdi) {
        rowErrors.push({
          field: 'IslemAdi',
          message: 'İşlem adı boş olamaz',
          type: 'ZORUNLU_ALAN'
        });
      }
    }
    
    // Kategori/Ana başlık satırları için sadece IslemAdi yeterli
    // SutKodu yok ama IslemAdi var -> Hiyerarşi satırı (geçerli)
    if (!hasSutKodu && hasIslemAdi) {
      // Bu geçerli bir hiyerarşi satırı, devam et
      validData.push(row);
      return;
    }
    
    // 3. SutKodu validasyonu
    if (row.SutKodu) {
      const sutKodu = row.SutKodu.toString().trim();
      
      if (sutKodu === '') {
        rowErrors.push({
          field: 'SutKodu',
          message: 'SUT Kodu boş olamaz',
          type: 'BOS_ALAN'
        });
      } else if (seenSutKodlari.has(sutKodu)) {
        rowErrors.push({
          field: 'SutKodu',
          message: `SUT Kodu tekrar ediyor: ${sutKodu}`,
          type: 'DUPLICATE'
        });
      } else {
        seenSutKodlari.add(sutKodu);
      }
      
      if (sutKodu.length > 50) {
        rowWarnings.push({
          field: 'SutKodu',
          message: 'SUT Kodu çok uzun (max 50 karakter)',
          type: 'UZUNLUK_UYARI'
        });
      }
    }
    
    // 4. IslemAdi validasyonu
    if (row.IslemAdi) {
      const islemAdi = row.IslemAdi.toString().trim();
      
      if (islemAdi === '') {
        rowErrors.push({
          field: 'IslemAdi',
          message: 'İşlem adı boş olamaz',
          type: 'BOS_ALAN'
        });
      }
      
      if (islemAdi.length < 3) {
        rowWarnings.push({
          field: 'IslemAdi',
          message: 'İşlem adı çok kısa (min 3 karakter)',
          type: 'UZUNLUK_UYARI'
        });
      }
    }
    
    // 5. Puan validasyonu (zaten number olarak geliyor, parse'a gerek yok!)
    if (row.Puan !== undefined && row.Puan !== null && row.Puan !== '') {
      const puan = typeof row.Puan === 'number' ? row.Puan : parseFloat(row.Puan);
      
      if (isNaN(puan)) {
        rowErrors.push({
          field: 'Puan',
          message: `Puan sayı formatında olmalı (gelen değer: ${row.Puan})`,
          type: 'FORMAT_HATASI'
        });
      } else {
        if (puan < 0) {
          rowErrors.push({
            field: 'Puan',
            message: 'Puan negatif olamaz',
            type: 'DEGER_HATASI'
          });
        }
        // Değer zaten doğru
        row.Puan = puan;
      }
    }
    
    // Hata veya uyarı varsa kaydet
    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        data: row,
        errors: rowErrors,
        severity: 'error'
      });
    } else {
      validData.push(row);
      
      if (rowWarnings.length > 0) {
        warnings.push({
          row: rowNumber,
          data: row,
          warnings: rowWarnings,
          severity: 'warning'
        });
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    validData: validData,
    normalizedData: normalizedData,
    errors: errors,
    warnings: warnings,
    stats: {
      total: data.length,
      valid: validData.length,
      invalid: errors.length,
      warnings: warnings.length
    }
  };
};

// ============================================
// Hiyerarşi yapısını parse et - AKILLI SEVİYE TESPİTİ
// ============================================
// Her ana başlık farklı yapıda:
// - 1-2: Direkt işlemler (alt başlık yok)
// - 3: Alt başlıklar var
// - 4: Alt başlık → Grup tanımları (A1 grubu) → Açıklama → İşlemler
// - 5: Çok seviyeli hiyerarşi
// - 6+: Numaralı alt başlıklar (6.1., 6.1.1.)
// ============================================
parseHierarchy = (data) => {
  const sourceData = (data[0] && data[0].SutKodu !== undefined) ? data : normalizeColumnNames(data);

  const hierarchyRows = [];
  let currentAnaBaslikNo = 0;
  let currentAnaBaslik = null; // Seviye 1 (Ana başlık)
  let parentStack = []; // Hiyerarşi stack'i (parent tracking için)
  let sira = 0;

  // Açıklama satırı mı kontrol et (uzun, virgüllü cümleler)
  const isDescriptionRow = (text) => {
    if (!text || text.length < 20) return false;
    // Virgül ve nokta var, uzun cümle -> açıklama
    const hasCommas = (text.match(/,/g) || []).length >= 2;
    const endsWithPeriod = text.trim().endsWith('.');
    const tooLong = text.length > 100;
    return (hasCommas && tooLong) || (endsWithPeriod && tooLong);
  };

  // SUT kodu formatında mı kontrol et (R104080, L101880, 510010 gibi)
  // Pattern: Harf veya rakam ile başlar, ardından rakamlar
  const isSutCodeFormat = (text) => {
    if (!text || text.length < 3 || text.length > 20) return false;
    // Harf ile başlayan: R104080, L101880
    // Rakam ile başlayan: 510010, 540020
    return /^[A-Z]?\d{4,}$/.test(text.trim());
  };

  // Parent stack'ten son numaralı başlığı bul
  // Hem rakam-rakam (9.1, 9.1.1) hem de harf-rakam (9.A, 9.D, 9.D. PATOLOJİ) kombinasyonlarını bulur
  const findLastNumberedParent = (stack) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const node = stack[i];
      if (node.Baslik) {
        // Rakam-rakam kombinasyonları: 9.1, 9.1.1, 6.1.2 gibi
        if (/^\d+\.\d+/.test(node.Baslik)) {
        return node;
        }
        // Harf-rakam kombinasyonları: 9.A, 9.B, 9.D, 9.E, 9.D. PATOLOJİ gibi
        // Pattern: Rakam + nokta + harf ile başlayan (ardından başka şeyler olabilir)
        if (/^\d+\.[A-Z]/.test(node.Baslik)) {
          return node;
        }
      }
    }
    return null;
  };
  
  // Ana başlık bazlı özel seviye belirleme
  // Her ana başlık farklı yapıda, özel logic gerekiyor
  const determineSeviyeByAnaBaslik = (islemAdi, anaBaslikNo, parentStack) => {
    const lastNode = parentStack.length > 0 ? parentStack[parentStack.length - 1] : null;
    // 1. Numaralı başlıklar (tüm ana başlıklarda geçerli)
    const numberedMatch = islemAdi.match(/^(\d+(?:\.\d+)*(?:\.[A-Z])?(?:\.\d+)*)\.\s*(.+)/);
    if (numberedMatch) {
      const numberPart = numberedMatch[1];
      const dots = (numberPart.match(/\./g) || []).length;
      return Math.min(dots + 1, 6); // Seviye 2-6
    }

    // 2. Ana başlık bazlı özel kurallar
    switch (anaBaslikNo) {
      case 1: // YATAK PUANLARI - direkt işlemler
      case 2: // HEKİM MUAYENELERİ - direkt işlemler
        // Alt başlık varsa Seviye 2
        return 2;

      case 3: // ACİL SERVİS
        // "ACİL SERVİSTE YAPILAN UYGULAMALAR" gibi başlıklar
        return 2;

      case 4: // AMELİYATHANE
        // "AMELİYATHANE ve AMELİYATHANE DIŞI İŞLEM TANIMLARI" → Seviye 2
        // "A1 grubu", "A2 grubu" → Seviye 3
        if (/^[A-Z]\d?\s*grubu?$/i.test(islemAdi)) {
          return 3;
        }
        // BÜYÜK HARF başlıklar
        const isAllCaps = islemAdi === islemAdi.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(islemAdi);
        if (isAllCaps) {
          return lastNode && lastNode.SeviyeNo >= 2 ? lastNode.SeviyeNo + 1 : 2;
        }
        // Karma harf (açıklama veya alt başlık)
        return lastNode && lastNode.SeviyeNo >= 2 ? lastNode.SeviyeNo + 1 : 3;

      case 5: // ANESTEZİ - çok seviyeli (BÜYÜK HARF → Seviye 2, Karma harf → Seviye 3)
        const isAllCaps5 = islemAdi === islemAdi.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(islemAdi);
        const isTitle5 = /^[A-ZĞÜŞİÖÇ][a-zğüşıöç]/.test(islemAdi);
        
        if (isAllCaps5) {
          // BÜYÜK HARF başlıklar: Seviye 2 (ana başlığın altı)
          return 2;
        } else if (isTitle5) {
          // Karma harf başlıklar: Son BÜYÜK HARF başlığın altı (Seviye 3)
          // Parent stack'te son BÜYÜK HARF başlığı bul
          for (let i = parentStack.length - 1; i >= 0; i--) {
            const node = parentStack[i];
            if (node.Baslik && node.Baslik === node.Baslik.toUpperCase() && node.SeviyeNo === 2) {
              return node.SeviyeNo + 1;
            }
          }
          return 3;
        }
        return 2;

      case 6: // CERRAHİ
      case 7: // TIBBİ UYGULAMALAR
        // Numaralı alt başlıklar (6.1., 6.1.1., 7.1., 7.2...) + BÜYÜK HARF + Karma Harf başlıklar
        
        // BÜYÜK HARF kontrolü: Küçük harf bağlaçları (ve, ile, veya) hariç tüm harfler büyük mü?
        const wordsUpper = islemAdi.split(/\s+/).filter(word => {
          // Bağlaçları hariç tut
          const lowercaseWords = ['ve', 'ile', 'veya', 'ya', 'da'];
          return !lowercaseWords.includes(word.toLowerCase());
        });
        const isAllCaps67 = wordsUpper.length > 0 && 
                           wordsUpper.every(word => word === word.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(word));
        
        const isTitle67 = /^[A-ZĞÜŞİÖÇ][a-zğüşıöç]/.test(islemAdi);
        
        if (isAllCaps67 || isTitle67) {
          // Parent stack'ten son numaralı başlığı bul (6.1, 7.2 gibi)
          const lastNumbered = findLastNumberedParent(parentStack);
          
          if (lastNumbered) {
            // Numaralı başlığın altına gir (Seviye +1)
            // Örnek: 6.1 (Seviye 2) → BÜYÜK HARF (Seviye 3)
            return lastNumbered.SeviyeNo + 1;
          }
          
          // Numaralı başlık bulunamadı, varsayılan
          return 2;
        }
        return 2;

      case 8: // RADYOLOJİK GÖRÜNTÜLEME - çok derin hiyerarşi (8.1.2.A, 8.3.1, 8.3.2)
        // Harf prefiksi olanlar (C-Anjiyografik, D-Kemik, E-Nonvasküler, F-Ultrasonografik, G-Renkli Doppler)
        const hasLetterPrefix8 = /^[A-Z]-/.test(islemAdi);
        if (hasLetterPrefix8) {
          // Harf prefiksi olan başlıklar: parent stack'ten son numaralı başlığın altına gir
          const lastNumbered8 = findLastNumberedParent(parentStack);
          if (lastNumbered8) {
            return lastNumbered8.SeviyeNo + 1;
          }
          return 3; // Varsayılan seviye
        }
        
        // Numaralı başlıklar yukarıda halledildi (8.3.1, 8.3.2 gibi)
        // BÜYÜK HARF ve Karma Harf → Parent tracking
        const isAllCaps8 = islemAdi === islemAdi.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(islemAdi);
        const isTitle8 = /^[A-ZĞÜŞİÖÇ][a-zğüşıöç]/.test(islemAdi);
        
        if (isAllCaps8 || isTitle8) {
          // Parent stack'ten son numaralı veya harf prefiksli başlığı bul
          const lastNumbered8 = findLastNumberedParent(parentStack);
          const lastLetterPrefix = parentStack.slice().reverse().find(n => n.Baslik && /^[A-Z]-/.test(n.Baslik));
          
          if (lastLetterPrefix && (!lastNumbered8 || lastLetterPrefix.SeviyeNo > lastNumbered8.SeviyeNo)) {
            // Harf prefiksli başlığın altına gir
            return lastLetterPrefix.SeviyeNo + 1;
          } else if (lastNumbered8) {
            // Numaralı başlığın altına gir
            return lastNumbered8.SeviyeNo + 1;
          }
          return 2;
        }
        return 2;

      case 9: // LABORATUVAR - çok derin (9.1, 9.A, 9.B, 9.B.1, 9.C.1)
        // ÖNCE: Numaralı harf-rakam başlıkları kontrol et (9.D. PATOLOJİ gibi)
        // Bu başlıklar Seviye 2 olmalı
        if (/^\d+\.[A-Z]/.test(islemAdi)) {
          return 2;
        }
        
        // Harf-rakam kodları (9.A, 9.B, 9.C...) numaralı başlık olarak algılanır (yukarıda)
        const isAllCaps9 = islemAdi === islemAdi.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(islemAdi);
        const isTitle9 = /^[A-ZĞÜŞİÖÇ][a-zğüşıöç]/.test(islemAdi);
        
        // ÖZEL: Karma format başlıklar (ACTH-CRH Uyarı Testi, Kortizol-ACTH Uyarı Testi)
        // Hem büyük hem küçük harf içerir, genellikle tire/boşluk ile ayrılmış
        const hasMixedCase9 = /[A-ZĞÜŞİÖÇ]/.test(islemAdi) && 
                              /[a-zğüşıöç]/.test(islemAdi) && 
                              !isAllCaps9;
        
        if (isAllCaps9) {
          // GENEL MANTIK: Bir numaralı harf-rakam başlığından (9.A, 9.B, 9.D, 9.E gibi) sonra gelen
          // BÜYÜK HARF başlıklar, o numaralı başlığın altında olmalı
          // Stack'ten son numaralı harf-rakam başlığını bul (9.D. PATOLOJİ gibi)
          const lastNumbered9 = findLastNumberedParent(parentStack);
          
          if (lastNumbered9 && lastNumbered9.SeviyeNo === 2) {
            // Son numaralı başlık Seviye 2 ise (9.D. PATOLOJİ gibi)
            // Bu BÜYÜK HARF başlığı onun altına gir (Seviye 3)
            return lastNumbered9.SeviyeNo + 1;
          }
          
          // Eğer numaralı başlık bulunamadı veya Seviye 2 değilse, normal mantığa devam et
          return 2;
        } else if (isTitle9 || hasMixedCase9) {
          // Karma harf başlıklar (Spesifik IgE, Kortizol-CRH Uyarı Testi)
          // Son BÜYÜK HARF başlığın altına gir
          for (let i = parentStack.length - 1; i >= 0; i--) {
            const node = parentStack[i];
            if (node.Baslik && node.Baslik === node.Baslik.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(node.Baslik)) {
              // DİNAMİK TESTLER (Seviye 3) → ACTH-CRH Uyarı Testi (Seviye 4)
              return node.SeviyeNo + 1;
            }
          }
          
          // BÜYÜK HARF parent bulunamadı, son numaralı başlığın altına gir
          const lastNumbered9 = findLastNumberedParent(parentStack);
          if (lastNumbered9) {
            return lastNumbered9.SeviyeNo + 1;
          }
          return 3; // Varsayılan
        }
        return 2;

      case 10: // TÜRKİYE HALK SAĞLIĞI - basit alt başlıklar
        // "MİKROBİYOLOJİK TESTLER", "PARAZİTER VE BAKTERİYEL" gibi
        // Hepsi BÜYÜK HARF ve Seviye 2
        return 2;

      default:
        return 2;
    }
  };

  sourceData.forEach((row, index) => {
    const hasSutKodu = row.SutKodu && row.SutKodu !== null && row.SutKodu !== '';
    const hasIslemAdi = row.IslemAdi && row.IslemAdi !== null && row.IslemAdi !== '';

    // Hiyerarşi satırı: SutKodu yok ama IslemAdi var
    if (!hasSutKodu && hasIslemAdi) {
      const islemAdi = row.IslemAdi.toString().replace(/[\r\n]+/g, ' ').trim();
      
      // Açıklama satırlarını atla
      if (isDescriptionRow(islemAdi)) {
        return;
      }
      
      // SUT kodu formatındaki satırları atla (R104080, L101880 gibi)
      // Bunlar muhtemelen yanlış yere yazılmış SUT kodları, hiyerarşi değil
      if (isSutCodeFormat(islemAdi)) {
        return;
      }
      
      // Çok kısa veya "Birim" gibi satırları atla
      if (islemAdi.length < 3 || islemAdi.toLowerCase() === 'birim') {
        return;
      }
      
      // Ana başlık tespiti: "1. YATAK PUANLARI", "10. TÜRKİYE HALK SAĞLIĞI..."
      // Pattern: Sadece 1-10 arası tek rakam + nokta + boşluk (ardından başka rakam olmamalı)
      const mainHeadingMatch = islemAdi.match(/^(\d{1,2})\.\s+([^\d].+)/);
      
      if (mainHeadingMatch) {
        const number = parseInt(mainHeadingMatch[1]);
        const baslik = mainHeadingMatch[2].trim();
        
        if (number >= 1 && number <= 10) {
          // Ana başlık (Seviye 1)
          currentAnaBaslikNo = number;
          currentAnaBaslik = {
            AnaBaslikNo: currentAnaBaslikNo,
            Baslik: baslik,
            TamBaslik: islemAdi,
            SeviyeNo: 1,
            ParentID: null,
            ParentRowIndex: null,
            Sira: ++sira,
            rowIndex: index
          };
          hierarchyRows.push(currentAnaBaslik);
          parentStack = [currentAnaBaslik]; // Stack'i sıfırla
          return;
        }
      }
      
      // Alt başlık: Seviye tespiti yap
      if (currentAnaBaslik) {
        // ÖNEMLİ: Aynı başlık zaten hierarchyRows'ta var mı kontrol et (tekrar eklemeyi önle)
        const existingNode = hierarchyRows.find(h => 
          h.Baslik === islemAdi && 
          h.AnaBaslikNo === currentAnaBaslikNo &&
          h.rowIndex === index
        );
        
        if (existingNode) {
          // Aynı başlık zaten var, atla (tekrar ekleme)
          return;
        }
        
        const seviye = determineSeviyeByAnaBaslik(islemAdi, currentAnaBaslikNo, parentStack);
        
        // Parent belirleme: Stack'ten uygun parent'ı bul
        let parent = currentAnaBaslik; // Varsayılan: Ana başlık
        
        // GENEL MANTIK: Eğer seviye 3 ise ve stack'te Seviye 2 numaralı harf-rakam başlığı varsa,
        // parent o numaralı başlık olmalı (9.D. PATOLOJİ gibi)
        if (seviye === 3) {
          // Stack'ten son Seviye 2 numaralı harf-rakam başlığını bul
          for (let i = parentStack.length - 1; i >= 0; i--) {
            const node = parentStack[i];
            if (node.SeviyeNo === 2 && node.Baslik && /^\d+\.[A-Z]/.test(node.Baslik)) {
              parent = node;
              break;
            }
          }
        }
        
        // Eğer yukarıdaki mantık parent bulamadıysa, normal mantığa devam et
        if (parent === currentAnaBaslik && seviye > 2) {
        for (let i = parentStack.length - 1; i >= 0; i--) {
          if (parentStack[i].SeviyeNo < seviye) {
            parent = parentStack[i];
            break;
            }
          }
        }
        
        const newNode = {
          AnaBaslikNo: currentAnaBaslikNo,
          Baslik: islemAdi,
          TamBaslik: islemAdi,
          SeviyeNo: seviye,
          ParentID: null, // DB ID sonra atanacak
          ParentRowIndex: parent.rowIndex,
          Sira: ++sira,
          rowIndex: index
        };
        hierarchyRows.push(newNode);
        
        // Stack güncelle: Aynı veya daha yüksek seviyeli node'ları çıkar
        // GENEL MANTIK: Eğer yeni node Seviye 3 ise ve parent'ı Seviye 2 numaralı harf-rakam başlığı ise,
        // bu başlıkları stack'e ekleme (parent'ları zaten belirlenmiş, stack'te olmalarına gerek yok)
        // Bu, "9.D. PATOLOJİ" altındaki başlıklar gibi durumlar için geçerli
        const isParentNumberedLevel2 = parent.SeviyeNo === 2 && parent.Baslik && /^\d+\.[A-Z]/.test(parent.Baslik);
        
        if (seviye === 3 && isParentNumberedLevel2) {
          // Seviye 3 başlık, parent'ı Seviye 2 numaralı harf-rakam başlığı
          // Stack'ten diğer Seviye 3 başlıkları çıkar (aynı parent'a sahip olabilirler)
          // Ama parent'ı (Seviye 2 numaralı başlık) stack'te tut
          while (parentStack.length > 0) {
            const lastNode = parentStack[parentStack.length - 1];
            // Parent'ı (Seviye 2 numaralı başlık) stack'te tut
            if (lastNode.rowIndex === parent.rowIndex) {
              break;
            }
            // Seviye 3 veya daha yüksek başlıkları çıkar
            if (lastNode.SeviyeNo >= seviye) {
              parentStack.pop();
            } else {
              break;
            }
          }
          // Bu başlıkları stack'e EKLEME (parent'ları zaten belirlenmiş)
          return;
        } else {
          // Normal mantık: Aynı veya daha yüksek seviyeli node'ları çıkar
          // ÖNEMLİ: "9.D. PATOLOJİ" gibi numaralı başlıkların altında başlıklar olabilir
          // Bu yüzden, eğer stack'teki son node numaralı bir başlıksa (9.D., 9.E. gibi)
          // ve yeni node da aynı seviyedeyse, son node'u stack'te tut
          const lastStackNode = parentStack.length > 0 ? parentStack[parentStack.length - 1] : null;
          const isLastStackNodeNumbered = lastStackNode && lastStackNode.SeviyeNo === 2 && /^\d+\.[A-Z]/.test(lastStackNode.Baslik);
          const isNewNodeNumbered = seviye === 2 && /^\d+\.[A-Z]/.test(newNode.Baslik);
          
          if (isLastStackNodeNumbered && isNewNodeNumbered) {
            // İkisi de numaralı harf-rakam başlığı (9.D., 9.E. gibi) ve aynı seviye (Seviye 2)
            // ÖNEMLİ: Son node'u (9.D. PATOLOJİ) stack'te TUT, çünkü altında başlıklar olabilir
            // Sadece daha yüksek seviyeli node'ları çıkar
            while (parentStack.length > 0 && parentStack[parentStack.length - 1].SeviyeNo > seviye) {
              parentStack.pop();
            }
            // Son node'u (9.D. PATOLOJİ) stack'te tut, yeni node'u (9.E.) ekle
            // Böylece hem 9.D. hem 9.E. stack'te olur, alt başlıklar doğru parent'ı bulabilir
          } else {
            // Normal mantık: Aynı veya daha yüksek seviyeli node'ları çıkar
        while (parentStack.length > 0 && parentStack[parentStack.length - 1].SeviyeNo >= seviye) {
          parentStack.pop();
            }
          }
        }
        parentStack.push(newNode);
      }
    }
  });

  return hierarchyRows;
}

// ============================================
// SUT verisini normalize et (veritabanı formatına çevir)
// ============================================
const normalizeSutData = async (data) => {
  // Eğer data zaten normalize edilmişse direkt kullan
  const sourceData = (data[0] && data[0].SutKodu !== undefined) ? data : normalizeColumnNames(data);
  
  // Hiyerarşi yapısını parse et
  const hierarchyRows = parseHierarchy(sourceData);
  
  // İşlem satırlarını işle ve ana başlık numarasını ata
  // Ana başlık rowIndex'lerini sırala (yukarıdan aşağıya)
  const anaBaslikIndices = hierarchyRows
    .filter(h => h.SeviyeNo === 1)
    .map(h => ({ rowIndex: h.rowIndex, anaBaslikNo: h.AnaBaslikNo }))
    .sort((a, b) => a.rowIndex - b.rowIndex);
  
  // Her satır için en yakın üstteki ana başlığı bul
  const getAnaBaslikNoForRow = (rowIndex) => {
    // En yakın üstteki ana başlığı bul
    for (let i = anaBaslikIndices.length - 1; i >= 0; i--) {
      if (anaBaslikIndices[i].rowIndex <= rowIndex) {
        return anaBaslikIndices[i].anaBaslikNo;
      }
    }
    return null;
  };
  
  const processedRows = sourceData
    .map((row, index) => {
      // Hiyerarşi satırlarını atla
      if (!row.SutKodu || row.SutKodu === null || row.SutKodu === '') {
        return null;
      }
      
      // İşlem satırı - en yakın üstteki ana başlığı bul
      const anaBaslikNo = getAnaBaslikNoForRow(index);
      
      return {
        row,
        index,
        anaBaslikNo: anaBaslikNo
      };
    })
    .filter(item => item !== null)
    .map(({ row, index, anaBaslikNo }) => {
    // String alanları temizle
    const cleanString = (value) => {
      if (!value) return null;
      const str = value.toString().trim();
      return str === '' ? null : fixTurkishEncoding(str);
    };
    
    // Ana başlık numarasını kullan (yukarıdan gelen)
    const finalAnaBaslikNo = anaBaslikNo || row.AnaBaslikNo || null;
    
    // Puan değerini parse et
    let puan = null;
    if (row.Puan !== undefined && row.Puan !== null && row.Puan !== '') {
      // XLSX kütüphanesi cell.v ile doğru değeri veriyor
      if (typeof row.Puan === 'number') {
        puan = row.Puan; // Direkt kullan
      } else {
        // String ise parse et
        let puanStr = row.Puan.toString().trim();
        
        // Format tespiti:
        // Türkçe format: "1.252,27" (nokta binlik, virgül ondalık)
        // US format: "1,252.27" (virgül binlik, nokta ondalık)
        
        if (puanStr.includes(',') && puanStr.includes('.')) {
          // Her ikisi de varsa, hangisi sonra geliyorsa o ondalık ayracıdır
          const lastComma = puanStr.lastIndexOf(',');
          const lastDot = puanStr.lastIndexOf('.');
          
          if (lastComma > lastDot) {
            // Türkçe format: "1.252,27"
            puanStr = puanStr.replace(/\./g, '').replace(',', '.');
          } else {
            // US format: "1,252.27"
            puanStr = puanStr.replace(/,/g, '');
          }
        } else if (puanStr.includes(',')) {
          // Sadece virgül var - Türkçe ondalık ayracı
          puanStr = puanStr.replace(',', '.');
        }
        // Sadece nokta varsa zaten US formatında, dokunma
        
        puan = parseFloat(puanStr);
        if (isNaN(puan)) {
          puan = null;
        }
        // String'den parse edilenler DOĞRU değer (çünkü cell.w kullandık)
      }
    }
    
    return {
      SutKodu: cleanString(row.SutKodu) || '',
      IslemAdi: cleanString(row.IslemAdi) || '',
      Puan: puan,
      Aciklama: cleanString(row.Aciklama),
      AnaBaslikNo: finalAnaBaslikNo,
      HiyerarsiID: row.HiyerarsiID ? parseInt(row.HiyerarsiID) : null,
      rowIndex: index // Hiyerarşi eşleştirmesi için gerekli
    };
  });
  
  // ÖZEL KURAL 1: Ana Başlık 1 (YATAK PUANLARI) ve Ana Başlık 2 (HEKİM MUAYENELERİ VE RAPORLAR)
  // Bu ana dallarda direkt işlemler varsa, ana başlık adıyla aynı isimde bir alt dal oluştur
  for (const anaBaslikNo of [1, 2]) {
    const anaBaslik = hierarchyRows.find(h => h.SeviyeNo === 1 && h.AnaBaslikNo === anaBaslikNo);
    if (anaBaslik) {
      // Bu ana başlığın alt başlıklarını bul
      const anaBaslikAltBasliklar = hierarchyRows
        .filter(h => h.AnaBaslikNo === anaBaslikNo && h.SeviyeNo > 1)
        .sort((a, b) => a.rowIndex - b.rowIndex);
      
      // Bu ana başlığın işlemlerini bul
      const anaBaslikIslemler = processedRows
        .filter(r => r.AnaBaslikNo === anaBaslikNo)
        .sort((a, b) => a.rowIndex - b.rowIndex);
      
      if (anaBaslikIslemler.length > 0) {
        const ilkIslem = anaBaslikIslemler[0];
        const ilkIslemRowIndex = ilkIslem.rowIndex;
        const ilkAltBaslik = anaBaslikAltBasliklar[0];
        const ilkAltBaslikRowIndex = ilkAltBaslik ? ilkAltBaslik.rowIndex : Infinity;
        
        // İlk işlem, ilk alt başlıktan önceyse (yani ana başlığa direkt bağlı)
        if (ilkIslemRowIndex < ilkAltBaslikRowIndex) {
          // Ana başlık adıyla aynı isimde alt başlık oluştur
          const altBaslikAdi = anaBaslik.Baslik; // "YATAK PUANLARI" veya "HEKİM MUAYENELERİ VE RAPORLAR"
          
          // Bu isimde zaten bir alt başlık var mı?
          const mevcutAltBaslik = hierarchyRows.find(h => 
            h.AnaBaslikNo === anaBaslikNo && 
            h.SeviyeNo === 2 && 
            h.Baslik === altBaslikAdi
          );
          
          if (!mevcutAltBaslik) {
            // Yeni alt başlık oluştur
            const yeniAltBaslik = {
              AnaBaslikNo: anaBaslikNo,
              Baslik: altBaslikAdi,
              TamBaslik: altBaslikAdi,
              SeviyeNo: 2,
              ParentID: null, // Ana başlığa bağlı
              ParentRowIndex: anaBaslik.rowIndex,
              Sira: 0,
              rowIndex: anaBaslik.rowIndex + 1 // Ana başlıktan hemen sonra
            };
            
            // Hiyerarşiye ekle (ilk alt başlıktan önce veya en başa)
            if (ilkAltBaslik) {
              const ilkAltBaslikIndex = hierarchyRows.findIndex(h => h.rowIndex === ilkAltBaslikRowIndex);
              if (ilkAltBaslikIndex >= 0) {
                hierarchyRows.splice(ilkAltBaslikIndex, 0, yeniAltBaslik);
              } else {
                hierarchyRows.push(yeniAltBaslik);
              }
            } else {
              // Alt başlık yoksa, ana başlıktan hemen sonra ekle
              const anaBaslikIndex = hierarchyRows.findIndex(h => h.rowIndex === anaBaslik.rowIndex);
              if (anaBaslikIndex >= 0) {
                hierarchyRows.splice(anaBaslikIndex + 1, 0, yeniAltBaslik);
              } else {
                hierarchyRows.push(yeniAltBaslik);
              }
            }
          }
        }
      }
    }
  }
  
  // ÖZEL KURAL 2: Ana Başlık 4 (AMELİYATHANE)
  // İşlemlerin doğru üst dalına (AMELİYATHANE veya AMELİYATHANE DIŞI) bağlanması
  // İşlem adından veya mevcut hiyerarşi yapısından anlaşılacak şekilde
  const anaBaslik4 = hierarchyRows.find(h => h.SeviyeNo === 1 && h.AnaBaslikNo === 4);
  if (anaBaslik4) {
    // AMELİYATHANE ve AMELİYATHANE DIŞI İŞLEM TANIMLARI alt başlıklarını bul
    const ameliyathaneAltBasliklar = hierarchyRows
      .filter(h => h.AnaBaslikNo === 4 && h.SeviyeNo === 2)
      .sort((a, b) => a.rowIndex - b.rowIndex);
    
    const ameliyathaneBaslik = ameliyathaneAltBasliklar.find(h => 
      h.Baslik && h.Baslik.toUpperCase().includes('AMELİYATHANE') && 
      !h.Baslik.toUpperCase().includes('DIŞI')
    );
    const ameliyathaneDisiBaslik = ameliyathaneAltBasliklar.find(h => 
      h.Baslik && h.Baslik.toUpperCase().includes('AMELİYATHANE') && 
      h.Baslik.toUpperCase().includes('DIŞI')
    );
    
    // Ana Başlık 4'ün işlemlerini kontrol et
    const anaBaslik4Islemler = processedRows.filter(r => r.AnaBaslikNo === 4);
    
    anaBaslik4Islemler.forEach(islem => {
      const islemAdi = (islem.IslemAdi || '').toLowerCase();
      
      // İşlem adından anla: "AMELİYATHANE" mi "AMELİYATHANE DIŞI" mı?
      // Eğer işlem adında "DIŞI" geçiyorsa AMELİYATHANE DIŞI'na bağla
      if (islemAdi.includes('dışı') || islemAdi.includes('disi')) {
        // AMELİYATHANE DIŞI alt başlığına bağlanacak
        // Bu işlem için rowIndex'i AMELİYATHANE DIŞI alt başlığının rowIndex'ine yakın yap
        // (HiyerarsiID ataması controller'da yapılacak, burada sadece işaretle)
        if (ameliyathaneDisiBaslik) {
          // İşlemin rowIndex'ini AMELİYATHANE DIŞI alt başlığının rowIndex'inden sonra yap
          // Böylece controller'da doğru HiyerarsiID atanacak
          // Burada sadece işaretleme yapıyoruz, gerçek atama controller'da
        }
      } else if (islemAdi.includes('ameliyathane') || islemAdi.includes('ameliyat')) {
        // AMELİYATHANE alt başlığına bağlanacak
        if (ameliyathaneBaslik) {
          // İşlemin rowIndex'ini AMELİYATHANE alt başlığının rowIndex'inden sonra yap
        }
      }
    });
  }
  
  // ÖZEL: Ana Başlık 9 için MİKROBİYOLOJİ alt başlığı oluştur
  // Excel'de Ana Başlık 9'un altında direkt 273 işlem var, bunlar MİKROBİYOLOJİ kategorisinde
  const anaBaslik9 = hierarchyRows.find(h => h.SeviyeNo === 1 && h.AnaBaslikNo === 9);
  if (anaBaslik9) {
    // Ana Başlık 9'un ilk alt başlığını bul
    const anaBaslik9AltBasliklar = hierarchyRows
      .filter(h => h.AnaBaslikNo === 9 && h.SeviyeNo > 1)
      .sort((a, b) => a.rowIndex - b.rowIndex);
    
    const ilkAltBaslik = anaBaslik9AltBasliklar[0];
    
    // Ana Başlık 9'un ilk işlemlerini bul
    const anaBaslik9Islemler = processedRows
      .filter(r => r.AnaBaslikNo === 9)
      .sort((a, b) => a.rowIndex - b.rowIndex);
    
    // İlk işlem ile ilk alt başlık arasında işlem var mı?
    if (ilkAltBaslik && anaBaslik9Islemler.length > 0) {
      const ilkIslem = anaBaslik9Islemler[0];
      const ilkIslemRowIndex = ilkIslem.rowIndex;
      const ilkAltBaslikRowIndex = ilkAltBaslik.rowIndex;
      
      // İlk işlem, ilk alt başlıktan önceyse (yani ana başlığa direkt bağlı)
      if (ilkIslemRowIndex < ilkAltBaslikRowIndex) {
        // Bu işlemleri say
        const anaBasligaDirektIslemler = anaBaslik9Islemler.filter(i => i.rowIndex < ilkAltBaslikRowIndex);
        
        if (anaBasligaDirektIslemler.length > 0) {
          // MİKROBİYOLOJİ alt başlığını oluştur
          const mikrobiyolojiBaslik = {
            AnaBaslikNo: 9,
            Baslik: 'MİKROBİYOLOJİ',
            TamBaslik: 'MİKROBİYOLOJİ',
            SeviyeNo: 2,
            ParentID: null, // Ana başlığa bağlı
            ParentRowIndex: anaBaslik9.rowIndex,
            Sira: 0, // İlk alt başlık
            rowIndex: anaBaslik9.rowIndex + 1 // Ana başlıktan hemen sonra
          };
          
          // Hiyerarşiye ekle (ilk alt başlıktan önce)
          const ilkAltBaslikIndex = hierarchyRows.findIndex(h => h.rowIndex === ilkAltBaslikRowIndex);
          if (ilkAltBaslikIndex >= 0) {
            hierarchyRows.splice(ilkAltBaslikIndex, 0, mikrobiyolojiBaslik);
          } else {
            // İlk alt başlık bulunamadı, en sona ekle
            hierarchyRows.push(mikrobiyolojiBaslik);
          }
        }
      }
    }
  }
  
  // Hem işlem satırları hem de hiyerarşi satırları dön
  return {
    data: processedRows,
    hierarchyRows: hierarchyRows
  };
};

module.exports = {
  parseSutExcel,
  validateSutData,
  normalizeSutData,
  extractDateFromFilename
};

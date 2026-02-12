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
    
    // Başlık satırı bulunamadıysa uyarı ver ama devam et (ilk satırı kullan)
    if (headerRowIndex === 0 && maxHeaderSearchRows > 0) {
      console.warn(`⚠️ Başlık satırı otomatik bulunamadı, ilk satır kullanılıyor`);
    }
    
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
const parseTurkishDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  
  return new Date(year, month - 1, day);
};

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
// Hiyerarşi yapısını parse et
// Pattern: SutKodu boş + IslemAdi dolu = Hiyerarşi satırı
// Örnek: ["", "1. YATAK PUANLARI", "", ""]
// ============================================
parseHierarchy = (data) => {
  const sourceData = (data[0] && data[0].SutKodu !== undefined) ? data : normalizeColumnNames(data);

  const hierarchyRows = [];
  let currentAnaBaslikNo = 0;
  let currentAnaBaslik = null;
  let lastHierarchy = null; // Son eklenen hiyerarşi node'u
  let sira = 0;

  sourceData.forEach((row, index) => {
    const hasSutKodu = row.SutKodu && row.SutKodu !== null && row.SutKodu !== '';
    const hasIslemAdi = row.IslemAdi && row.IslemAdi !== null && row.IslemAdi !== '';

    // Hiyerarşi satırı: SutKodu yok ama IslemAdi var
    if (!hasSutKodu && hasIslemAdi) {
      const islemAdi = row.IslemAdi.toString().replace(/[\r\n]+/g, ' ').trim();
      const numberMatch = islemAdi.match(/^(\d+)\.\s*(.+)/);

      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        const baslik = numberMatch[2].trim();
        const hasSubIndicator = /^[A-Z0-9]+\./.test(baslik);

        if (number >= 1 && number <= 10 && !hasSubIndicator) {
          // Ana başlık (Seviye 1)
          currentAnaBaslikNo = number;
          currentAnaBaslik = {
            AnaBaslikNo: currentAnaBaslikNo,
            Baslik: baslik,
            SeviyeNo: 1,
            ParentID: null,
            ParentRowIndex: null,
            Sira: ++sira,
            rowIndex: index
          };
          hierarchyRows.push(currentAnaBaslik);
          lastHierarchy = currentAnaBaslik;
        } else {
          // Alt başlık - son hiyerarşiye bağla
          if (lastHierarchy) {
            const newNode = {
              AnaBaslikNo: currentAnaBaslikNo,
              Baslik: islemAdi,
              SeviyeNo: lastHierarchy.SeviyeNo + 1,
              ParentID: null, // Veritabanı ID'si sonra atanacak
              ParentRowIndex: lastHierarchy.rowIndex, // Excel'deki parent satır numarası
              Sira: ++sira,
              rowIndex: index
            };
            hierarchyRows.push(newNode);
            lastHierarchy = newNode;
          }
        }
      } else {
        // Numara yok - alt başlık, son hiyerarşiye bağla
        if (lastHierarchy) {
          const newNode = {
            AnaBaslikNo: currentAnaBaslikNo,
            Baslik: islemAdi,
            SeviyeNo: lastHierarchy.SeviyeNo + 1,
            ParentID: null, // Veritabanı ID'si sonra atanacak
            ParentRowIndex: lastHierarchy.rowIndex, // Excel'deki parent satır numarası
            Sira: ++sira,
            rowIndex: index
          };
          hierarchyRows.push(newNode);
          lastHierarchy = newNode;
        }
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
  
  console.log(`📊 Hiyerarşi parse edildi: ${hierarchyRows.length} başlık bulundu`);
  hierarchyRows.slice(0, 5).forEach(h => {
    console.log(`   - [Seviye ${h.SeviyeNo}] ${h.Baslik} (AnaBaslikNo: ${h.AnaBaslikNo})`);
  });
  
  // İşlem satırlarını işle ve ana başlık numarasını ata
  let currentAnaBaslikNo = null;
  const hierarchyMap = {};
  
  // Hiyerarşi map'i oluştur (rowIndex -> AnaBaslikNo)
  hierarchyRows.forEach(h => {
    if (h.SeviyeNo === 1) {
      hierarchyMap[h.rowIndex] = h.AnaBaslikNo;
    }
  });
  
  const processedRows = sourceData
    .map((row, index) => {
      // Hiyerarşi satırlarını atla
      if (!row.SutKodu || row.SutKodu === null || row.SutKodu === '') {
        // Ana başlık güncelle
        const hierarchy = hierarchyRows.find(h => h.rowIndex === index);
        if (hierarchy && hierarchy.SeviyeNo === 1) {
          currentAnaBaslikNo = hierarchy.AnaBaslikNo;
        }
        return null;
      }
      
      // İşlem satırı
      return {
        row,
        index,
        anaBaslikNo: currentAnaBaslikNo
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
      HiyerarsiID: row.HiyerarsiID ? parseInt(row.HiyerarsiID) : null
    };
  });
  
  console.log(`✅ ${processedRows.length} işlem satırı normalize edildi`);
  
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
  parseHierarchy, // Export et
  extractDateFromFilename,
  parseTurkishDate
};

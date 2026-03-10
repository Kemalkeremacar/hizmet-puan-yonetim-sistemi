// ============================================
// EXCEL PARSER SERVICE
// ============================================
// Excel dosyalarını parse etme ve validate etme
// Türkçe karakter desteği ile
// ============================================

const XLSX = require('xlsx');
const { fixTurkishEncoding } = require('../utils/turkishCharFix');
const { getPool, sql } = require('../config/database');

// ============================================
// Dosya adından tarihi çıkar
// Örnek: "07.10.2025.xls" → "2025-10-07"
// Örnek: "05.02.2026.xlsx" → "2026-02-06"
// ============================================
const extractDateFromFilename = (filename) => {
  try {
    // Dosya adından tarihi çıkar (GG.AA.YYYY formatı)
    const match = filename.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      // YYYY-MM-DD formatına çevir
      return `${year}-${month}-${day}`;
    }
    return null;
  } catch (err) {
    return null;
  }
};

// ============================================
// Excel dosyasını oku ve parse et
// Türkçe karakter encoding'i düzelt
// ============================================
const parseHuvExcel = (filePath) => {
  try {
    // Excel dosyasını oku - Türkçe karakter desteği için codepage ayarı
    const workbook = XLSX.readFile(filePath, {
      type: 'buffer',
      codepage: 65001, // UTF-8
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    // İlk sheet'i al
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON'a çevir - Türkçe karakterleri koru
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // String olarak oku
      defval: null, // Boş hücreler null
      blankrows: false // Boş satırları atla
    });
    
    // Türkçe karakterleri düzelt (eğer bozuksa)
    const fixedData = data.map(row => {
      const fixed = {};
      for (const key in row) {
        const value = row[key];
        if (typeof value === 'string') {
          // Türkçe karakterleri düzelt
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
      sheetName: sheetName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// Sayı parse fonksiyonu (Türkçe locale desteği ile)
// ============================================
const parseNumber = (value) => {
  if (typeof value === 'number') return value;
  if (!value && value !== 0) return null;
  
  // String ise virgülü noktaya çevir (Türkçe format)
  const str = value.toString().replace(',', '.');
  const num = parseFloat(str);
  
  return isNaN(num) ? null : num;
};

// ============================================
// Türkçe tarih formatını parse et (DD.MM.YYYY -> Date)
// Geliştirilmiş versiyon: Date object, Excel serial date ve string formatlarını destekler
// ============================================
const parseTurkishDate = (dateValue) => {
  if (!dateValue) return null;
  
  // Date object ise direkt kullan
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Excel serial date (number) ise
  if (typeof dateValue === 'number') {
    // Excel serial date'i JavaScript Date'e çevir
    // Excel epoch: 1900-01-01, JavaScript epoch: 1970-01-01
    // 25569 = days between 1900-01-01 and 1970-01-01
    return new Date((dateValue - 25569) * 86400 * 1000);
  }
  
  // String ise parse et
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    
    // DD.MM.YYYY formatı
    const parts = trimmed.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
          return new Date(year, month - 1, day);
        }
      }
    }
    
    // ISO formatı (YYYY-MM-DD)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(trimmed + 'T00:00:00'); // Local timezone
    }
    
    // Diğer formatları dene
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
};

// ============================================
// Türkçe karakter encoding'ini düzelt
// ============================================
// NOT: Bu fonksiyon artık utils/turkishCharFix.js'den import ediliyor
// Burada sadece backward compatibility için bırakıldı
const fixTurkishEncodingLocal = (str) => {
  return fixTurkishEncoding(str);
};

// ============================================
// Kolon isimlerini normalize et (Excel -> DB)
// ESNEK EŞLEŞTİRME: Büyük/küçük harf duyarsız, boşluk toleransı
// ============================================
const normalizeColumnNames = (data) => {
  if (!data || data.length === 0) return [];
  
  // İlk satırdan kolon isimlerini al ve normalize et
  const firstRow = data[0];
  const actualColumns = Object.keys(firstRow);
  
  // Kolon eşleştirme map'i (esnek eşleştirme için)
  const columnMap = {
    'Huv Kodu': 'HuvKodu',
    'HuvKodu': 'HuvKodu',
    'HUV Kodu': 'HuvKodu',
    'HUVKODU': 'HuvKodu',
    'İşlem': 'IslemAdi',
    'Islem': 'IslemAdi',
    'İŞLEM': 'IslemAdi',
    'İşlem Adı': 'IslemAdi',
    'İşlem Adi': 'IslemAdi',
    'Birim': 'Birim',
    'BİRİM': 'Birim',
    'Bölüm': 'BolumAdi',
    'Bolum': 'BolumAdi',
    'BÖLÜM': 'BolumAdi',
    'Sut Kodu': 'SutKodu',
    'SutKodu': 'SutKodu',
    'SUT Kodu': 'SutKodu',
    'SUTKODU': 'SutKodu',
    'Güncelleme Tarihi': 'GuncellemeTarihi',
    'Guncelleme Tarihi': 'GuncellemeTarihi',
    'GÜNCELLEME TARİHİ': 'GuncellemeTarihi',
    'Ekleme Tarihi': 'EklemeTarihi',
    'EKLEME TARİHİ': 'EklemeTarihi',
    'Üst Başlık': 'UstBaslik',
    'Ust Baslik': 'UstBaslik',
    'ÜST BAŞLIK': 'UstBaslik',
    'Not': 'Not',
    'NOT': 'Not',
    'Açıklama Güncelleme Tarihi': 'AciklamaGuncellemeTarihi',
    'Açıklama Guncelleme Tarihi': 'AciklamaGuncellemeTarihi',
    'Durum': 'Durum',
    'DURUM': 'Durum',
    'Hiyerarşi Seviyesi': 'HiyerarsiSeviyesi',
    'Hiyerarsi Seviyesi': 'HiyerarsiSeviyesi',
    'HİYERARŞİ SEVİYESİ': 'HiyerarsiSeviyesi'
  };
  
  // Esnek kolon eşleştirme fonksiyonu (REGEX-BASED)
  const findColumnMatch = (excelColName) => {
    // Önce tam eşleşme
    if (columnMap[excelColName]) {
      return columnMap[excelColName];
    }
    
    // Normalize et (trim, lowercase, Türkçe karakter düzeltme)
    const normalized = fixTurkishEncoding(excelColName.trim());
    const lower = normalized.toLowerCase();
    
    // Esnek eşleştirme
    for (const [key, value] of Object.entries(columnMap)) {
      const keyNormalized = fixTurkishEncoding(key.trim().toLowerCase());
      if (keyNormalized === lower) {
        return value;
      }
    }
    
    // REGEX-BASED Güçlü Eşleştirme
    // HUV Kodu varyasyonları: "HUV-Kodu", "Huv_Kodu", "HuvKod", "HUV KODU" vs.
    if (/huv.*kod/i.test(normalized)) return 'HuvKodu';
    
    // İşlem Adı varyasyonları: "İşlem-Adı", "Islem_Adi", "İŞLEM ADI" vs.
    if (/işlem.*ad/i.test(normalized) || /islem.*ad/i.test(normalized)) return 'IslemAdi';
    if (/^işlem$/i.test(normalized) || /^islem$/i.test(normalized)) return 'IslemAdi';
    
    // Birim varyasyonları: "Birim-Fiyat", "BirimFiyat", "BİRİM" vs.
    if (/birim/i.test(normalized)) return 'Birim';
    
    // Bölüm varyasyonları: "Bölüm-Adı", "Bolum_Adi" vs.
    if (/bölüm/i.test(normalized) || /bolum/i.test(normalized)) return 'BolumAdi';
    
    // SUT Kodu varyasyonları: "SUT-Kodu", "Sut_Kodu" vs.
    if (/sut.*kod/i.test(normalized)) return 'SutKodu';
    
    // Güncelleme Tarihi varyasyonları: "Güncelleme-Tarihi", "Guncelleme_Tarih" vs.
    if ((/güncelleme/i.test(normalized) || /guncelleme/i.test(normalized)) && /tarih/i.test(normalized)) {
      return 'GuncellemeTarihi';
    }
    
    // Ekleme Tarihi varyasyonları
    if (/ekleme/i.test(normalized) && /tarih/i.test(normalized)) return 'EklemeTarihi';
    
    // Üst Başlık varyasyonları: "Üst-Başlık", "Ust_Baslik" vs.
    if ((/üst/i.test(normalized) || /ust/i.test(normalized)) && 
        (/başlık/i.test(normalized) || /baslik/i.test(normalized))) {
      return 'UstBaslik';
    }
    
    // Not/Açıklama varyasyonları
    if (/^not$/i.test(normalized) || /açıklama/i.test(normalized) || /aciklama/i.test(normalized)) {
      return 'Not';
    }
    
    // Hiyerarşi Seviyesi varyasyonları: "Hiyerarşi-Seviyesi", "Hiyerarsi_Seviye" vs.
    if ((/hiyerarşi/i.test(normalized) || /hiyerarsi/i.test(normalized)) && 
        /seviye/i.test(normalized)) {
      return 'HiyerarsiSeviyesi';
    }
    
    // Durum varyasyonları
    if (/^durum$/i.test(normalized)) return 'Durum';
    
    return null;
  };
  
  // Kolon mapping'i oluştur (bir kere hesapla, tüm satırlarda kullan)
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
        // Eşleşmeyen kolonları da ekle (ileride kullanılabilir)
        normalized[`_${excelCol}`] = row[excelCol];
      }
    }
    
    return normalized;
  });
};

// ============================================
// HUV verilerini validate et (Geliştirilmiş)
// ============================================
const validateHuvData = (data) => {
  const errors = [];
  const warnings = [];
  const validData = [];
  
  // Kolon isimlerini önce normalize et (esnek eşleştirme için)
  const normalizedData = normalizeColumnNames(data);
  
  // Gerekli kolonları kontrol et (normalize edilmiş veri üzerinde)
  const requiredColumns = ['HuvKodu', 'IslemAdi'];
  
  if (normalizedData.length > 0) {
    const firstRow = normalizedData[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow) || firstRow[col] === undefined || firstRow[col] === null);
    
    if (missingColumns.length > 0) {
      // Orijinal Excel kolonlarını bul
      const originalColumns = Object.keys(data[0] || {});
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
  const seenHuvKodlari = new Set();
  
  normalizedData.forEach((row, index) => {
    const rowErrors = [];
    const rowWarnings = [];
    const rowNumber = index + 2; // Excel'de 1. satır başlık
    
    // 1. HuvKodu kontrolü (zorunlu)
    if (!row.HuvKodu && row.HuvKodu !== 0) {
      rowErrors.push({
        field: 'HuvKodu',
        message: 'HuvKodu alanı boş olamaz',
        type: 'ZORUNLU_ALAN'
      });
    }
    
    // 2. IslemAdi kontrolü (zorunlu)
    if (!row.IslemAdi) {
      rowErrors.push({
        field: 'IslemAdi',
        message: 'İşlem adı boş olamaz',
        type: 'ZORUNLU_ALAN'
      });
    }
    
    // 2. HuvKodu validasyonu
    if (row.HuvKodu) {
      const huvKodu = row.HuvKodu.toString().trim();
      
      // Boş mu?
      if (huvKodu === '') {
        rowErrors.push({
          field: 'HuvKodu',
          message: 'HuvKodu boş olamaz',
          type: 'BOS_ALAN'
        });
      }
      // Sayı formatında mı?
      else if (isNaN(parseFloat(huvKodu))) {
        rowErrors.push({
          field: 'HuvKodu',
          message: 'HuvKodu sayı formatında olmalı',
          type: 'FORMAT_HATASI'
        });
      }
      // Duplicate var mı? (CASE-INSENSITIVE)
      else {
        const normalizedHuvKodu = huvKodu.toLowerCase();
        if (seenHuvKodlari.has(normalizedHuvKodu)) {
          rowErrors.push({
            field: 'HuvKodu',
            message: `HuvKodu tekrar ediyor: ${huvKodu}`,
            type: 'DUPLICATE'
          });
        } else {
          seenHuvKodlari.add(normalizedHuvKodu);
        }
      }
      
      // Çok uzun mu?
      if (huvKodu.length > 50) {
        rowWarnings.push({
          field: 'HuvKodu',
          message: 'HuvKodu çok uzun (max 50 karakter)',
          type: 'UZUNLUK_UYARI'
        });
      }
    }
    
    // 3. IslemAdi validasyonu
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
      
      if (islemAdi.length > 500) {
        rowErrors.push({
          field: 'IslemAdi',
          message: 'İşlem adı çok uzun (max 500 karakter)',
          type: 'UZUNLUK_HATASI'
        });
      }
    }
    
    // 4. Birim validasyonu
    if (row.Birim !== undefined && row.Birim !== null) {
      const birim = parseFloat(row.Birim);
      
      if (isNaN(birim)) {
        rowErrors.push({
          field: 'Birim',
          message: 'Birim sayı formatında olmalı',
          type: 'FORMAT_HATASI'
        });
      } else {
        // Negatif mi?
        if (birim < 0) {
          rowErrors.push({
            field: 'Birim',
            message: 'Birim negatif olamaz',
            type: 'DEGER_HATASI'
          });
        }
        
        // Çok büyük mü?
        if (birim > 999999) {
          rowWarnings.push({
            field: 'Birim',
            message: 'Birim değeri çok büyük',
            type: 'DEGER_UYARI'
          });
        }
        
        // Sıfır mı?
        if (birim === 0) {
          rowWarnings.push({
            field: 'Birim',
            message: 'Birim değeri sıfır',
            type: 'DEGER_UYARI'
          });
        }
      }
    }
    
    // 5. Opsiyonel alanlar
    if (row.SutKodu && row.SutKodu.toString().length > 50) {
      rowWarnings.push({
        field: 'SutKodu',
        message: 'SutKodu çok uzun',
        type: 'UZUNLUK_UYARI'
      });
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
    normalizedData: normalizedData, // Normalize edilmiş veriyi de döndür
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
// HUV verisini normalize et (veritabanı formatına çevir)
// Türkçe karakterleri koru
// ============================================
const normalizeHuvData = async (data) => {
  // Eğer data zaten normalize edilmişse direkt kullan, değilse normalize et
  const sourceData = (data[0] && data[0].HuvKodu !== undefined) ? data : normalizeColumnNames(data);
  
  // Ana dal mapping'i için veritabanından çek
  const { getPool } = require('../config/database');
  const pool = await getPool();
  const anaDallarResult = await pool.request().query('SELECT AnaDalKodu, BolumAdi FROM AnaDallar');
  
  // Ana dal map'i oluştur (sadece kontrol için)
  const anaDalMap = {};
  anaDallarResult.recordset.forEach(ad => {
    anaDalMap[ad.AnaDalKodu] = ad.BolumAdi;
  });

  return sourceData.map(row => {
    // String alanları temizle ve Türkçe karakterleri düzelt
    const cleanString = (value) => {
      if (!value) return null;
      const str = value.toString().trim();
      return str === '' ? null : fixTurkishEncoding(str);
    };
    
    // HUV kodundan Ana Dal kodunu çıkar (tam sayı kısmı)
    // Örnek: 12.34567 -> 12, 0.12345 -> 0, 34.56789 -> 34
    const huvKodu = parseNumber(row.HuvKodu) || 0;
    const anaDalKodu = Math.floor(huvKodu);
    
    // Ana Dal kontrolü
    if (!anaDalMap[anaDalKodu]) {
      console.warn(`⚠️ Ana dal bulunamadı: AnaDalKodu=${anaDalKodu} (HUV: ${huvKodu})`);
    }
    
    // Tarihleri parse et (DD.MM.YYYY formatı)
    const parseDate = (dateStr) => {
      const parsed = parseTurkishDate(dateStr);
      return parsed; // Date object veya null
    };
    
    // Hiyerarşi seviyesini hesapla (UstBaslik'teki → sayısından)
    const calculateHiyerarsiSeviyesi = (ustBaslik) => {
      if (!ustBaslik || ustBaslik.trim() === '') return 0;
      // → sayısını say
      const arrowCount = (ustBaslik.match(/→/g) || []).length;
      return arrowCount + 1; // → sayısı + 1 = seviye
    };
    
    return {
      HuvKodu: parseNumber(row.HuvKodu) || 0,
      IslemAdi: cleanString(row.IslemAdi) || '',
      Birim: parseNumber(row.Birim),
      SutKodu: cleanString(row.SutKodu),
      AnaDalKodu: anaDalKodu, // HUV kodunun tam sayı kısmı
      BolumAdi: cleanString(row.BolumAdi), // Sadece bilgi amaçlı
      UstBaslik: cleanString(row.UstBaslik),
      HiyerarsiSeviyesi: calculateHiyerarsiSeviyesi(row.UstBaslik),
      Not: cleanString(row.Not),
      GuncellemeTarihi: parseDate(row.GuncellemeTarihi),
      EklemeTarihi: parseDate(row.EklemeTarihi)
    };
  });
};

module.exports = {
  parseHuvExcel,
  validateHuvData,
  normalizeHuvData,
  extractDateFromFilename, // Yeni fonksiyon
  fixTurkishEncoding, // Export from utils
  parseTurkishDate, // Export et
  parseNumber // Yeni fonksiyon
};

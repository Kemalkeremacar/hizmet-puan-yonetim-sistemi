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
// Türkçe tarih formatını parse et (DD.MM.YYYY -> Date)
// ============================================
const parseTurkishDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // DD.MM.YYYY formatı
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  
  // JavaScript Date (month 0-indexed)
  return new Date(year, month - 1, day);
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
// ============================================
const normalizeColumnNames = (data) => {
  return data.map(row => {
    const normalized = {};
    
    // Kolon eşleştirmeleri (Excel'deki gerçek kolonlar)
    const columnMap = {
      'Huv Kodu': 'HuvKodu',
      'İşlem': 'IslemAdi',
      'Birim': 'Birim',
      'Bölüm': 'BolumAdi',
      'Sut Kodu': 'SutKodu',
      'Güncelleme Tarihi': 'GuncellemeTarihi',
      'Ekleme Tarihi': 'EklemeTarihi',
      'Üst Başlık': 'UstBaslik',
      'Not': 'Not',
      'Açıklama Güncelleme Tarihi': 'AciklamaGuncellemeTarihi',
      'Durum': 'Durum',
      'Hiyerarşi Seviyesi': 'HiyerarsiSeviyesi'
    };
    
    // Her kolonu eşleştir
    for (const [excelCol, dbCol] of Object.entries(columnMap)) {
      if (row[excelCol] !== undefined) {
        normalized[dbCol] = row[excelCol];
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
  
  // Gerekli kolonlar (Excel formatında)
  const requiredColumns = ['Huv Kodu', 'İşlem'];
  
  // İlk satırda kolonları kontrol et
  if (data.length > 0) {
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return {
        valid: false,
        validData: [],
        errors: [{
          row: 0,
          type: 'KOLON_EKSIK',
          message: `Gerekli kolonlar eksik: ${missingColumns.join(', ')}`,
          severity: 'critical'
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
  
  // Kolon isimlerini normalize et
  const normalizedData = normalizeColumnNames(data);
  
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
      // Duplicate var mı?
      else if (seenHuvKodlari.has(huvKodu)) {
        rowErrors.push({
          field: 'HuvKodu',
          message: `HuvKodu tekrar ediyor: ${huvKodu}`,
          type: 'DUPLICATE'
        });
      } else {
        seenHuvKodlari.add(huvKodu);
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
  // Eğer data zaten normalize edilmişse direkt kullan
  const sourceData = data[0] && data[0].HuvKodu !== undefined ? data : normalizeColumnNames(data);
  
  // Ana dal mapping'i için veritabanından çek
  const { getPool } = require('../config/database');
  const pool = await getPool();
  const anaDallarResult = await pool.request().query('SELECT AnaDalKodu, BolumAdi FROM AnaDallar');
  
  // Ana dal map'i oluştur (sadece kontrol için)
  const anaDalMap = {};
  anaDallarResult.recordset.forEach(ad => {
    anaDalMap[ad.AnaDalKodu] = ad.BolumAdi;
  });
  
  console.log(`📋 Ana Dal sayısı: ${anaDallarResult.recordset.length}`);
  
  return sourceData.map(row => {
    // String alanları temizle ve Türkçe karakterleri düzelt
    const cleanString = (value) => {
      if (!value) return null;
      const str = value.toString().trim();
      return str === '' ? null : fixTurkishEncoding(str);
    };
    
    // HUV kodundan Ana Dal kodunu çıkar (tam sayı kısmı)
    // Örnek: 12.34567 -> 12, 0.12345 -> 0, 34.56789 -> 34
    const huvKodu = parseFloat(row.HuvKodu);
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
      HuvKodu: huvKodu,
      IslemAdi: cleanString(row.IslemAdi) || '',
      Birim: row.Birim !== undefined && row.Birim !== null && row.Birim !== '' ? parseFloat(row.Birim) : null,
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
  parseTurkishDate // Export et
};

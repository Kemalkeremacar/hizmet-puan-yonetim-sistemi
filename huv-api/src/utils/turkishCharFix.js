// ============================================
// TURKISH CHARACTER FIX UTILITY
// ============================================
// Backend'de Türkçe karakter düzeltme
// SQL Server'dan gelen bozuk karakterleri düzelt
// ============================================

const he = require('he');

/**
 * HTML entity'leri decode et
 * @param {string} str - Decode edilecek string
 * @returns {string} Decode edilmiş string
 */
const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  try {
    // he kütüphanesi ile decode et
    return he.decode(str);
  } catch (err) {
    // Hata durumunda orijinal string'i döndür
    console.warn('HTML entity decode hatası:', err.message);
    return str;
  }
};

/**
 * Bozuk karakter kontrolü - Performans için önce kontrol et
 * @param {string} str - Kontrol edilecek string
 * @returns {boolean} Bozuk karakter var mı?
 */
const needsTurkishCharFix = (str) => {
  if (!str || typeof str !== 'string') return false;
  // Bozuk karakterleri hızlıca kontrol et
  return /[ÄÅÃâ]/.test(str);
};

/**
 * Türkçe karakter encoding'ini düzelt
 * @param {string} str - Düzeltilecek string
 * @returns {string} Düzeltilmiş string
 */
const fixTurkishEncoding = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  // Önce HTML entity'leri decode et
  let fixed = decodeHtmlEntities(str);
  
  // Performans: Bozuk karakter kontrolü
  if (!needsTurkishCharFix(fixed)) return fixed.trim();
  
  // Windows-1254 -> UTF-8 dönüşümü
  fixed = fixed
    .replace(/Ä°/g, 'İ')
    .replace(/Ä±/g, 'ı')
    .replace(/Åž/g, 'Ş')
    .replace(/ÅŸ/g, 'ş')
    .replace(/Ä/g, 'Ğ')
    .replace(/Ä/g, 'ğ')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ã§/g, 'ç')
    // Diğer bozuk karakterler
    .replace(/â†'/g, '→')
    .replace(/â€"/g, '–')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"');
  
  return fixed.trim();
};

/**
 * Object/Array içindeki tüm string'leri düzelt
 * PERFORMANS OPTİMİZE EDİLMİŞ
 * @param {*} obj - Düzeltilecek obje
 * @param {number} depth - Recursive depth (sonsuz döngü önleme)
 * @returns {*} Düzeltilmiş obje
 */
const fixTurkishCharsInObject = (obj, depth = 0) => {
  // Null/undefined kontrolü
  if (obj === null || obj === undefined) return obj;
  
  // Max depth kontrolü (sonsuz döngü önleme)
  if (depth > 10) return obj;
  
  // String ise düzelt
  if (typeof obj === 'string') {
    return fixTurkishEncoding(obj);
  }
  
  // Array ise - Performans: Sample kontrolü
  if (Array.isArray(obj)) {
    if (obj.length === 0) return obj;
    
    // İlk 3 elemanı kontrol et
    const sampleSize = Math.min(3, obj.length);
    let hasBrokenChars = false;
    
    for (let i = 0; i < sampleSize; i++) {
      const item = obj[i];
      if (typeof item === 'string' && needsTurkishCharFix(item)) {
        hasBrokenChars = true;
        break;
      } else if (typeof item === 'object' && item !== null) {
        const values = Object.values(item);
        if (values.some(v => typeof v === 'string' && needsTurkishCharFix(v))) {
          hasBrokenChars = true;
          break;
        }
      }
    }
    
    // Bozuk karakter yoksa olduğu gibi döndür
    if (!hasBrokenChars) return obj;
    
    // Bozuk karakter varsa tümünü düzelt
    return obj.map(item => fixTurkishCharsInObject(item, depth + 1));
  }
  
  // Object ise - Sadece string değerleri düzelt
  if (typeof obj === 'object') {
    const fixed = {};
    let hasChanges = false;
    
    for (const key in obj) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        if (needsTurkishCharFix(value)) {
          fixed[key] = fixTurkishEncoding(value);
          hasChanges = true;
        } else {
          fixed[key] = value;
        }
      } else if (value !== null && typeof value === 'object') {
        fixed[key] = fixTurkishCharsInObject(value, depth + 1);
      } else {
        fixed[key] = value;
      }
    }
    
    // Hiç değişiklik yoksa orijinal objeyi döndür
    return hasChanges ? fixed : obj;
  }
  
  return obj;
};

/**
 * SQL Server collation kontrolü
 * @param {object} pool - SQL Server connection pool
 * @returns {Promise<object>} Collation bilgisi
 */
const checkDatabaseCollation = async (pool) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS DatabaseCollation,
        SERVERPROPERTY('Collation') AS ServerCollation
    `);
    
    const collation = result.recordset[0];
    
    // Turkish_CI_AS kullanılıyor mu kontrol et
    const isTurkishCollation = 
      collation.DatabaseCollation?.includes('Turkish') ||
      collation.ServerCollation?.includes('Turkish');
    
    return {
      database: collation.DatabaseCollation,
      server: collation.ServerCollation,
      isTurkish: isTurkishCollation,
      needsFix: !isTurkishCollation
    };
  } catch (error) {
    return {
      database: 'Unknown',
      server: 'Unknown',
      isTurkish: false,
      needsFix: true
    };
  }
};

/**
 * Sayı parse fonksiyonu (Türkçe locale desteği ile)
 * @param {*} value - Parse edilecek değer
 * @returns {number|null} Parse edilmiş sayı veya null
 */
const parseNumber = (value) => {
  if (typeof value === 'number') return value;
  if (!value && value !== 0) return null;
  
  // String ise virgülü noktaya çevir (Türkçe format)
  const str = value.toString().replace(',', '.');
  const num = parseFloat(str);
  
  return isNaN(num) ? null : num;
};

module.exports = {
  needsTurkishCharFix,
  fixTurkishEncoding,
  fixTurkishCharsInObject,
  checkDatabaseCollation,
  decodeHtmlEntities,
  parseNumber
};

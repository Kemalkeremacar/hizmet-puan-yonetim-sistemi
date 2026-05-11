// ============================================
// STRING UTILITIES
// ============================================
// Türkçe karakter desteği ve string işlemleri
// ============================================

/**
 * String'i normalize eder (Türkçe karakter encoding sorunları için)
 * API'den gelen bozuk Türkçe karakterleri düzeltir
 * 
 * @param {string} str - Normalize edilecek string
 * @returns {string} - Normalize edilmiş string
 * 
 * @example
 * normalizeString("GENEL İLKELER") // "GENEL ILKELER"
 * normalizeString("GENEL ??LKELER") // "GENEL ILKELER"
 */
export const normalizeString = (str) => {
  if (!str) return '';
  
  return str
    .trim()
    .toUpperCase()
    .normalize('NFD') // Unicode normalization (decompose)
    .replace(/[\u0300-\u036f]/g, '') // Diacritics (aksanlar) kaldır
    .replace(/İ/g, 'I') // Türkçe İ
    .replace(/I/g, 'I') // Latin I
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\?/g, ''); // Bozuk karakterleri temizle
};


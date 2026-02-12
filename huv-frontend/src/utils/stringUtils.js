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

/**
 * İki string'i normalize ederek karşılaştırır
 * Türkçe karakter encoding sorunlarından etkilenmez
 * 
 * @param {string} str1 - İlk string
 * @param {string} str2 - İkinci string
 * @returns {boolean} - Eşit mi?
 * 
 * @example
 * compareStrings("GENEL İLKELER", "GENEL ??LKELER") // true
 */
export const compareStrings = (str1, str2) => {
  return normalizeString(str1) === normalizeString(str2);
};

/**
 * String'in içinde arama yapar (normalize edilmiş)
 * 
 * @param {string} haystack - Aranacak string
 * @param {string} needle - Aranan string
 * @returns {boolean} - İçeriyor mu?
 * 
 * @example
 * searchInString("GENEL İLKELER", "ilke") // true
 */
export const searchInString = (haystack, needle) => {
  return normalizeString(haystack).includes(normalizeString(needle));
};

/**
 * Array içinde string arar (normalize edilmiş)
 * 
 * @param {Array} array - Aranacak array
 * @param {string} searchTerm - Aranan terim
 * @param {string} key - Object array ise hangi key'de aranacak
 * @returns {Array} - Bulunan elemanlar
 * 
 * @example
 * filterArray([{name: "GENEL İLKELER"}], "ilke", "name") // [{name: "GENEL İLKELER"}]
 */
export const filterArray = (array, searchTerm, key = null) => {
  if (!searchTerm) return array;
  
  const normalizedSearch = normalizeString(searchTerm);
  
  return array.filter(item => {
    const value = key ? item[key] : item;
    return normalizeString(value).includes(normalizedSearch);
  });
};

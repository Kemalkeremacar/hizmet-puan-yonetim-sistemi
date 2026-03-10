// ============================================
// TEXT UTILITY FONKSİYONLARI
// ============================================
// Metin işleme ve HTML entity decode fonksiyonları
// ============================================

/**
 * HTML entity'leri decode et (Frontend fallback)
 * @param {string} str - Decode edilecek string
 * @returns {string} Decode edilmiş string
 */
export const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  try {
    // DOM API kullanarak decode et
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  } catch (err) {
    // Hata durumunda manuel decode
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Türkçe karakterler
      .replace(/&ccedil;/g, 'ç')
      .replace(/&Ccedil;/g, 'Ç')
      .replace(/&ouml;/g, 'ö')
      .replace(/&Ouml;/g, 'Ö')
      .replace(/&uuml;/g, 'ü')
      .replace(/&Uuml;/g, 'Ü')
      .replace(/&idot;/g, 'İ')
      .replace(/&inodot;/g, 'ı')
      .replace(/&gbreve;/g, 'ğ')
      .replace(/&Gbreve;/g, 'Ğ')
      .replace(/&scedil;/g, 'ş')
      .replace(/&Scedil;/g, 'Ş')
      // Numeric entities
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
};

/**
 * Metni güvenli şekilde göster (HTML entity decode + XSS koruması)
 * @param {string} str - Gösterilecek metin
 * @returns {string} Güvenli metin
 */
export const safeDisplayText = (str) => {
  if (!str) return '';
  
  // Önce HTML entity'leri decode et
  const decoded = decodeHtmlEntities(str);
  
  // XSS koruması için HTML tag'lerini escape et
  return decoded
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Uzun metni kısalt
 * @param {string} text - Kısaltılacak metin
 * @param {number} maxLength - Maksimum uzunluk
 * @returns {string} Kısaltılmış metin
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Metindeki boşlukları normalize et
 * @param {string} text - Normalize edilecek metin
 * @returns {string} Normalize edilmiş metin
 */
export const normalizeWhitespace = (text) => {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Türkçe karakterleri İngilizce karşılıklarına çevir (arama için)
 * @param {string} text - Çevrilecek metin
 * @returns {string} Çevrilmiş metin
 */
export const turkishToEnglish = (text) => {
  if (!text) return '';
  
  const turkishChars = {
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'İ': 'I',
    'ö': 'o', 'Ö': 'O',
    'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U'
  };
  
  return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, char => turkishChars[char] || char);
};

/**
 * Metin içinde arama terimi vurgula
 * @param {string} text - Ana metin
 * @param {string} searchTerm - Arama terimi
 * @returns {string} Vurgulanmış metin (HTML)
 */
export const highlightSearchTerm = (text, searchTerm) => {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};
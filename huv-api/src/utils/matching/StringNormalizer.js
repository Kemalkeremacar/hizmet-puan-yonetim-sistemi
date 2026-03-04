// ============================================
// STRING NORMALIZER UTILITY
// ============================================
// Ortak string normalizasyon fonksiyonları
// Tüm matching stratejilerinde kullanılır
// ============================================

/**
 * String Normalizer Utility Class
 * Provides common string normalization functions for matching strategies
 */
class StringNormalizer {
  
  /**
   * Normalize string for keyword matching
   * Converts Turkish characters to English equivalents and normalizes
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  static normalizeForKeywords(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ıİ]/g, 'i')
      .trim();
  }
  
  /**
   * Get first letter from text, skipping numbers and special characters
   * @param {string} text - Text to extract first letter from
   * @returns {string|null} First letter or null
   */
  static getFirstLetter(text) {
    if (!text) return null;
    
    // Türkçe karakterleri İngilizce'ye çevir
    const normalized = this.normalizeForKeywords(text);
    
    // Find first alphabetic character
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (char >= 'a' && char <= 'z') {
        return char;
      }
    }
    
    return null;
  }
  
  /**
   * Normalize string for similarity calculation
   * Same as SimilarityCalculator.normalizeString but centralized
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  static normalizeForSimilarity(str) {
    if (!str) return '';
    
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ıİ]/g, 'i')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Check if text contains any of the given keywords
   * @param {string} text - Text to check
   * @param {Array<string>} keywords - Keywords to search for
   * @returns {boolean} True if any keyword is found
   */
  static containsAnyKeyword(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return false;
    
    const normalized = this.normalizeForKeywords(text);
    return keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
  }
  
  /**
   * Check if text contains all of the given keywords
   * @param {string} text - Text to check
   * @param {Array<string>} keywords - Keywords to search for
   * @returns {boolean} True if all keywords are found
   */
  static containsAllKeywords(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return false;
    
    const normalized = this.normalizeForKeywords(text);
    return keywords.every(keyword => normalized.includes(keyword.toLowerCase()));
  }
}

module.exports = StringNormalizer;
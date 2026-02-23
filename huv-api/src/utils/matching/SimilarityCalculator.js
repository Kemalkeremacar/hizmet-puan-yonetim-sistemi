// ============================================
// SIMILARITY CALCULATOR
// ============================================
// Turkish language-aware string similarity calculator
// Uses Jaro-Winkler distance algorithm
// ============================================

class SimilarityCalculator {
  /**
   * Calculate similarity between two strings using Jaro-Winkler algorithm
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0.0 and 1.0
   */
  static calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0.0;
    
    // Normalize strings (preserve Turkish characters)
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    // Calculate Jaro similarity
    const jaroSim = this.jaroSimilarity(s1, s2);
    
    // Calculate common prefix length (max 4)
    let prefixLen = 0;
    const maxPrefix = Math.min(4, s1.length, s2.length);
    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) {
        prefixLen++;
      } else {
        break;
      }
    }
    
    // Jaro-Winkler similarity with scaling factor p = 0.1
    const p = 0.1;
    return jaroSim + (prefixLen * p * (1 - jaroSim));
  }
  
  /**
   * Normalize string for comparison
   * - Convert to lowercase
   * - Trim whitespace
   * - Replace multiple spaces with single space
   * - Preserve Turkish characters (ç, ğ, ı, ö, ş, ü)
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  static normalizeString(str) {
    if (!str) return '';
    
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Check if first letters match (Turkish-aware)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {boolean} True if first letters match
   */
  static firstLetterMatch(str1, str2) {
    if (!str1 || !str2) return false;
    
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1.length === 0 || s2.length === 0) return false;
    
    return s1[0] === s2[0];
  }
  
  /**
   * Calculate Jaro similarity between two strings
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Jaro similarity score between 0.0 and 1.0
   */
  static jaroSimilarity(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;
    
    // Maximum allowed distance for matching characters
    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchDistance < 0) return 0.0;
    
    // Arrays to track matched characters
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0.0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    
    // Calculate Jaro similarity
    return (
      (matches / len1 +
        matches / len2 +
        (matches - transpositions / 2) / matches) /
      3
    );
  }
}

module.exports = SimilarityCalculator;

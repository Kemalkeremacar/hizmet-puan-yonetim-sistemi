// ============================================
// MATCHING STRATEGY INTERFACE
// ============================================
// Base interface for all matching strategies
// Each strategy implements different matching logic
// based on Ana Dal (medical specialty)
// ============================================

/**
 * Base class for matching strategies
 * All concrete strategies must extend this class
 */
class MatchingStrategy {
  /**
   * Match a SUT işlem with HUV teminatlar
   * @param {Object} sutIslem - SUT işlem object { sutId, islemAdi, anaDalKodu }
   * @param {Array} huvList - Array of HUV teminat objects { altTeminatId, altTeminatAdi }
   * @returns {Object} Match result { matched: boolean, altTeminatId?: number, confidence?: number, ruleType: string }
   */
  match(sutIslem, huvList) {
    throw new Error('match() must be implemented by subclass');
  }
  
  /**
   * Calculate confidence score based on similarity
   * @param {number} similarity - Similarity score (0.0 to 1.0)
   * @returns {number} Confidence score (0 to 100)
   */
  calculateConfidence(similarity) {
    throw new Error('calculateConfidence() must be implemented by subclass');
  }
  
  /**
   * Get the rule type identifier for this strategy
   * @returns {string} Rule type identifier
   */
  getRuleType() {
    throw new Error('getRuleType() must be implemented by subclass');
  }
}

module.exports = MatchingStrategy;

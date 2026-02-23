// ============================================
// SURGICAL SIMILARITY MATCHING STRATEGY
// ============================================
// Strategy for Cerrahi Uygulamalar (Surgical Procedures)
// Matches based on similarity threshold
// ============================================

const MatchingStrategy = require('./MatchingStrategy');
const SimilarityCalculator = require('../../utils/matching/SimilarityCalculator');

/**
 * Surgical Similarity Matching Strategy
 * Used for Cerrahi Uygulamalar (Surgical Procedures)
 * 
 * Algorithm:
 * 1. Calculate similarity with all HUV teminatlar
 * 2. Select best match above 0.6 threshold
 * 3. Calculate confidence score: similarity * 100
 */
class SurgicalSimilarityStrategy extends MatchingStrategy {
  constructor() {
    super();
    this.threshold = 0.70; // Minimum %70 benzerlik - diğer stratejilerle uyumlu
  }
  
  /**
   * Match SUT işlem with HUV teminatlar using surgical similarity strategy
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvList - Array of HUV teminat objects
   * @returns {Object} Match result
   */
  match(sutIslem, huvList) {
    if (!sutIslem || !sutIslem.islemAdi || !huvList || huvList.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate similarity with all HUV teminatlar
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const huv of huvList) {
      const similarity = SimilarityCalculator.calculateSimilarity(
        sutIslem.islemAdi,
        huv.altTeminatAdi
      );
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = huv;
      }
    }
    
    // Check if best match exceeds threshold
    if (bestSimilarity < this.threshold) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(bestSimilarity);
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType()
    };
  }
  
  /**
   * Calculate confidence score for surgical similarity strategy
   * Formula: similarity * 100
   * Range: 0-100 (but only matches above threshold are returned)
   * @param {number} similarity - Similarity score (0.0 to 1.0)
   * @returns {number} Confidence score (0 to 100)
   */
  calculateConfidence(similarity) {
    return similarity * 100;
  }
  
  /**
   * Get rule type identifier
   * @returns {string} 'surgical_similarity'
   */
  getRuleType() {
    return 'surgical_similarity';
  }
}

module.exports = SurgicalSimilarityStrategy;

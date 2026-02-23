// ============================================
// RADIOLOGY KEYWORD MATCHING STRATEGY
// ============================================
// Strategy for Radyolojik Görüntüleme (Radiology Imaging)
// Matches based on "Radyoloji" keyword filtering
// ============================================

const MatchingStrategy = require('./MatchingStrategy');
const SimilarityCalculator = require('../../utils/matching/SimilarityCalculator');

/**
 * Radiology Keyword Matching Strategy
 * Used for Radyolojik Görüntüleme (Radiology Imaging)
 * 
 * Algorithm:
 * 1. Filter HUV teminatlar containing "Radyoloji" keyword
 * 2. Calculate similarity with filtered list
 * 3. Select best match above 0.5 threshold
 * 4. Calculate confidence score: 70 + (similarity * 30)
 * 5. Fallback to general similarity if no match found
 */
class RadiologyKeywordStrategy extends MatchingStrategy {
  constructor() {
    super();
    this.threshold = 0.5;
    this.keyword = 'radyoloji';
  }
  
  /**
   * Match SUT işlem with HUV teminatlar using radiology keyword strategy
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvList - Array of HUV teminat objects
   * @returns {Object} Match result
   */
  match(sutIslem, huvList) {
    if (!sutIslem || !sutIslem.islemAdi || !huvList || huvList.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Filter by "Radyoloji" keyword
    const filtered = huvList.filter(huv => 
      huv.altTeminatAdi.toLowerCase().includes(this.keyword)
    );
    
    // If no filtered results, fallback to general similarity
    if (filtered.length === 0) {
      return this.fallbackToGeneralSimilarity(sutIslem, huvList);
    }
    
    // Calculate similarity with filtered list
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const huv of filtered) {
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
      // Fallback to general similarity
      return this.fallbackToGeneralSimilarity(sutIslem, huvList);
    }
    
    // Calculate confidence score: 70-100 based on similarity
    const confidence = this.calculateConfidence(bestSimilarity);
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType()
    };
  }
  
  /**
   * Fallback to general similarity matching
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvList - Array of HUV teminat objects
   * @returns {Object} Match result
   */
  fallbackToGeneralSimilarity(sutIslem, huvList) {
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
    
    if (bestSimilarity < this.threshold) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    const confidence = this.calculateConfidence(bestSimilarity);
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType()
    };
  }
  
  /**
   * Calculate confidence score for radiology keyword strategy
   * Formula: 70 + (similarity * 30)
   * Range: 70-100
   * @param {number} similarity - Similarity score (0.0 to 1.0)
   * @returns {number} Confidence score (70 to 100)
   */
  calculateConfidence(similarity) {
    return 70 + (similarity * 30);
  }
  
  /**
   * Get rule type identifier
   * @returns {string} 'radiology_keyword'
   */
  getRuleType() {
    return 'radiology_keyword';
  }
}

module.exports = RadiologyKeywordStrategy;

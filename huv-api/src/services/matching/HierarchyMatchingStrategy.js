// ============================================
// HIERARCHY MATCHING STRATEGY
// ============================================
// Strategy for matching based on SUT hierarchy titles
// Uses SUT işlem's hierarchy (Seviye 2-3) to match with HUV alt teminat names
// ============================================

const MatchingStrategy = require('./MatchingStrategy');
const SimilarityCalculator = require('../../utils/matching/SimilarityCalculator');

/**
 * Hierarchy Matching Strategy
 * Matches SUT işlem hierarchy titles with HUV alt teminat names
 * 
 * Algorithm:
 * 1. Get SUT işlem's hierarchy (Seviye 2 and Seviye 3)
 * 2. Calculate similarity between hierarchy titles and HUV alt teminat names
 * 3. Select best match above threshold (70%)
 * 4. Return confidence score
 */
class HierarchyMatchingStrategy extends MatchingStrategy {
  constructor(dbPool) {
    super();
    this.dbPool = dbPool;
    this.threshold = 0.70; // Minimum %70 benzerlik
  }
  
  /**
   * Get hierarchy titles for a SUT işlem
   * @param {Object} sutIslem - SUT işlem object with hiyerarsiId
   * @returns {Promise<Array>} Array of hierarchy titles [Seviye2, Seviye3]
   */
  async getHierarchyTitles(sutIslem) {
    if (!sutIslem.hiyerarsiId) {
      return [];
    }
    
    try {
      const result = await this.dbPool.request()
        .input('hiyerarsiId', sutIslem.hiyerarsiId)
        .query(`
          -- Get current level and parent levels
          WITH HierarchyCTE AS (
            SELECT 
              HiyerarsiID,
              ParentID,
              SeviyeNo,
              Baslik,
              0 as Level
            FROM SutHiyerarsi
            WHERE HiyerarsiID = @hiyerarsiId
            
            UNION ALL
            
            SELECT 
              h.HiyerarsiID,
              h.ParentID,
              h.SeviyeNo,
              h.Baslik,
              cte.Level + 1
            FROM SutHiyerarsi h
            INNER JOIN HierarchyCTE cte ON h.HiyerarsiID = cte.ParentID
            WHERE cte.Level < 3
          )
          SELECT 
            SeviyeNo,
            Baslik
          FROM HierarchyCTE
          WHERE Baslik IS NOT NULL
            AND SeviyeNo >= 2
          ORDER BY SeviyeNo
        `);
      
      return result.recordset.map(r => r.Baslik);
      
    } catch (error) {
      console.error('Error in getHierarchyTitles:', error);
      return [];
    }
  }
  
  /**
   * Match SUT işlem with HUV teminatlar using hierarchy strategy
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvList - Array of HUV teminat objects
   * @returns {Promise<Object>} Match result
   */
  async match(sutIslem, huvList) {
    if (!sutIslem || !huvList || huvList.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Get hierarchy titles
    const hierarchyTitles = await this.getHierarchyTitles(sutIslem);
    
    if (hierarchyTitles.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate similarity with all HUV teminatlar
    let bestMatch = null;
    let bestScore = 0;
    
    for (const huv of huvList) {
      // Try each hierarchy title
      for (const hierarchyTitle of hierarchyTitles) {
        const similarity = SimilarityCalculator.calculateSimilarity(
          hierarchyTitle,
          huv.altTeminatAdi
        );
        
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = huv;
        }
      }
    }
    
    // Check if best match exceeds threshold
    if (bestScore < this.threshold) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate confidence score (70-95 based on similarity)
    const confidence = 70 + (bestScore * 25);
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType()
    };
  }
  
  /**
   * Get rule type identifier
   * @returns {string} 'hierarchy_matching'
   */
  getRuleType() {
    return 'hierarchy_matching';
  }
}

module.exports = HierarchyMatchingStrategy;

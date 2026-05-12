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
    this.threshold = 0.80; // Minimum %80 benzerlik
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
   * @param {Map|null} hierarchyCache - Pre-loaded hierarchy cache (hiyerarsiId → titles[])
   * @returns {Promise<Object>} Match result
   */
  async match(sutIslem, huvList, hierarchyCache = null) {
    if (!sutIslem || !huvList || huvList.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Use cache if available, otherwise query DB
    let hierarchyTitles;
    if (hierarchyCache && sutIslem.hiyerarsiId) {
      hierarchyTitles = hierarchyCache.get(sutIslem.hiyerarsiId) || [];
    } else {
      hierarchyTitles = await this.getHierarchyTitles(sutIslem);
    }
    
    if (hierarchyTitles.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate similarity with all HUV teminatlar
    let bestMatch = null;
    let bestScore = 0;
    let bestTitle = '';
    
    for (const huv of huvList) {
      for (const hierarchyTitle of hierarchyTitles) {
        const similarity = SimilarityCalculator.calculateSimilarity(
          hierarchyTitle,
          huv.altTeminatAdi
        );
        
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = huv;
          bestTitle = hierarchyTitle;
        }
      }
    }
    
    if (bestScore < this.threshold) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    if (bestScore < 0.95 && bestMatch) {
      const wordOverlap = this._calculateWordOverlap(bestTitle, bestMatch.altTeminatAdi);
      if (wordOverlap < 0.30) {
        return { matched: false, ruleType: this.getRuleType() };
      }
    }
    
    const confidence = bestScore * 100;
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType()
    };
  }
  
  _calculateWordOverlap(str1, str2) {
    const normalize = (s) => SimilarityCalculator.normalizeString(s);
    const words1 = normalize(str1).split(/\s+/).filter(w => w.length > 2);
    const words2 = normalize(str2).split(/\s+/).filter(w => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return 0;

    const matched1 = new Set();
    const matched2 = new Set();

    for (let i = 0; i < words1.length; i++) {
      for (let j = 0; j < words2.length; j++) {
        if (matched2.has(j)) continue;
        if (this._wordsMatch(words1[i], words2[j])) {
          matched1.add(i);
          matched2.add(j);
          break;
        }
      }
    }

    const uniqueWords = new Set([...words1, ...words2]).size;
    return matched1.size / uniqueWords;
  }

  _wordsMatch(w1, w2) {
    if (w1 === w2) return true;
    const shorter = w1.length <= w2.length ? w1 : w2;
    const longer = w1.length > w2.length ? w1 : w2;
    if (shorter.length >= 4 && longer.startsWith(shorter)) return true;
    let common = 0;
    const limit = Math.min(w1.length, w2.length);
    for (let i = 0; i < limit; i++) {
      if (w1[i] === w2[i]) common++;
      else break;
    }
    if (common >= 4 && common / shorter.length >= 0.70) return true;
    if (shorter.length >= 4) {
      const sim = SimilarityCalculator.jaroSimilarity(w1, w2);
      let prefixLen = 0;
      const maxPfx = Math.min(4, w1.length, w2.length);
      for (let i = 0; i < maxPfx; i++) {
        if (w1[i] === w2[i]) prefixLen++;
        else break;
      }
      const winkler = sim + (prefixLen * 0.1 * (1 - sim));
      if (winkler >= 0.85) return true;
    }
    return false;
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

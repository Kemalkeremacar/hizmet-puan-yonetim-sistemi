// ============================================
// DIRECT SUT CODE MATCHING STRATEGY
// ============================================
// Strategy for direct SUT code matching
// When HUV işlem has a SutKodu, match directly
// ============================================

const MatchingStrategy = require('./MatchingStrategy');

/**
 * Direct SUT Code Matching Strategy
 * Used when HUV işlem contains the exact SUT code
 * 
 * Algorithm:
 * 1. Query HuvIslemler for matching SutKodu
 * 2. If found, return the AltTeminatID from HuvIslemler
 * 3. This is a 100% confidence match
 * 
 * Priority: HIGHEST (should be checked first)
 */
class DirectSutCodeStrategy extends MatchingStrategy {
  constructor(dbPool) {
    super();
    this.dbPool = dbPool;
  }
  
  /**
   * Match SUT işlem with HUV teminat using direct SUT code lookup
   * @param {Object} sutIslem - SUT işlem object with sutKodu
   * @param {Array} huvList - Array of HUV teminat objects (not used, we query directly)
   * @returns {Promise<Object>} Match result
   */
  async match(sutIslem, huvList) {
    if (!sutIslem || !sutIslem.sutKodu) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    try {
      // Query HuvIslemler for matching SutKodu
      const result = await this.dbPool.request()
        .input('sutKodu', sutIslem.sutKodu)
        .query(`
          SELECT TOP 1
            h.AltTeminatID,
            h.IslemAdi as HuvIslemAdi,
            a.AltTeminatAdi
          FROM HuvIslemler h
          INNER JOIN HuvAltTeminatlar a ON h.AltTeminatID = a.AltTeminatID
          WHERE h.SutKodu = @sutKodu 
            AND h.AktifMi = 1
            AND a.AktifMi = 1
        `);
      
      if (result.recordset.length === 0) {
        return { matched: false, ruleType: this.getRuleType() };
      }
      
      const match = result.recordset[0];
      
      return {
        matched: true,
        altTeminatId: match.AltTeminatID,
        confidence: 100.0, // %100 güven - direkt SUT kodu eşleşmesi
        ruleType: this.getRuleType(),
        huvIslemAdi: match.HuvIslemAdi // Debug için
      };
      
    } catch (error) {
      console.error('Error in DirectSutCodeStrategy:', error);
      return { matched: false, ruleType: this.getRuleType() };
    }
  }
  
  /**
   * Get rule type identifier
   * @returns {string} 'direct_sut_code'
   */
  getRuleType() {
    return 'direct_sut_code';
  }
}

module.exports = DirectSutCodeStrategy;

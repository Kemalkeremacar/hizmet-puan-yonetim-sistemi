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
   * Match SUT işlem with HUV teminat using direct SUT code lookup.
   * Finds a HUV işlem sharing the same SUT code, then resolves its
   * AltTeminat via UstBaslik hierarchy + AnaDalKodu.
   * @param {Object} sutIslem - SUT işlem object with sutKodu
   * @param {Array} huvList - not used
   * @returns {Promise<Object>} Match result
   */
  async match(sutIslem, huvList) {
    if (!sutIslem || !sutIslem.sutKodu) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    try {
      const result = await this.dbPool.request()
        .input('sutKodu', sutIslem.sutKodu)
        .query(`
          SELECT
            h.IslemID,
            h.IslemAdi as HuvIslemAdi,
            h.UstBaslik,
            h.AnaDalKodu
          FROM HuvIslemler h
          WHERE h.SutKodu = @sutKodu 
            AND h.AktifMi = 1
        `);
      
      if (result.recordset.length === 0) {
        return { matched: false, ruleType: this.getRuleType() };
      }
      
      for (const huvIslem of result.recordset) {
        const altTeminatId = await this._resolveAltTeminat(
          huvIslem.UstBaslik,
          huvIslem.AnaDalKodu
        );
        
        if (altTeminatId) {
          return {
            matched: true,
            altTeminatId,
            confidence: 100.0,
            ruleType: this.getRuleType(),
            huvIslemAdi: huvIslem.HuvIslemAdi
          };
        }
      }
      
      return { matched: false, ruleType: this.getRuleType() };
      
    } catch (error) {
      console.error('Error in DirectSutCodeStrategy:', error);
      return { matched: false, ruleType: this.getRuleType() };
    }
  }
  
  /**
   * Resolve AltTeminatID from a HUV işlem's UstBaslik hierarchy path.
   * Tries each segment from last to first (skipping segment 0 which is the
   * Ana Dal name) until a matching AltTeminat is found.
   * Example: "ANESTEZİYOLOJİ→ALGOLOJİ/AĞRI TEDAVİSİ→ENJEKSİYONLAR"
   *   tries: ENJEKSİYONLAR → ALGOLOJİ/AĞRI TEDAVİSİ → (stops, found)
   */
  async _resolveAltTeminat(ustBaslik, anaDalKodu) {
    if (!ustBaslik) return null;
    
    const segments = ustBaslik.split('→').map(s => s.trim());
    
    for (let i = segments.length - 1; i >= 1; i--) {
      const candidate = segments[i];
      if (!candidate) continue;
      
      try {
        const result = await this.dbPool.request()
          .input('altTeminatAdi', candidate)
          .input('anaDalKodu', anaDalKodu)
          .query(`
            SELECT TOP 1 AltTeminatID
            FROM HuvAltTeminatlar
            WHERE AltTeminatAdi = @altTeminatAdi
              AND AnaDalKodu = @anaDalKodu
              AND AktifMi = 1
          `);
        
        if (result.recordset.length > 0) {
          return result.recordset[0].AltTeminatID;
        }
      } catch (error) {
        console.error('Error resolving AltTeminat:', error);
      }
    }
    
    return null;
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

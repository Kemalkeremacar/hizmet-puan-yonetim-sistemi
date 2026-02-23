// ============================================
// STATISTICS SERVICE
// ============================================
// Service for calculating matching statistics
// Provides comprehensive statistics and reporting
// ============================================

const sql = require('mssql');

/**
 * Statistics Service
 * Calculates and provides matching statistics
 */
class StatisticsService {
  constructor(dbPool) {
    this.dbPool = dbPool;
  }
  
  /**
   * Get comprehensive matching statistics
   * @returns {Promise<Object>} Matching statistics
   */
  async getMatchingStats() {
    try {
      // Query total SUT işlemler count
      const totalResult = await this.dbPool.request().query(`
        SELECT COUNT(*) as total
        FROM SutIslemler
        WHERE AktifMi = 1
      `);
      const totalSutIslemler = totalResult.recordset[0].total;
      
      // Query matched count
      const matchedResult = await this.dbPool.request().query(`
        SELECT COUNT(*) as matched
        FROM AltTeminatIslemler
      `);
      const matchedCount = matchedResult.recordset[0].matched;
      
      // Calculate matched percentage
      const matchedPercentage = totalSutIslemler > 0 
        ? (matchedCount / totalSutIslemler) * 100 
        : 0;
      
      // Query confidence distribution
      const confidenceResult = await this.dbPool.request().query(`
        SELECT 
          SUM(CASE WHEN ConfidenceScore < 70 THEN 1 ELSE 0 END) as low,
          SUM(CASE WHEN ConfidenceScore >= 70 AND ConfidenceScore < 85 THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN ConfidenceScore >= 85 THEN 1 ELSE 0 END) as high
        FROM AltTeminatIslemler
        WHERE ConfidenceScore IS NOT NULL
      `);
      const confidenceDistribution = {
        low: confidenceResult.recordset[0].low || 0,
        medium: confidenceResult.recordset[0].medium || 0,
        high: confidenceResult.recordset[0].high || 0
      };
      
      // Query counts by MatchingRuleType
      const ruleTypeResult = await this.dbPool.request().query(`
        SELECT 
          SUM(CASE WHEN MatchingRuleType = 'direct_sut_code' THEN 1 ELSE 0 END) as direct_sut_code,
          SUM(CASE WHEN MatchingRuleType = 'hierarchy_matching' THEN 1 ELSE 0 END) as hierarchy_matching,
          SUM(CASE WHEN MatchingRuleType = 'first_letter' THEN 1 ELSE 0 END) as first_letter,
          SUM(CASE WHEN MatchingRuleType = 'surgical_similarity' THEN 1 ELSE 0 END) as surgical_similarity,
          SUM(CASE WHEN MatchingRuleType = 'radiology_keyword' THEN 1 ELSE 0 END) as radiology_keyword,
          SUM(CASE WHEN MatchingRuleType = 'general_similarity' THEN 1 ELSE 0 END) as general_similarity
        FROM AltTeminatIslemler
        WHERE MatchingRuleType IS NOT NULL
      `);
      const byRuleType = {
        direct_sut_code: ruleTypeResult.recordset[0].direct_sut_code || 0,
        hierarchy_matching: ruleTypeResult.recordset[0].hierarchy_matching || 0,
        first_letter: ruleTypeResult.recordset[0].first_letter || 0,
        surgical_similarity: ruleTypeResult.recordset[0].surgical_similarity || 0,
        radiology_keyword: ruleTypeResult.recordset[0].radiology_keyword || 0,
        general_similarity: ruleTypeResult.recordset[0].general_similarity || 0
      };
      
      // Query counts where IsApproved = false (needs review)
      const needsReviewResult = await this.dbPool.request().query(`
        SELECT COUNT(*) as needsReview
        FROM AltTeminatIslemler
        WHERE IsApproved = 0 OR IsApproved IS NULL
      `);
      const needsReview = needsReviewResult.recordset[0].needsReview || 0;
      
      // Query counts where IsApproved = true
      const approvedResult = await this.dbPool.request().query(`
        SELECT COUNT(*) as approved
        FROM AltTeminatIslemler
        WHERE IsApproved = 1
      `);
      const approved = approvedResult.recordset[0].approved || 0;
      
      // Query counts where IsOverridden = true (manual overrides)
      // Handle case where column might not exist yet
      let manualOverrides = 0;
      try {
        const overridesResult = await this.dbPool.request().query(`
          SELECT COUNT(*) as manualOverrides
          FROM AltTeminatIslemler
          WHERE IsOverridden = 1
        `);
        manualOverrides = overridesResult.recordset[0].manualOverrides || 0;
      } catch (error) {
        // Column might not exist yet - migration not run
        console.warn('IsOverridden column not found, defaulting to 0:', error.message);
      }
      
      return {
        totalIslemler: totalSutIslemler,
        matchedCount,
        matchedPercentage: Math.round(matchedPercentage * 100) / 100,
        unmatchedCount: totalSutIslemler - matchedCount,
        confidenceDistribution,
        matchesByRuleType: byRuleType,
        needsReviewCount: needsReview,
        approvedCount: approved,
        manualOverridesCount: manualOverrides
      };
      
    } catch (error) {
      console.error('Error in getMatchingStats:', error);
      throw error;
    }
  }
}

module.exports = StatisticsService;

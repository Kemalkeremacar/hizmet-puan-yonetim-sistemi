// ============================================
// MATCHING CONTROLLER
// ============================================
// API controller for SUT-HUV matching operations
// ============================================

const MatchingEngine = require('../services/matching/MatchingEngine');
const StatisticsService = require('../services/matching/StatisticsService');
const { success: successResponse, error: errorResponse, paginated: paginatedResponse } = require('../utils/response');
const { getPool } = require('../config/database');

/**
 * POST /api/matching/run-batch
 * Run batch matching operation
 */
exports.runBatch = async (req, res) => {
  try {
    const { batchSize, anaDalKodu, forceRematch } = req.body;
    
    // Validate input
    if (batchSize && (batchSize < 1 || batchSize > 10000)) {
      return errorResponse(res, 'Batch size must be between 1 and 10000', 400);
    }
    
    const pool = await getPool();
    const matchingEngine = new MatchingEngine(pool);
    
    const options = {
      batchSize: batchSize || 100,
      anaDalKodu: anaDalKodu || null,
      forceRematch: forceRematch || false
    };
    
    const result = await matchingEngine.runBatch(options);
    
    return successResponse(res, result, 'Batch matching completed');
    
  } catch (error) {
    console.error('Error in runBatch:', error);
    return errorResponse(res, 'An internal error occurred', 500);
  }
};

/**
 * GET /api/matching/results
 * Get matching results with filtering and pagination
 */
exports.getResults = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sutKodu,
      islemAdi,
      sutUstTeminat,
      sutAltTeminat,
      huvUstTeminat,
      huvAltTeminat,
      confidenceMin,
      confidenceMax,
    } = req.query;
    
    const pool = await getPool();
    
    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = {};
    
    if (sutKodu) {
      whereClause += ` AND s.SutKodu LIKE @sutKodu`;
      params.sutKodu = `%${sutKodu}%`;
    }
    
    if (islemAdi) {
      whereClause += ` AND s.IslemAdi LIKE @islemAdi`;
      params.islemAdi = `%${islemAdi}%`;
    }
    
    if (sutUstTeminat) {
      whereClause += ` AND ab.AnaBaslikAdi LIKE @sutUstTeminat`;
      params.sutUstTeminat = `%${sutUstTeminat}%`;
    }
    
    if (sutAltTeminat) {
      whereClause += ` AND sh.Baslik LIKE @sutAltTeminat`;
      params.sutAltTeminat = `%${sutAltTeminat}%`;
    }
    
    if (huvUstTeminat) {
      whereClause += ` AND ad.BolumAdi LIKE @huvUstTeminat`;
      params.huvUstTeminat = `%${huvUstTeminat}%`;
    }
    
    if (huvAltTeminat) {
      whereClause += ` AND h.AltTeminatAdi LIKE @huvAltTeminat`;
      params.huvAltTeminat = `%${huvAltTeminat}%`;
    }
    
    if (confidenceMin) {
      whereClause += ` AND a.ConfidenceScore >= @confidenceMin`;
      params.confidenceMin = parseFloat(confidenceMin);
    }
    
    if (confidenceMax) {
      whereClause += ` AND a.ConfidenceScore <= @confidenceMax`;
      params.confidenceMax = parseFloat(confidenceMax);
    }
    
    // Count total - separate request
    const countRequest = pool.request();
    Object.keys(params).forEach(key => {
      countRequest.input(key, params[key]);
    });
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM AltTeminatIslemler a
      INNER JOIN SutIslemler s ON a.SutID = s.SutID
      LEFT JOIN SutHiyerarsi sh ON s.HiyerarsiID = sh.HiyerarsiID
      LEFT JOIN SutAnaBasliklar ab ON s.AnaBaslikNo = ab.AnaBaslikNo
      INNER JOIN HuvAltTeminatlar h ON a.AltTeminatID = h.AltTeminatID
      LEFT JOIN AnaDallar ad ON h.AnaDalKodu = ad.AnaDalKodu
      ${whereClause}
    `;
    
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;
    
    // Get paginated results - separate request
    const dataRequest = pool.request();
    Object.keys(params).forEach(key => {
      dataRequest.input(key, params[key]);
    });
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    dataRequest.input('offset', offset);
    dataRequest.input('limit', parseInt(limit));
    
    const dataQuery = `
      SELECT 
        a.ID,
        a.SutID as sutId,
        s.SutKodu as sutKodu,
        s.IslemAdi as islemAdi,
        sh.Baslik as sutAltTeminatAdi,
        ab.AnaBaslikAdi as sutUstTeminatAdi,
        a.AltTeminatID as altTeminatId,
        h.AltTeminatAdi as altTeminatAdi,
        ad.BolumAdi as huvUstTeminatAdi,
        h.AnaDalKodu as huvAnaDalKodu,
        a.ConfidenceScore as confidenceScore,
        a.MatchingRuleType as matchingRuleType,
        a.IsAutomatic as isAutomatic,
        a.IsApproved as isApproved,
        a.CreatedAt as createdAt
      FROM AltTeminatIslemler a
      INNER JOIN SutIslemler s ON a.SutID = s.SutID
      LEFT JOIN SutHiyerarsi sh ON s.HiyerarsiID = sh.HiyerarsiID
      LEFT JOIN SutAnaBasliklar ab ON s.AnaBaslikNo = ab.AnaBaslikNo
      INNER JOIN HuvAltTeminatlar h ON a.AltTeminatID = h.AltTeminatID
      LEFT JOIN AnaDallar ad ON h.AnaDalKodu = ad.AnaDalKodu
      ${whereClause}
      ORDER BY a.CreatedAt DESC 
      OFFSET @offset ROWS 
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const result = await dataRequest.query(dataQuery);
    
    return paginatedResponse(res, result.recordset, page, limit, total);
    
  } catch (error) {
    console.error('Error in getResults:', error);
    return errorResponse(res, 'An internal error occurred', 500);
  }
};

/**
 * POST /api/matching/approve/:sutId
 * Approve an automatic match
 */
exports.approveMatch = async (req, res) => {
  try {
    const { sutId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return errorResponse(res, 'User ID is required', 400);
    }
    
    const pool = await getPool();
    const matchingEngine = new MatchingEngine(pool);
    const result = await matchingEngine.approveMatch(parseInt(sutId), userId);
    
    return successResponse(res, result, 'Match approved successfully');
    
  } catch (error) {
    console.error('Error in approveMatch:', error);
    if (error.message.includes('not found')) {
      return errorResponse(res, error.message, 404);
    }
    return errorResponse(res, 'An internal error occurred', 500);
  }
};

/**
 * PUT /api/matching/change/:sutId
 * Change match to a different HUV teminat
 */
exports.changeMatch = async (req, res) => {
  try {
    const { sutId } = req.params;
    const { newAltTeminatId, userId } = req.body;
    
    if (!newAltTeminatId) {
      return errorResponse(res, 'New alt teminat ID is required', 400);
    }
    
    if (!userId) {
      return errorResponse(res, 'User ID is required', 400);
    }
    
    const pool = await getPool();
    const matchingEngine = new MatchingEngine(pool);
    const result = await matchingEngine.changeMatch(
      parseInt(sutId),
      newAltTeminatId,
      userId
    );
    
    return successResponse(res, result, 'Match changed successfully');
    
  } catch (error) {
    console.error('Error in changeMatch:', error);
    if (error.message.includes('not found')) {
      return errorResponse(res, error.message, 404);
    }
    return errorResponse(res, 'An internal error occurred', 500);
  }
};

/**
 * GET /api/matching/huv-options/:sutId
 * Get available HUV teminat options for a SUT işlem
 */
exports.getHuvOptions = async (req, res) => {
  try {
    const { sutId } = req.params;
    const pool = await getPool();
    
    // Manuel eşleştirme için TÜM HUV teminatlarını getir
    // Kullanıcı arama yaparak bulacak
    const huvResult = await pool.request()
      .query(`
        SELECT 
          h.AltTeminatID as altTeminatId,
          h.AltTeminatAdi as altTeminatAdi,
          h.AnaDalKodu as anaDalKodu,
          a.BolumAdi as anaDalAdi
        FROM HuvAltTeminatlar h
        LEFT JOIN AnaDallar a ON h.AnaDalKodu = a.AnaDalKodu
        WHERE h.AktifMi = 1
        ORDER BY h.AnaDalKodu, h.Sira, h.AltTeminatAdi
      `);
    
    return successResponse(res, huvResult.recordset);
    
  } catch (error) {
    console.error('Error in getHuvOptions:', error);
    return errorResponse(res, 'An internal error occurred', 500);
  }
};

/**
 * GET /api/matching/stats
 * Get comprehensive matching statistics
 */
exports.getStats = async (req, res) => {
  try {
    const pool = await getPool();
    const statisticsService = new StatisticsService(pool);
    const stats = await statisticsService.getMatchingStats();
    
    return successResponse(res, stats);
    
  } catch (error) {
    console.error('Error in getStats:', error);
    return errorResponse(res, 'An internal error occurred', 500);
  }
};

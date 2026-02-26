// ============================================
// AI MATCHING CONTROLLER
// ============================================
// API endpoints for AI-powered matching
// AYRI TABLO KULLANIR - TEST AMAÇLI
// ============================================

const AIMatchingService = require('../services/ai/AIMatchingService');
const { success, error } = require('../utils/response');

const aiMatchingService = new AIMatchingService();

/**
 * GET /api/ai-matching/status
 * Check AI service status
 */
exports.getStatus = async (req, res, next) => {
  try {
    const status = await aiMatchingService.checkStatus();
    return success(res, status, 'AI servis durumu');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai-matching/match-single
 * Match a single SUT işlem using AI
 * Body: { sutId, limitHuvByAnaDal, temperature }
 */
exports.matchSingle = async (req, res, next) => {
  try {
    const { sutId, limitHuvByAnaDal, temperature } = req.body;
    
    if (!sutId) {
      return error(res, 'SUT ID gereklidir', 400);
    }
    
    const options = {
      limitHuvByAnaDal: limitHuvByAnaDal || false,
      temperature: temperature || 0.3
    };
    
    const result = await aiMatchingService.matchSingle(sutId, options);
    
    if (!result.success) {
      return error(res, result.error, 400);
    }
    
    return success(res, result, 'AI eşleştirme tamamlandı');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai-matching/match-batch
 * Match multiple SUT işlemler using AI
 * Body: { sutIds, limitHuvByAnaDal, temperature }
 */
exports.matchBatch = async (req, res, next) => {
  try {
    const { sutIds, limitHuvByAnaDal, temperature } = req.body;
    
    if (!sutIds || !Array.isArray(sutIds) || sutIds.length === 0) {
      return error(res, 'SUT ID listesi gereklidir', 400);
    }
    
    if (sutIds.length > 100) {
      return error(res, 'Maksimum 100 işlem aynı anda eşleştirilebilir', 400);
    }
    
    const options = {
      limitHuvByAnaDal: limitHuvByAnaDal || false,
      temperature: temperature || 0.3
    };
    
    const result = await aiMatchingService.matchBatch(sutIds, options);
    
    return success(res, result, 'Toplu AI eşleştirme tamamlandı');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai-matching/save
 * Save AI match to AIMatchingResults table (AYRI TABLO)
 * Body: { sutId, altTeminatId, confidence, reasoning, metadata }
 */
exports.saveMatch = async (req, res, next) => {
  try {
    const { sutId, altTeminatId, confidence, reasoning, metadata } = req.body;
    
    if (!sutId || !altTeminatId) {
      return error(res, 'SUT ID ve Alt Teminat ID gereklidir', 400);
    }
    
    if (confidence < 0 || confidence > 100) {
      return error(res, 'Güven skoru 0-100 arasında olmalıdır', 400);
    }
    
    const result = await aiMatchingService.saveMatch(
      sutId,
      altTeminatId,
      confidence,
      reasoning || 'AI eşleştirmesi',
      metadata || {},
      req.user?.id || null
    );
    
    return success(res, result, 'AI eşleştirmesi kaydedildi (test tablosuna)');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ai-matching/results
 * Get AI matching results from AIMatchingResults table
 * Query: { isApproved, isMigrated, page, limit }
 */
exports.getResults = async (req, res, next) => {
  try {
    const { isApproved, isMigrated, page = 1, limit = 50 } = req.query;
    
    const filters = {};
    if (isApproved !== undefined) filters.isApproved = isApproved === 'true';
    if (isMigrated !== undefined) filters.isMigrated = isMigrated === 'true';
    
    const result = await aiMatchingService.getAIResults(filters, parseInt(page), parseInt(limit));
    
    return success(res, result.data, 'AI eşleştirme sonuçları', result.pagination);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai-matching/approve/:id
 * Approve an AI match
 * Params: { id } - AI matching result ID
 */
exports.approveMatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return error(res, 'AI eşleştirme ID gereklidir', 400);
    }
    
    const result = await aiMatchingService.approveAIMatch(
      parseInt(id),
      req.user?.id || null
    );
    
    return success(res, result, 'AI eşleştirmesi onaylandı');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai-matching/migrate/:id
 * Migrate AI match to main table (AltTeminatIslemler)
 * Params: { id } - AI matching result ID
 */
exports.migrateToMain = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return error(res, 'AI eşleştirme ID gereklidir', 400);
    }
    
    const result = await aiMatchingService.migrateToMain(
      parseInt(id),
      req.user?.id || null
    );
    
    return success(res, result, 'AI eşleştirmesi ana tabloya taşındı');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ai-matching/validate
 * Validate an existing match using AI
 * Body: { sutId }
 */
exports.validateMatch = async (req, res, next) => {
  try {
    const { sutId } = req.body;
    
    if (!sutId) {
      return error(res, 'SUT ID gereklidir', 400);
    }
    
    const result = await aiMatchingService.validateMatch(sutId);
    
    if (!result.success) {
      return error(res, result.error, 400);
    }
    
    return success(res, result, 'Eşleştirme doğrulandı');
  } catch (err) {
    next(err);
  }
};

module.exports = exports;

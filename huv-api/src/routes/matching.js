// ============================================
// MATCHING ROUTES
// ============================================
// Routes for SUT-HUV automatic matching operations
// ============================================

const express = require('express');
const router = express.Router();
const {
  runBatch,
  getResults,
  approveMatch,
  changeMatch,
  getHuvOptions,
  getStats
} = require('../controllers/matchingController');

// POST /api/matching/run-batch - Run batch matching operation
router.post('/run-batch', runBatch);

// GET /api/matching/results - Get matching results with filtering and pagination
router.get('/results', getResults);

// POST /api/matching/approve/:sutId - Approve an automatic match
router.post('/approve/:sutId', approveMatch);

// PUT /api/matching/change/:sutId - Change match to a different HUV teminat
router.put('/change/:sutId', changeMatch);

// GET /api/matching/huv-options/:sutId - Get available HUV teminat options for a SUT işlem
router.get('/huv-options/:sutId', getHuvOptions);

// GET /api/matching/stats - Get comprehensive matching statistics
router.get('/stats', getStats);

module.exports = router;

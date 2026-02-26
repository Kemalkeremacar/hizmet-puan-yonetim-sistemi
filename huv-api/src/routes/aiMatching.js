// ============================================
// AI MATCHING ROUTES
// ============================================
// Routes for AI-powered SUT-HUV matching
// ============================================

const express = require('express');
const router = express.Router();
const aiMatchingController = require('../controllers/aiMatchingController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/ai-matching/status - Check AI service status
router.get('/status', aiMatchingController.getStatus);

// POST /api/ai-matching/match-single - Match single SUT işlem
router.post('/match-single', aiMatchingController.matchSingle);

// POST /api/ai-matching/match-batch - Match multiple SUT işlemler
router.post('/match-batch', aiMatchingController.matchBatch);

// POST /api/ai-matching/save - Save AI match to database
router.post('/save', aiMatchingController.saveMatch);

// GET /api/ai-matching/results - Get AI matching results
router.get('/results', aiMatchingController.getResults);

// POST /api/ai-matching/approve/:id - Approve AI match
router.post('/approve/:id', aiMatchingController.approveMatch);

// POST /api/ai-matching/migrate/:id - Migrate to main table
router.post('/migrate/:id', aiMatchingController.migrateToMain);

// POST /api/ai-matching/validate - Validate existing match
router.post('/validate', aiMatchingController.validateMatch);

module.exports = router;

// ============================================
// IMPORT ROUTES
// ============================================
// Endpoint: /api/admin/import
// ============================================

const express = require('express');
const router = express.Router();
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
  importHuvList,
  getImportHistory,
  previewImport,
  getImportReport
} = require('../controllers/importController');

// ============================================
// POST /api/admin/import/huv
// HUV listesini Excel'den yükle
// Body: multipart/form-data (file)
// ============================================
router.post('/huv', uploadSingle, importHuvList);

// ============================================
// POST /api/admin/import/sut
// SUT listesini Excel'den yükle
// Body: multipart/form-data (file)
// ============================================
router.post('/sut', uploadSingle, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'SUT import özelliği henüz aktif değil. Yakında eklenecek.'
  });
});

// ============================================
// POST /api/admin/import/preview
// Excel önizleme ve karşılaştırma (dry-run)
// Body: multipart/form-data (file)
// ============================================
router.post('/preview', uploadSingle, previewImport);

// ============================================
// GET /api/admin/import/history
// Import geçmişini listele
// Query: page, limit
// ============================================
router.get('/history', getImportHistory);

// ============================================
// GET /api/admin/import/report/:versionId
// Import detaylı rapor
// ============================================
router.get('/report/:versionId', getImportReport);

module.exports = router;

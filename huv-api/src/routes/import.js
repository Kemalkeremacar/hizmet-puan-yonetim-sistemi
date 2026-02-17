// ============================================
// IMPORT ROUTES
// ============================================
// Endpoint: /api/admin/import
// ============================================

const express = require('express');
const router = express.Router();
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { importLock, checkImportStatus } = require('../middleware/importLock');
const {
  importHuvList,
  getImportHistory,
  previewImport,
  getImportReport
} = require('../controllers/importController');

// ============================================
// GET /api/admin/import/status
// Import durumunu kontrol et (lock var mı?)
// ============================================
router.get('/status', checkImportStatus);

// ============================================
// POST /api/admin/import/huv
// HUV listesini Excel'den yükle
// Body: multipart/form-data (file)
// LOCK: Aynı anda sadece 1 import
// ============================================
router.post('/huv', uploadSingle, importLock, importHuvList);

// ============================================
// POST /api/admin/import/sut
// SUT listesini Excel'den yükle
// Body: multipart/form-data (file)
// LOCK: Aynı anda sadece 1 import
// ============================================
const { importSutList, previewSutImport } = require('../controllers/sutImportController');
router.post('/sut', uploadSingle, importLock, importSutList);

// ============================================
// POST /api/admin/import/sut/preview
// SUT Excel önizleme ve karşılaştırma (dry-run)
// Body: multipart/form-data (file)
// ============================================
router.post('/sut/preview', uploadSingle, previewSutImport);

// ============================================
// POST /api/admin/import/il-katsayi
// İl katsayılarını Excel'den yükle
// Body: multipart/form-data (file)
// LOCK: Aynı anda sadece 1 import
// ============================================
const { importIlKatsayiList, previewIlKatsayiImport } = require('../controllers/ilKatsayiImportController');
router.post('/il-katsayi', uploadSingle, importLock, importIlKatsayiList);

// ============================================
// POST /api/admin/import/il-katsayi/preview
// İl katsayıları Excel önizleme ve karşılaştırma (dry-run)
// Body: multipart/form-data (file)
// ============================================
router.post('/il-katsayi/preview', uploadSingle, previewIlKatsayiImport);

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

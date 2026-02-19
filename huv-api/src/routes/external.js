// ============================================
// EXTERNAL API ROUTES
// ============================================
// Dış servisler için HUV ve SUT listeleri
// Endpoint: /api/external
// ============================================

const express = require('express');
const router = express.Router();
const {
  getHuvList,
  getSutList,
  getIlKatsayiList
} = require('../controllers/externalController');

// GET /api/external/huv
router.get('/huv', getHuvList);

// GET /api/external/sut
router.get('/sut', getSutList);

// GET /api/external/il-katsayi
router.get('/il-katsayi', getIlKatsayiList);

module.exports = router;

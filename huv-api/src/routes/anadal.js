// ============================================
// ANA DALLAR ROUTES
// ============================================
// Endpoint: /api/anadal
// ============================================

const express = require('express');
const router = express.Router();
const {
  getAnaDallar,
  getAnaDalByKod,
  getAnaDalIslemler
} = require('../controllers/anadalController');

// ============================================
// GET /api/anadal
// Tüm ana dalları listele
// ============================================
router.get('/', getAnaDallar);

// ============================================
// GET /api/anadal/:kod
// Ana dal detayı + istatistikler
// Param: kod (int) - Ana dal kodu
// ============================================
router.get('/:kod', getAnaDalByKod);

// ============================================
// GET /api/anadal/:kod/islemler
// Ana dala ait işlemler (sayfalı)
// Param: kod (int) - Ana dal kodu
// Query: page, limit
// ============================================
router.get('/:kod/islemler', getAnaDalIslemler);

module.exports = router;

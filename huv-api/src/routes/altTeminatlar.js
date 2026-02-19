// ============================================
// ALT TEMİNATLAR ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const { 
  getAltTeminatlar,
  searchSutIslemler,
  getAltTeminatIslemler,
  addAltTeminatIslem,
  removeAltTeminatIslem
} = require('../controllers/altTeminatController');

// GET /api/alt-teminatlar - Tüm alt teminatları listele
router.get('/', getAltTeminatlar);

// GET /api/alt-teminatlar/sut-islemler - SUT işlemlerini ara
router.get('/sut-islemler', searchSutIslemler);

// GET /api/alt-teminatlar/:id/islemler - Alt teminata atanmış işlemleri getir
router.get('/:id/islemler', getAltTeminatIslemler);

// POST /api/alt-teminatlar/:id/islemler - Alt teminata işlem ata
router.post('/:id/islemler', addAltTeminatIslem);

// DELETE /api/alt-teminatlar/:id/islemler/:sutId - Alt teminattan işlem kaldır
router.delete('/:id/islemler/:sutId', removeAltTeminatIslem);

module.exports = router;

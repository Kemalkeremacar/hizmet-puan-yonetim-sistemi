// ============================================
// SUT ROUTES
// ============================================
// SUT kodları endpoint'leri
// ============================================

const express = require('express');
const router = express.Router();
const sutController = require('../controllers/sutController');

// ============================================
// Routes
// ============================================

// Ana başlıklar (1-10)
router.get('/ana-basliklar', sutController.getAnaBasliklar);

// Ana başlık detayı
router.get('/ana-baslik/:no', sutController.getAnaBaslikDetay);

// Hiyerarşi ağacı
router.get('/hiyerarsi', sutController.getHiyerarsi);

// Eşleşmemiş kayıtlar
router.get('/unmatched', sutController.getUnmatchedRecords);

// Kategoriler
router.get('/kategoriler', sutController.getKategoriler);

// Kategoriye göre SUT kodları
router.get('/kategori/:kategoriId', sutController.getSutByKategori);

// Arama
router.get('/ara', sutController.araSut);

// İstatistikler
router.get('/stats', sutController.getSutStats);

// Belirli SUT kodu
router.get('/:kod', sutController.getSutByKod);

// Tüm SUT kodları (sayfalı) - en sona
router.get('/', sutController.getSutKodlari);

module.exports = router;

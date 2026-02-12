// ============================================
// TARIHSEL SORGULAR ROUTES
// ============================================
// Endpoint: /api/tarihsel
// ============================================

const express = require('express');
const router = express.Router();
const {
  getFiyatByTarih,
  getDegişenler,
  getFiyatGecmisi,
  getVersionlar
} = require('../controllers/tarihselController');

// ============================================
// GET /api/tarihsel/fiyat
// Belirli tarihteki fiyat sorgulama
// Query: huvKodu veya islemId, tarih (zorunlu)
// ============================================
router.get('/fiyat', getFiyatByTarih);

// ============================================
// GET /api/tarihsel/degisen
// Tarih aralığında değişen işlemler
// Query: baslangic, bitis (zorunlu), anaDalKodu
// ============================================
router.get('/degisen', getDegişenler);

// ============================================
// GET /api/tarihsel/gecmis/:identifier
// İşlemin tüm fiyat geçmişi (HUV Kodu veya İşlem ID)
// Param: identifier (HUV Kodu veya İşlem ID)
// ============================================
router.get('/gecmis/:identifier', getFiyatGecmisi);

// ============================================
// GET /api/tarihsel/versiyonlar/:islemId
// İşlemin tüm versiyonları
// Param: islemId (int)
// ============================================
router.get('/versiyonlar/:islemId', getVersionlar);

module.exports = router;

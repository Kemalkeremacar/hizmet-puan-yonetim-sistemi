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
  getHuvChanges,
  getSutChanges,
  getIlKatsayiList,
  getIlKatsayiChanges,
  getBirlesikList
} = require('../controllers/externalController');

// ============================================
// GET /api/external/huv
// HUV listesi - 2 seviye kırılım
// Üst Teminat: AnaDal
// Alt Teminat: AnaDal (aynı)
// İşlem: HuvIslem
// ============================================
router.get('/huv', getHuvList);

// ============================================
// GET /api/external/huv/changes
// HUV listesi değişiklikleri (en son import)
// Eklenen, güncellenen, silinen işlemler
// ============================================
router.get('/huv/changes', getHuvChanges);

// ============================================
// GET /api/external/sut
// SUT listesi - 2 seviye kırılım
// Üst Teminat: Ana Başlık (Seviye 1)
// Alt Teminat: İlk alt seviye (Seviye 2) - yoksa Ana Başlık
// İşlem: SutIslem
// ============================================
router.get('/sut', getSutList);

// ============================================
// GET /api/external/sut/changes
// SUT listesi değişiklikleri (en son import)
// Eklenen, güncellenen, silinen işlemler
// ============================================
router.get('/sut/changes', getSutChanges);

// ============================================
// GET /api/external/il-katsayi
// İl katsayıları listesi
// ============================================
router.get('/il-katsayi', getIlKatsayiList);

// ============================================
// GET /api/external/il-katsayi/changes
// İl katsayıları değişiklikleri (en son import)
// Eklenen, güncellenen, silinen il katsayıları
// ============================================
router.get('/il-katsayi/changes', getIlKatsayiChanges);

// ============================================
// GET /api/external/birlesik
// Birleştirilmiş HUV + SUT listesi
// Teminat bazlı eşleştirme (üst teminat + alt teminat kombinasyonuna göre)
// Her grupta hem HUV hem SUT işlemleri bulunur
// ============================================
router.get('/birlesik', getBirlesikList);

module.exports = router;

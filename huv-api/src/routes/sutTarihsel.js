// ============================================
// SUT TARİHSEL SORGULAR ROUTES
// ============================================
// Endpoint: /api/tarihsel/sut
// ============================================

const express = require('express');
const router = express.Router();
const {
  getPuanByTarih,
  getDegişenler,
  getPuanGecmisi,
  getVersionlar,
  karsilastirVersiyonlar,
  getTarihselStats,
  getYasamDongusu
} = require('../controllers/sutTarihselController');

// ============================================
// GET /api/tarihsel/sut/puan
// Belirli tarihteki SUT puan sorgulama
// Query: sutKodu veya sutId, tarih (zorunlu)
// ============================================
router.get('/puan', getPuanByTarih);

// ============================================
// GET /api/tarihsel/sut/degisen
// Tarih aralığında değişen SUT kodları
// Query: baslangic, bitis (zorunlu), anaBaslikNo
// ============================================
router.get('/degisen', getDegişenler);

// ============================================
// GET /api/tarihsel/sut/karsilastir
// İki liste versiyonu arasındaki farkları karşılaştır
// Query: eskiVersiyon, yeniVersiyon (zorunlu)
// ============================================
router.get('/karsilastir', karsilastirVersiyonlar);

// ============================================
// GET /api/tarihsel/sut/stats
// SUT tarihsel istatistikleri
// ============================================
router.get('/stats', getTarihselStats);

// ============================================
// GET /api/tarihsel/sut/gecmis/:identifier
// SUT kodunun tüm puan geçmişi (SUT Kodu veya SUT ID)
// Param: identifier (SUT Kodu veya SUT ID)
// ============================================
router.get('/gecmis/:identifier', getPuanGecmisi);

// ============================================
// GET /api/tarihsel/sut/versiyonlar/:sutId
// SUT işleminin tüm versiyonları
// Param: sutId (int)
// ============================================
router.get('/versiyonlar/:sutId', getVersionlar);

// ============================================
// GET /api/tarihsel/sut/yasam-dongusu/:identifier
// SUT kodunun yaşam döngüsü (eklenme, güncellenme, silinme olayları)
// Puan geçmişinden farklı: Sadece yaşam döngüsü olaylarını gösterir
// Param: identifier (SUT Kodu veya SUT ID)
// ============================================
router.get('/yasam-dongusu/:identifier', getYasamDongusu);

module.exports = router;

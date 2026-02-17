// ============================================
// ISLEMLER ROUTES
// ============================================
// Endpoint: /api/islemler
// READ-ONLY MODE: Veriler sadece Excel import ile güncellenir
// ============================================

const express = require('express');
const router = express.Router();
const {
  getIslemler,
  araIslem,
  getFiyatAralik,
  getHiyerarsi,
  getSonGuncellemeler,
  getSutKodu,
  getEnPahali,
  getEnUcuz,
  getKategori,
  getGelismisArama
} = require('../controllers/islemController');

// ============================================
// READ-ONLY ENDPOINTS (Aktif)
// ============================================

// ============================================
// GET /api/islemler
// Tüm işlemleri listele (sayfalı)
// Query: page, limit, anaDalKodu, sort, order
// ============================================
router.get('/', getIslemler);

// ============================================
// GET /api/islemler/ara
// Gelişmiş arama
// Query: q, minBirim, maxBirim, anaDalKodu, page, limit
// ============================================
router.get('/ara', araIslem);

// ============================================
// GET /api/islemler/gelismis-arama
// Gelişmiş arama (Çoklu filtre)
// Query: q, anaDalKodu, minFiyat, maxFiyat, seviye, gunSayisi, page, limit
// ============================================
router.get('/gelismis-arama', getGelismisArama);

// ============================================
// GET /api/islemler/fiyat-aralik
// Fiyat aralığına göre işlemler
// Query: minFiyat, maxFiyat, anaDalKodu, page, limit
// ============================================
router.get('/fiyat-aralik', getFiyatAralik);

// ============================================
// GET /api/islemler/hiyerarsi
// Hiyerarşi seviyesine göre işlemler
// Query: seviye, anaDalKodu, page, limit
// ============================================
router.get('/hiyerarsi', getHiyerarsi);

// ============================================
// GET /api/islemler/son-guncellemeler
// Tarihe göre güncellenenler
// Query: gunSayisi, anaDalKodu, page, limit
// ============================================
router.get('/son-guncellemeler', getSonGuncellemeler);

// ============================================
// GET /api/islemler/sut-kodu
// Süt koduna göre işlemler
// Query: sutKodu, page, limit
// ============================================
router.get('/sut-kodu', getSutKodu);

// ============================================
// GET /api/islemler/en-pahali
// En pahalı işlemler
// Query: topN, anaDalKodu
// ============================================
router.get('/en-pahali', getEnPahali);

// ============================================
// GET /api/islemler/en-ucuz
// En ucuz işlemler
// Query: topN, anaDalKodu
// ============================================
router.get('/en-ucuz', getEnUcuz);

// ============================================
// GET /api/islemler/kategori
// Kategoriye göre işlemler
// Query: ustBaslik, page, limit
// ============================================
router.get('/kategori', getKategori);


module.exports = router;

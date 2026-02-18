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
  getBirlesikList,
  getBirlesikGruplar,
  getBirlesikGrup,
  getSutHuvEslestirme
} = require('../controllers/externalController');
const {
  createKontrol,
  updateKontrol,
  getKontroller,
  createManuelDuzenleme
} = require('../controllers/eslestirmeController');
const { authenticate } = require('../middleware/auth');

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
// Birleştirilmiş HUV + SUT listesi (Tam liste - Tüm gruplar ve işlemler)
// Teminat bazlı eşleştirme (üst teminat + alt teminat kombinasyonuna göre)
// Her grupta hem HUV hem SUT işlemleri bulunur
// ============================================
router.get('/birlesik', getBirlesikList);

// ============================================
// GET /api/external/birlesik/gruplar
// Birleşik liste - Sadece grup özetleri (Lazy Loading için)
// SUT işlemlerini dahil etmez, sadece grup bilgilerini döner
// Çok daha hızlı yükleme (~1-2 saniye)
// ============================================
router.get('/birlesik/gruplar', getBirlesikGruplar);

// ============================================
// GET /api/external/birlesik/grup?ustKod=X&altKod=Y
// Birleşik liste - Belirli bir grubun detayları (Lazy Loading için)
// Sadece istenen grubun HUV ve SUT işlemlerini döner
// ============================================
router.get('/birlesik/grup', getBirlesikGrup);

// ============================================
// GET /api/external/sut-huv-eslestirme
// SUT listesi - SUT kırılımlarına göre, yanında HUV teminat bilgisi
// Her SUT işleminin yanında eşleştirildiği HUV üst ve alt teminat bilgisi var
// ============================================
router.get('/sut-huv-eslestirme', getSutHuvEslestirme);

// ============================================
// EŞLEŞTİRME KONTROL ROUTES (Authenticated)
// ============================================

// POST /api/external/eslestirme/kontrol
// Yeni kontrol kaydı oluştur
router.post('/eslestirme/kontrol', authenticate, createKontrol);

// PUT /api/external/eslestirme/kontrol/:id
// Kontrol durumunu güncelle (onayla/reddet)
router.put('/eslestirme/kontrol/:id', authenticate, updateKontrol);

// GET /api/external/eslestirme/kontroller
// Kontrol listesi
router.get('/eslestirme/kontroller', authenticate, getKontroller);

// POST /api/external/eslestirme/manuel-duzenleme
// Manuel eşleştirme düzenleme
router.post('/eslestirme/manuel-duzenleme', authenticate, createManuelDuzenleme);

module.exports = router;

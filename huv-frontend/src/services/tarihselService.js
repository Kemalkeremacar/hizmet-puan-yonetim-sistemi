// ============================================
// TARİHSEL SORGULAR SERVICE
// ============================================
// Tarihsel sorgular modülü için API çağrıları
// Endpoint: /api/tarihsel
// ============================================

import api from '../api/axios';

export const tarihselService = {
  // ============================================
  // GET /api/tarihsel/fiyat
  // Belirli tarihteki fiyat
  // ============================================
  getFiyatByTarih: (params) => {
    return api.get('/tarihsel/fiyat', { params });
  },

  // ============================================
  // GET /api/tarihsel/degisen
  // Tarih aralığında değişen işlemler
  // ============================================
  getDegişenler: (params) => {
    return api.get('/tarihsel/degisen', { params });
  },

  // ============================================
  // GET /api/tarihsel/gecmis/:identifier
  // İşlemin fiyat geçmişi (HUV Kodu veya İşlem ID)
  // ============================================
  getFiyatGecmisi: (identifier) => {
    return api.get(`/tarihsel/gecmis/${identifier}`);
  },

  // ============================================
  // GET /api/tarihsel/versiyonlar/:islemId
  // İşlemin versiyonları
  // ============================================
  getVersionlar: (islemId) => {
    return api.get(`/tarihsel/versiyonlar/${islemId}`);
  },

  // GET /api/tarihsel/yasam-dongusu/:identifier
  // HUV işleminin yaşam döngüsü (eklenme, güncellenme, silinme olayları)
  // ============================================
  getYasamDongusu: (identifier) => {
    return api.get(`/tarihsel/yasam-dongusu/${identifier}`);
  },

  // ============================================
  // SUT TARİHSEL SORGULAR
  // ============================================

  // GET /api/tarihsel/sut/stats
  // SUT tarihsel istatistikler
  getSutStats: () => {
    return api.get('/tarihsel/sut/stats');
  },

  // GET /api/tarihsel/sut/puan
  // Belirli tarihteki SUT puan
  getSutPuanByTarih: (params) => {
    return api.get('/tarihsel/sut/puan', { params });
  },

  // GET /api/tarihsel/sut/degisen
  // Tarih aralığında değişen SUT kodları
  getSutDegişenler: (params) => {
    return api.get('/tarihsel/sut/degisen', { params });
  },

  // GET /api/tarihsel/sut/gecmis/:identifier
  // SUT kodunun puan geçmişi
  getSutPuanGecmisi: (identifier) => {
    return api.get(`/tarihsel/sut/gecmis/${identifier}`);
  },

  // GET /api/tarihsel/sut/versiyonlar/:sutId
  // SUT kodunun versiyonları
  getSutVersionlar: (sutId) => {
    return api.get(`/tarihsel/sut/versiyonlar/${sutId}`);
  },

  // GET /api/tarihsel/sut/karsilastir
  // İki SUT versiyonunu karşılaştır
  karsilastirSutVersiyonlar: (params) => {
    return api.get('/tarihsel/sut/karsilastir', { params });
  },

  // GET /api/tarihsel/sut/yasam-dongusu/:identifier
  // SUT kodunun yaşam döngüsü (eklenme, güncellenme, silinme olayları)
  getSutYasamDongusu: (identifier) => {
    return api.get(`/tarihsel/sut/yasam-dongusu/${identifier}`);
  }
};

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
  }
};

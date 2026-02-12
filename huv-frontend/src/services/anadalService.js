// ============================================
// ANA DALLAR SERVICE
// ============================================
// Ana dallar modülü için API çağrıları
// Endpoint: /api/anadal
// ============================================

import api from '../api/axios';

export const anadalService = {
  // ============================================
  // GET /api/anadal
  // Tüm ana dalları listele
  // ============================================
  getAll: () => {
    return api.get('/anadal');
  },

  // ============================================
  // GET /api/anadal/:kod
  // Ana dal detayı + istatistikler
  // ============================================
  getByKod: (kod) => {
    return api.get(`/anadal/${kod}`);
  },

  // ============================================
  // GET /api/anadal/:kod/islemler
  // Ana dala ait işlemler
  // ============================================
  getIslemler: (kod, params) => {
    return api.get(`/anadal/${kod}/islemler`, { params });
  }
};

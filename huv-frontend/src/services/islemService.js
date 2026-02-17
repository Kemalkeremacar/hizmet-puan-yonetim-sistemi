// ============================================
// İŞLEMLER SERVICE
// ============================================
// İşlemler modülü için API çağrıları
// Endpoint: /api/islemler
// ============================================

import api from '../api/axios';

export const islemService = {
  // ============================================
  // READ-ONLY OPERATIONS (Aktif)
  // ============================================
  
  // GET /api/islemler
  // Tüm işlemleri listele (sayfalı)
  getAll: (params) => {
    return api.get('/islemler', { params });
  },

};

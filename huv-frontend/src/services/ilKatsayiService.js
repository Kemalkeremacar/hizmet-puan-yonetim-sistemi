// ============================================
// İL KATSAYILARI SERVICE
// ============================================
// İl katsayıları modülü için API çağrıları
// Endpoint: /api/external/il-katsayi
// ============================================

import api from '../api/axios';

export const ilKatsayiService = {
  // ============================================
  // GET /api/external/il-katsayi
  // Tüm il katsayılarını listele
  // ============================================
  getAll: () => {
    return api.get('/external/il-katsayi');
  },

  // ============================================
  // GET /api/external/il-katsayi/changes
  // İl katsayıları değişiklikleri (en son import)
  // ============================================
  getChanges: () => {
    return api.get('/external/il-katsayi/changes');
  },
};

export default ilKatsayiService;

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
};

export default ilKatsayiService;

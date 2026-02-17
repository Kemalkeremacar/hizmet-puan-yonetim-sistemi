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
  }
};

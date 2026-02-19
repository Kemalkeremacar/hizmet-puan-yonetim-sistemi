// ============================================
// EXTERNAL API SERVICE
// ============================================
// Dış servisler için HUV ve SUT listeleri
// ============================================

import axios from '../api/axios';

export const externalService = {
  // ============================================
  // GET /api/external/huv
  // HUV listesi
  // ============================================
  getHuvList: () => {
    return axios.get('/external/huv');
  },

  // ============================================
  // GET /api/external/sut
  // SUT listesi
  // ============================================
  getSutList: () => {
    return axios.get('/external/sut');
  },
};

export default externalService;

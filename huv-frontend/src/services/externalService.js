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

  // ============================================
  // GET /api/external/birlesik
  // Birleştirilmiş HUV + SUT listesi
  // ============================================
  getBirlesikList: () => {
    return axios.get('/external/birlesik', {
      timeout: 300000 // 5 dakika timeout (büyük veri seti için - SUT eşleştirme uzun sürebilir)
    });
  },
};

export default externalService;

// ============================================
// EŞLEŞTIRME SERVICE
// ============================================
// HUV-SUT eşleştirme API çağrıları
// ============================================

import axios from '../api/axios';

export const eslestirmeService = {
  // HUV işleminin SUT eşleştirmelerini getir
  getHuvEslesmeler: async (islemId) => {
    const response = await axios.get(`/islemler/${islemId}/eslesmeler`);
    return response.data;
  },

  // SUT işleminin HUV eşleştirmelerini getir
  getSutEslesmeler: async (sutId) => {
    const response = await axios.get(`/sut/${sutId}/eslesmeler`);
    return response.data;
  },

  // Tüm eşleştirmeleri getir
  getAll: async (params = {}) => {
    const response = await axios.get('/eslestirme', { params });
    return response.data;
  },

  // Eşleştirme istatistikleri
  getStats: async () => {
    const response = await axios.get('/eslestirme/istatistik');
    return response.data;
  },
};

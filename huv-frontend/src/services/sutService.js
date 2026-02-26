// ============================================
// SUT SERVICE
// ============================================
// SUT işlemleri için API servisi
// ============================================

import api from '../api/axios';

/**
 * SUT işlemlerinde arama yap
 * @param {string} query - Arama terimi
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt
 */
export const araSut = async (query, page = 1, limit = 20) => {
  const response = await api.get('/sut/ara', {
    params: { q: query, page, limit }
  });
  return response.data;
};

/**
 * Tüm SUT kodlarını listele
 * @param {Object} params - Query parametreleri
 */
export const getSutKodlari = async (params = {}) => {
  const response = await api.get('/sut', { params });
  return response.data;
};

/**
 * SUT kodu detayı
 * @param {string} kod - SUT kodu
 */
export const getSutByKod = async (kod) => {
  const response = await api.get(`/sut/${kod}`);
  return response.data;
};

/**
 * SUT ana başlıkları
 */
export const getAnaBasliklar = async () => {
  const response = await api.get('/sut/ana-basliklar');
  return response.data;
};

/**
 * Eşleşmemiş SUT kayıtları
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt
 */
export const getUnmatchedRecords = async (page = 1, limit = 50) => {
  const response = await api.get('/sut/unmatched', {
    params: { page, limit }
  });
  return response.data;
};

export default {
  araSut,
  getSutKodlari,
  getSutByKod,
  getAnaBasliklar,
  getUnmatchedRecords
};

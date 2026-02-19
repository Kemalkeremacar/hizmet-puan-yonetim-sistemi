// ============================================
// ALT TEMİNAT SERVICE
// ============================================

import axios from '../api/axios';

// Tüm alt teminatları getir
export const getAltTeminatlar = async () => {
  const response = await axios.get('/alt-teminatlar');
  return response.data?.data || response.data || [];
};

// SUT işlemlerini ara
export const searchSutIslemler = async (search, limit = 20) => {
  const response = await axios.get('/alt-teminatlar/sut-islemler', {
    params: { search, limit }
  });
  return response.data?.data || response.data || [];
};

// Alt teminata atanmış işlemleri getir
export const getAltTeminatIslemler = async (altTeminatId) => {
  const response = await axios.get(`/alt-teminatlar/${altTeminatId}/islemler`);
  return response.data?.data || response.data || [];
};

// Alt teminata işlem ata (tekli veya toplu)
export const addAltTeminatIslem = async (altTeminatId, sutID, altTeminatIDs = null) => {
  const payload = altTeminatIDs && altTeminatIDs.length > 0
    ? { sutID, altTeminatIDs }
    : { sutID };
    
  const response = await axios.post(`/alt-teminatlar/${altTeminatId}/islemler`, payload);
  return response.data?.data || response.data;
};

// Alt teminattan işlem kaldır
export const removeAltTeminatIslem = async (altTeminatId, sutID) => {
  const response = await axios.delete(`/alt-teminatlar/${altTeminatId}/islemler/${sutID}`);
  return response.data?.data || response.data;
};

// ============================================
// ALT TEMİNAT SERVICE
// ============================================

import axios from '../api/axios';

export const getAltTeminatlar = async () => {
  const response = await axios.get('/alt-teminatlar');
  return response.data?.data || response.data || [];
};

export const getAltTeminatIslemler = async (altTeminatId) => {
  const response = await axios.get(`/alt-teminatlar/${altTeminatId}/islemler`);
  return response.data?.data || response.data || [];
};

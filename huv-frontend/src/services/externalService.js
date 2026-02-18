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
  // GET /api/external/sut-huv-eslestirme
  // SUT listesi - SUT kırılımlarına göre, yanında HUV teminat bilgisi
  // ============================================
  getSutHuvEslestirme: () => {
    return axios.get('/external/sut-huv-eslestirme', {
      timeout: 300000 // 5 dakika timeout
    });
  },

  // ============================================
  // GET /api/external/birlesik
  // Birleştirilmiş HUV + SUT listesi (Tam liste - Tüm gruplar ve işlemler)
  // ============================================
  getBirlesikList: () => {
    return axios.get('/external/birlesik', {
      timeout: 300000 // 5 dakika timeout (büyük veri seti için - SUT eşleştirme uzun sürebilir)
    });
  },

  // ============================================
  // GET /api/external/birlesik/gruplar
  // Birleşik liste - Sadece grup özetleri (Lazy Loading için)
  // SUT işlemlerini dahil etmez, sadece grup bilgilerini döner
  // Çok daha hızlı yükleme (~1-2 saniye)
  // ============================================
  getBirlesikGruplar: () => {
    return axios.get('/external/birlesik/gruplar', {
      timeout: 30000 // 30 saniye timeout (hızlı olmalı)
    });
  },

  // ============================================
  // GET /api/external/birlesik/grup?ustKod=X&altKod=Y
  // Birleşik liste - Belirli bir grubun detayları (Lazy Loading için)
  // Sadece istenen grubun HUV ve SUT işlemlerini döner
  // ============================================
  getBirlesikGrup: (ustKod, altKod) => {
    return axios.get('/external/birlesik/grup', {
      params: { ustKod, altKod },
      timeout: 30000 // 30 saniye timeout
    });
  },

  // ============================================
  // EŞLEŞTİRME KONTROL SERVİSLERİ
  // ============================================
  
  // Yeni kontrol kaydı oluştur
  createEslestirmeKontrol: (data) => {
    return axios.post('/external/eslestirme/kontrol', data);
  },

  // Kontrol durumunu güncelle (onayla/reddet)
  updateEslestirmeKontrol: (id, data) => {
    return axios.put(`/external/eslestirme/kontrol/${id}`, data);
  },

  // Kontrol listesi
  getEslestirmeKontroller: (params = {}) => {
    return axios.get('/external/eslestirme/kontroller', { params });
  },

  // Manuel eşleştirme düzenleme
  createManuelDuzenleme: (data) => {
    return axios.post('/external/eslestirme/manuel-duzenleme', data);
  },
};

export default externalService;

// ============================================
// İŞLEMLER SERVICE
// ============================================
// İşlemler modülü için API çağrıları
// Endpoint: /api/islemler
// ============================================

import api from '../api/axios';

export const islemService = {
  // ============================================
  // READ-ONLY OPERATIONS (Aktif)
  // ============================================
  
  // GET /api/islemler
  // Tüm işlemleri listele (sayfalı)
  getAll: (params) => {
    return api.get('/islemler', { params });
  },

  // GET /api/islemler/:id
  // İşlem detayı
  getById: (id) => {
    return api.get(`/islemler/${id}`);
  },

  // GET /api/islemler/huv/:kod
  // HUV koduna göre işlem bul
  getByHuvKodu: (kod) => {
    return api.get(`/islemler/huv/${kod}`);
  },

  // GET /api/islemler/ara
  // Gelişmiş arama
  search: (params) => {
    return api.get('/islemler/ara', { params });
  },

  // ============================================
  // CRUD OPERATIONS (Devre Dışı - Excel Import Kullanılıyor)
  // ============================================
  // NOT: Bu fonksiyonlar yoruma alındı çünkü veriler artık sadece
  // Excel import ile güncelleniyor. Manuel CRUD işlemleri devre dışı.
  // ============================================

  // ❌ POST /api/islemler - Yeni işlem ekle
  // create: (data) => {
  //   return api.post('/islemler', data);
  // },

  // ❌ PUT /api/islemler/:id - İşlem güncelle
  // update: (id, data) => {
  //   return api.put(`/islemler/${id}`, data);
  // },

  // ❌ DELETE /api/islemler/:id - İşlem sil (soft delete)
  // delete: (id) => {
  //   return api.delete(`/islemler/${id}`);
  // },

  // ❌ POST /api/islemler/:id/geri-al - İptal edilen işlemi geri al
  // restore: (id) => {
  //   return api.post(`/islemler/${id}/geri-al`);
  // },

  // ❌ POST /api/islemler/toplu-guncelle - Toplu fiyat güncelleme
  // bulkUpdate: (data) => {
  //   return api.post('/islemler/toplu-guncelle', data);
  // },

  // ============================================
  // FILTER & QUERY OPERATIONS (Aktif)
  // ============================================

  // ============================================
  // GET /api/islemler/fiyat-aralik
  // Fiyat aralığına göre işlemler
  // ============================================
  getByFiyatAralik: (params) => {
    return api.get('/islemler/fiyat-aralik', { params });
  },

  // ============================================
  // GET /api/islemler/hiyerarsi
  // Hiyerarşi seviyesine göre işlemler
  // ============================================
  getByHiyerarsi: (params) => {
    return api.get('/islemler/hiyerarsi', { params });
  },

  // ============================================
  // GET /api/islemler/son-guncellemeler
  // Son güncellemeler
  // ============================================
  getSonGuncellemeler: (params) => {
    return api.get('/islemler/son-guncellemeler', { params });
  },

  // ============================================
  // GET /api/islemler/sut-kodu
  // Süt koduna göre işlemler
  // ============================================
  getBySutKodu: (params) => {
    return api.get('/islemler/sut-kodu', { params });
  },

  // ============================================
  // GET /api/islemler/en-pahali
  // En pahalı işlemler
  // ============================================
  getEnPahali: (params) => {
    return api.get('/islemler/en-pahali', { params });
  },

  // ============================================
  // GET /api/islemler/en-ucuz
  // En ucuz işlemler
  // ============================================
  getEnUcuz: (params) => {
    return api.get('/islemler/en-ucuz', { params });
  },

  // ============================================
  // GET /api/islemler/kategori
  // Kategoriye göre işlemler
  // ============================================
  getByKategori: (params) => {
    return api.get('/islemler/kategori', { params });
  },

  // ============================================
  // GET /api/islemler/gelismis-arama
  // Gelişmiş arama (Çoklu filtre)
  // ============================================
  gelismisArama: (params) => {
    return api.get('/islemler/gelismis-arama', { params });
  }
};

// ============================================
// ADMIN SERVICE
// ============================================
// Admin panel API çağrıları
// ============================================

import axios from '../api/axios';

export const adminService = {
  // ============================================
  // GET /api/admin/versiyonlar
  // Tüm liste versiyonları
  // ============================================
  getVersiyonlar: (listeTipi = 'HUV') => {
    return axios.get('/admin/versiyonlar', {
      params: { listeTipi }
    });
  },

  // ============================================
  // GET /api/admin/versiyonlar/:id
  // Belirli bir versiyonun detayları
  // ============================================
  getVersiyonDetay: (id) => {
    return axios.get(`/admin/versiyonlar/${id}`);
  },

  // ============================================
  // GET /api/admin/import/report/:versionId
  // Import detay raporu
  // ============================================
  getImportReport: (versionId) => {
    return axios.get(`/admin/import/report/${versionId}`);
  },

  // ============================================
  // POST /api/admin/import/preview
  // Excel dosyasını önizle (import yapmadan)
  // ============================================
  previewImport: (formData) => {
    return axios.post('/admin/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // ============================================
  // POST /api/admin/import/huv
  // HUV Excel dosyasını import et
  // ============================================
  importHuvList: (formData) => {
    return axios.post('/admin/import/huv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // ============================================
  // POST /api/admin/import/sut
  // SUT Excel dosyasını import et
  // ============================================
  importSutList: (formData) => {
    return axios.post('/admin/import/sut', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default adminService;

// ============================================
// MATCHING SERVICE
// ============================================
// SUT-HUV automatic matching API calls
// ============================================

import axios from '../api/axios';

export const matchingService = {
  // ============================================
  // POST /api/matching/run-batch
  // Run batch matching operation
  // ============================================
  runBatch: (options, progressCallback) => {
    return axios.post('/matching/run-batch', options, {
      timeout: 300000, // 5 minutes timeout for batch operations
      onUploadProgress: progressCallback ? (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        progressCallback(percentCompleted);
      } : undefined
    });
  },

  // ============================================
  // GET /api/matching/results
  // Get matching results with filtering and pagination
  // ============================================
  getResults: (filters = {}, page = 1, limit = 50) => {
    // Boş string filtreleri temizle
    const cleanFilters = {};
    Object.keys(filters).forEach(key => {
      if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
        cleanFilters[key] = filters[key];
      }
    });
    
    return axios.get('/matching/results', {
      params: {
        page,
        limit,
        ...cleanFilters
      }
    });
  },

  // ============================================
  // POST /api/matching/approve/:sutId
  // Approve an automatic match
  // ============================================
  approveMatch: (sutId, userId) => {
    return axios.post(`/matching/approve/${sutId}`, { userId });
  },

  // ============================================
  // PUT /api/matching/change/:sutId
  // Change match to a different HUV teminat
  // ============================================
  changeMatch: (sutId, newAltTeminatId, userId) => {
    return axios.put(`/matching/change/${sutId}`, {
      newAltTeminatId,
      userId
    });
  },

  // ============================================
  // GET /api/matching/huv-options/:sutId
  // Get available HUV teminat options for a SUT işlem
  // ============================================
  getHuvOptions: (sutId) => {
    return axios.get(`/matching/huv-options/${sutId}`);
  },

  // ============================================
  // GET /api/matching/stats
  // Get comprehensive matching statistics
  // ============================================
  getStats: () => {
    return axios.get('/matching/stats');
  }
};

export default matchingService;

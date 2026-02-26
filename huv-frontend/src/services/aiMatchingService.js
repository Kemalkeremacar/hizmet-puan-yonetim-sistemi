// ============================================
// AI MATCHING SERVICE
// ============================================
// Frontend service for AI-powered matching
// ============================================

import api from '../api/axios';

/**
 * Check AI service status
 */
export const getAIStatus = async () => {
  const response = await api.get('/ai-matching/status');
  return response.data;
};

/**
 * Match a single SUT işlem using AI
 * @param {number} sutId - SUT işlem ID
 * @param {Object} options - Matching options
 */
export const matchSingle = async (sutId, options = {}) => {
  const response = await api.post('/ai-matching/match-single', {
    sutId,
    limitHuvByAnaDal: options.limitHuvByAnaDal || false,
    temperature: options.temperature || 0.3
  });
  return response.data;
};

/**
 * Match multiple SUT işlemler using AI
 * @param {Array<number>} sutIds - Array of SUT IDs
 * @param {Object} options - Matching options
 */
export const matchBatch = async (sutIds, options = {}) => {
  const response = await api.post('/ai-matching/match-batch', {
    sutIds,
    limitHuvByAnaDal: options.limitHuvByAnaDal || false,
    temperature: options.temperature || 0.3
  });
  return response.data;
};

/**
 * Save AI match to database
 * @param {number} sutId - SUT işlem ID
 * @param {number} altTeminatId - HUV alt teminat ID
 * @param {number} confidence - Confidence score
 * @param {string} reasoning - AI reasoning
 */
export const saveMatch = async (sutId, altTeminatId, confidence, reasoning) => {
  const response = await api.post('/ai-matching/save', {
    sutId,
    altTeminatId,
    confidence,
    reasoning
  });
  return response.data;
};

/**
 * Validate an existing match using AI
 * @param {number} sutId - SUT işlem ID
 */
export const validateMatch = async (sutId) => {
  const response = await api.post('/ai-matching/validate', {
    sutId
  });
  return response.data;
};

export default {
  getAIStatus,
  matchSingle,
  matchBatch,
  saveMatch,
  validateMatch
};

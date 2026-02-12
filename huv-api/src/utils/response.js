// ============================================
// RESPONSE UTILITIES
// ============================================
// API response helper fonksiyonları
// ============================================

// ============================================
// Success response helper
// ============================================
const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

// ============================================
// Error response helper
// ============================================
const error = (res, message = 'Error', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

// ============================================
// Paginated response helper
// ============================================
const paginated = (res, data, page, limit, total, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
};

module.exports = {
  success,
  error,
  paginated
};

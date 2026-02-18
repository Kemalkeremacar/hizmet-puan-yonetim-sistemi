// ============================================
// ERROR HANDLER MIDDLEWARE
// ============================================
// Global hata yakalama ve işleme
// ============================================

const { error } = require('../utils/response');

// ============================================
// Global error handler middleware
// ============================================
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // SQL Server errors
  if (err.name === 'RequestError' || err.number) {
    console.error('❌ SQL Server Error:', {
      message: err.message,
      number: err.number,
      state: err.state,
      class: err.class,
      serverName: err.serverName,
      procName: err.procName,
      lineNumber: err.lineNumber
    });
    
    // Invalid object name (tablo yok)
    if (err.number === 208) {
      return error(res, `Tablo bulunamadı: ${err.message}. Lütfen migration scriptini çalıştırın.`, 500);
    }
    
    return error(res, 'Database error: ' + err.message, 500);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return error(res, 'Validation error', 400, err.errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expired', 401);
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  return error(res, message, statusCode);
};

// ============================================
// 404 Not Found handler
// ============================================
const notFound = (req, res) => {
  return error(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = {
  errorHandler,
  notFound
};

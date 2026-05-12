// ============================================
// APP CONFIGURATION
// ============================================
// Express app setup ve middleware
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { getPool } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { success } = require('./utils/response');
const { cleanupOldUploads } = require('./utils/fileCleanup');

// ============================================
// Create Express app
// ============================================
const app = express();

// ============================================
// SCHEDULED TASKS
// ============================================
// Upload klasörü path'ini al
const { uploadDir } = require('./middleware/uploadMiddleware');

// Her 1 saatte bir upload klasörünü temizle
setInterval(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Upload klasörü temizleniyor...');
  }
  const result = cleanupOldUploads(uploadDir, 1); // 1 saatten eski dosyalar
  if (result.deleted > 0) {
    console.log(`✅ Cleanup: ${result.deleted} eski dosya temizlendi`);
  }
}, 60 * 60 * 1000); // 1 saat

// İlk başlangıçta da temizle (sessizce)
setTimeout(() => {
  cleanupOldUploads(uploadDir, 1);
}, 5000); // 5 saniye sonra

// ============================================
// Middleware
// ============================================
app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ============================================
// Health check endpoint
// ============================================
app.get('/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as test');
    
    success(res, {
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString()
    }, 'API is healthy');
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'ERROR',
      database: 'Disconnected',
      message: err.message
    });
  }
});

// ============================================
// API Routes
// ============================================
const API_PREFIX = process.env.API_PREFIX || '/api';

// Authentication API (Public)
app.use(`${API_PREFIX}/auth`, require('./routes/auth'));

// Auth middleware
const { authenticate, authorizeAdmin } = require('./middleware/auth');

// External API
app.use(`${API_PREFIX}/external`, authenticate, require('./routes/external'));

// Ana Dal API
app.use(`${API_PREFIX}/anadal`, authenticate, require('./routes/anadal'));

// SUT API
app.use(`${API_PREFIX}/sut`, authenticate, require('./routes/sut'));

// SUT Tarihsel API
app.use(`${API_PREFIX}/tarihsel/sut`, authenticate, require('./routes/sutTarihsel'));

// İşlemler API
app.use(`${API_PREFIX}/islemler`, authenticate, require('./routes/islemler'));

// Tarihsel API
app.use(`${API_PREFIX}/tarihsel`, authenticate, require('./routes/tarihsel'));

// Import API - ADMIN ONLY
app.use(`${API_PREFIX}/admin/import`, authenticate, authorizeAdmin, require('./routes/import'));

// Versiyonlar API - ADMIN ONLY
app.use(`${API_PREFIX}/admin/versiyonlar`, authenticate, authorizeAdmin, require('./routes/versiyonlar'));

// Alt Teminatlar API
app.use(`${API_PREFIX}/alt-teminatlar`, authenticate, require('./routes/altTeminatlar'));

// Matching API
app.use(`${API_PREFIX}/matching`, authenticate, require('./routes/matching'));


// ============================================
// Welcome route
// ============================================
app.get('/', (_req, res) => {
  success(res, {
    name: 'HUV API',
    version: '1.0.0',
    description: 'Sağlık Uygulama Tebliği (HUV) API',
    endpoints: {
      health: '/health',
      api: API_PREFIX
    }
  }, 'Welcome to HUV API');
});

// ============================================
// 404 handler
// ============================================
app.use(notFound);

// ============================================
// Error handler (must be last)
// ============================================
app.use(errorHandler);

module.exports = app;

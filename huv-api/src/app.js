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
// Her 1 saatte bir upload klasörünü temizle
setInterval(() => {
  console.log('🧹 Upload klasörü temizleniyor...');
  const result = cleanupOldUploads('uploads', 1); // 1 saatten eski dosyalar
  console.log(`✅ Cleanup tamamlandı: ${result.deleted} dosya silindi`);
}, 60 * 60 * 1000); // 1 saat

// İlk başlangıçta da temizle
setTimeout(() => {
  cleanupOldUploads('uploads', 1);
}, 5000); // 5 saniye sonra

// ============================================
// Middleware
// ============================================
app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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

// İşlemler API (HUV Liste için)
app.use(`${API_PREFIX}/islemler`, require('./routes/islemler'));

// Ana Dallar API (HUV Liste için)
app.use(`${API_PREFIX}/anadal`, require('./routes/anadal'));

// SUT Kodları API (SUT Liste için)
app.use(`${API_PREFIX}/sut`, require('./routes/sut'));

// Tarihsel Sorgular API (HUV Tarihsel için)
app.use(`${API_PREFIX}/tarihsel`, require('./routes/tarihsel'));

// SUT Tarihsel Sorgular API (SUT Tarihsel için)
app.use(`${API_PREFIX}/tarihsel/sut`, require('./routes/sutTarihsel'));

// HUV-SUT Eşleştirme API (Her iki liste için)
app.use(`${API_PREFIX}/eslestirme`, require('./routes/eslestirme'));

// Import API (HUV ve SUT Yönetimi için)
app.use(`${API_PREFIX}/admin/import`, require('./routes/import'));

// Versiyonlar API (HUV ve SUT Yönetimi için)
app.use(`${API_PREFIX}/admin/versiyonlar`, require('./routes/versiyonlar'));

// Admin API (Bakım ve yönetim işlemleri)
app.use(`${API_PREFIX}/admin`, require('./routes/admin'));

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

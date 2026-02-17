// ============================================
// AUTHENTICATION ROUTES
// ============================================
// Login, Logout, Me (current user)
// ============================================

const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// ============================================
// POST /api/auth/login
// Kullanıcı girişi
// ============================================
router.post('/login', login);

// ============================================
// POST /api/auth/logout
// Kullanıcı çıkışı
// ============================================
router.post('/logout', authenticate, logout);

// ============================================
// GET /api/auth/me
// Mevcut kullanıcı bilgisi
// ============================================
router.get('/me', authenticate, getMe);

module.exports = router;

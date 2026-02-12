// ============================================
// ADMIN ROUTES
// ============================================
// Endpoint: /api/admin
// ============================================

const express = require('express');
const router = express.Router();
const { autoMatchAll } = require('../controllers/adminController');

// ============================================
// POST /api/admin/auto-match-all
// Mevcut tüm HUV işlemlerini otomatik eşleştir
// ============================================
router.post('/auto-match-all', autoMatchAll);

module.exports = router;

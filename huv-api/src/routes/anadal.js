// ============================================
// ANA DALLAR ROUTES
// ============================================
// Endpoint: /api/anadal
// ============================================

const express = require('express');
const router = express.Router();
const { getAnaDallar } = require('../controllers/anadalController');

// ============================================
// GET /api/anadal
// Tüm ana dalları listele
// ============================================
router.get('/', getAnaDallar);

module.exports = router;

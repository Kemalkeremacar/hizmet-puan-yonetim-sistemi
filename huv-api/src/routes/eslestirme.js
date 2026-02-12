// ============================================
// EŞLEŞTIRME ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const eslestirmeController = require('../controllers/eslestirmeController');

// İstatistikler
router.get('/istatistik', eslestirmeController.getIstatistik);

// Eşleştirme listesi
router.get('/liste', eslestirmeController.getEslestirmeler);

// HUV bazlı eşleştirmeler
router.get('/huv/:islemId', eslestirmeController.getHuvEslestirmeleri);

// SUT bazlı eşleştirmeler
router.get('/sut/:sutId', eslestirmeController.getSutEslestirmeleri);

// Eşleştirilmemiş kayıtlar
router.get('/eslestirilmemis/huv', eslestirmeController.getEslestirilmemisHuv);
router.get('/eslestirilmemis/sut', eslestirmeController.getEslestirilmemisSut);

// CRUD operasyonları
router.post('/', eslestirmeController.createEslestirme);
router.put('/:id', eslestirmeController.updateEslestirme);
router.post('/:id/onayla', eslestirmeController.onaylaEslestirme);
router.delete('/:id', eslestirmeController.deleteEslestirme);

module.exports = router;

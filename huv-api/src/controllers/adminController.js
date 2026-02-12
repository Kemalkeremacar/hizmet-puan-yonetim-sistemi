// ============================================
// ADMIN CONTROLLER
// ============================================
// Admin işlemleri ve bakım operasyonları
// ============================================

const { autoMatchAllExisting } = require('../services/autoMatchService');
const { success, error } = require('../utils/response');

// ============================================
// POST /api/admin/auto-match-all
// Mevcut tüm HUV işlemlerini SutKodu'larına göre eşleştir
// Tek seferlik migration için
// ============================================
const autoMatchAll = async (req, res, next) => {
  try {
    console.log('🔄 Otomatik eşleştirme başlatılıyor...');
    
    const result = await autoMatchAllExisting();
    
    if (!result.success) {
      return error(res, 'Otomatik eşleştirme başarısız', 500, {
        detay: result.error
      });
    }
    
    return success(res, {
      toplam: result.total,
      eslestirilen: result.matched,
      mevcutEslestirme: result.alreadyExists,
      reaktive: result.reactivated,
      bulunamayan: result.notFound,
      hatalar: result.errors.slice(0, 50) // İlk 50 hata
    }, `${result.matched} işlem başarıyla eşleştirildi`);
    
  } catch (err) {
    next(err);
  }
};

module.exports = {
  autoMatchAll
};

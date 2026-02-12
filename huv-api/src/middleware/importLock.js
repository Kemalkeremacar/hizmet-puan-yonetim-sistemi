// ============================================
// IMPORT LOCK MIDDLEWARE
// ============================================
// Concurrent import'ları engellemek için
// Aynı anda sadece 1 import işlemi yapılabilir
// ============================================

let isImporting = false;
let currentImportJob = null;

const importLock = (req, res, next) => {
  if (isImporting) {
    return res.status(409).json({
      success: false,
      message: 'Şu anda başka bir import işlemi devam ediyor',
      errors: {
        tip: 'IMPORT_DEVAM_EDIYOR',
        currentJob: currentImportJob,
        cozum: 'Lütfen mevcut import işlemi tamamlanana kadar bekleyin'
      }
    });
  }
  
  // Lock'u al
  isImporting = true;
  currentImportJob = {
    startTime: new Date(),
    user: req.user?.username || req.headers['x-user-name'] || 'admin',
    file: req.file?.originalname
  };
  
  // Response bittiğinde lock'u serbest bırak
  res.on('finish', () => {
    isImporting = false;
    currentImportJob = null;
  });
  
  res.on('close', () => {
    isImporting = false;
    currentImportJob = null;
  });
  
  next();
};

// Lock durumunu kontrol et
const checkImportStatus = (req, res) => {
  return res.json({
    success: true,
    data: {
      isImporting,
      currentJob: currentImportJob
    }
  });
};

module.exports = {
  importLock,
  checkImportStatus
};

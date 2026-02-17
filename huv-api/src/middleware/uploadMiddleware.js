// ============================================
// UPLOAD MIDDLEWARE
// ============================================
// Multer ile dosya yükleme
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// Upload klasörünü oluştur
// ============================================
// Environment variable'dan al, yoksa sistem temp klasörü kullan
const getUploadDir = () => {
  // 1. Environment variable'dan al (production için)
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  
  // 2. Windows için: C:\HUV_Uploads (proje dışı)
  // 3. Linux/Mac için: /tmp/huv-uploads
  if (process.platform === 'win32') {
    return path.join(process.env.USERPROFILE || process.env.HOME || 'C:\\', 'HUV_Uploads');
  } else {
    return path.join(require('os').tmpdir(), 'huv-uploads');
  }
};

const uploadDir = getUploadDir();
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ============================================
// Storage yapılandırması
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Benzersiz dosya adı: timestamp_originalname
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

// ============================================
// Dosya filtresi (sadece Excel)
// ============================================
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
  ];
  
  const allowedExtensions = ['.xls', '.xlsx', '.xlsm'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Sadece Excel dosyaları (.xls, .xlsx) yüklenebilir'), false);
  }
};

// ============================================
// Multer yapılandırması
// ============================================
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
});

// ============================================
// Tek dosya yükleme middleware
// ============================================
const uploadSingle = upload.single('file');

// ============================================
// Hata yakalama wrapper
// ============================================
const handleUploadError = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer hataları
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Dosya boyutu çok büyük (max 10 MB)'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload hatası: ${err.message}`
      });
    } else if (err) {
      // Diğer hatalar
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
};

module.exports = {
  uploadSingle: handleUploadError,
  uploadDir
};

// ============================================
// FILE CLEANUP UTILITY
// ============================================
// Upload klasöründeki eski dosyaları temizler
// ============================================

const fs = require('fs');
const path = require('path');

// Upload klasöründeki 1 saatten eski dosyaları sil
const cleanupOldUploads = (uploadDir = 'uploads', maxAgeHours = 1) => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return { success: true, deleted: 0, message: 'Upload klasörü bulunamadı' };
    }
    
    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // saat -> milisaniye
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      
      // Dosya yaşı kontrolü
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
        // Sadece development'ta detaylı log göster
        if (process.env.NODE_ENV === 'development') {
          console.log(`🗑️ Eski dosya silindi: ${file}`);
        }
      }
    }
    
    return {
      success: true,
      deleted: deletedCount,
      message: `${deletedCount} eski dosya temizlendi`
    };
  } catch (error) {
    console.error('❌ Cleanup hatası:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Belirli bir dosyayı sil
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Dosya silindi: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Dosya silinemedi [${filePath}]:`, error.message);
    return false;
  }
};

const decodeDosyaAdi = (originalname) => {
  try {
    return decodeURIComponent(originalname);
  } catch {
    try {
      return Buffer.from(originalname, 'latin1').toString('utf8');
    } catch {
      return originalname;
    }
  }
};

module.exports = {
  cleanupOldUploads,
  deleteFile,
  decodeDosyaAdi
};

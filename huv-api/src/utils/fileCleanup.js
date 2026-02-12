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
        console.log(`🗑️ Eski dosya silindi: ${file}`);
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

// Upload klasörü boyutunu kontrol et (MB)
const getUploadDirSize = (uploadDir = 'uploads') => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(uploadDir);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
    
    return (totalSize / (1024 * 1024)).toFixed(2); // MB
  } catch (error) {
    console.error('❌ Boyut hesaplama hatası:', error.message);
    return 0;
  }
};

module.exports = {
  cleanupOldUploads,
  deleteFile,
  getUploadDirSize
};

// ============================================
// İL KATSAYILARI IMPORT CONTROLLER
// ============================================
// Excel'den il katsayıları yükleme
// ============================================

const { 
  parseIlKatsayiExcel, 
  validateIlKatsayiData, 
  normalizeIlKatsayiData 
} = require('../services/ilKatsayiExcelParser');
const { 
  compareIlKatsayiLists, 
  generateIlKatsayiComparisonReport 
} = require('../services/ilKatsayiComparisonService');
const { createListeVersiyon } = require('../services/versionManager');
const {
  getMevcutIlKatsayiData,
  addNewIlKatsayi,
  updateIlKatsayiWithVersion,
  deactivateIlKatsayi,
  copyUnchangedIlKatsayiToVersion
} = require('../services/ilKatsayiVersionManager');
const { success, error } = require('../utils/response');
const { getPool, sql } = require('../config/database');
const fs = require('fs');

// ============================================
// POST /api/admin/import/il-katsayi/preview
// Excel önizleme ve karşılaştırma (DRY RUN)
// ============================================
const previewIlKatsayiImport = async (req, res, next) => {
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      return error(res, 'Lütfen bir Excel dosyası yükleyin', 400, {
        tip: 'DOSYA_EKSIK'
      });
    }
    
    uploadedFile = req.file.path;
    const dosyaAdi = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // Parse et
    const parseResult = parseIlKatsayiExcel(uploadedFile);
    if (!parseResult.success) {
      return error(res, 'Excel dosyası okunamadı', 400, {
        tip: 'PARSE_HATASI',
        detay: parseResult.error
      });
    }
    
    // Validate et
    const validation = validateIlKatsayiData(parseResult.data);
    if (!validation.valid) {
      return error(res, 'Excel dosyasında hatalı veriler bulundu', 400, {
        tip: 'VALIDATION_HATASI',
        istatistik: validation.stats,
        hatalar: validation.errors.slice(0, 50),
        uyarilar: validation.warnings.slice(0, 20)
      });
    }
    
    // Normalize et
    const normalizedData = normalizeIlKatsayiData(validation.validData);
    
    // Mevcut verileri al
    const mevcutData = await getMevcutIlKatsayiData();
    
    // Karşılaştır
    const comparison = compareIlKatsayiLists(mevcutData, normalizedData);
    const report = generateIlKatsayiComparisonReport(comparison);
    
    return success(res, {
      dosyaAdi,
      listeTipi: 'ILKATSAYI',
      donemBaslangic: parseResult.donemBaslangic,
      donemBitis: parseResult.donemBitis,
      summary: {
        toplamOkunan: parseResult.rowCount,
        gecerli: validation.stats.valid,
        eklenen: comparison.summary.added,
        guncellenen: comparison.summary.updated,
        degismeyen: comparison.summary.unchanged,
        silinecek: comparison.summary.deleted
      },
      comparison: report,
      uyarilar: validation.warnings.slice(0, 20),
      onizleme: {
        eklenenler: comparison.added.slice(0, 10),
        guncellenenler: comparison.updated.slice(0, 10),
        silinecekler: comparison.deleted.slice(0, 10)
      }
    }, 'Önizleme hazır');
    
  } catch (err) {
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      fs.unlinkSync(uploadedFile);
    }
    next(err);
  }
};

// ============================================
// POST /api/admin/import/il-katsayi
// İl katsayılarını Excel'den yükle
// ============================================
const importIlKatsayiList = async (req, res, next) => {
  const startTime = Date.now();
  let uploadedFile = null;
  
  try {
    const pool = await getPool();
    
    // 1. Dosya kontrolü
    if (!req.file) {
      return error(res, 'Lütfen bir Excel dosyası yükleyin', 400, {
        tip: 'DOSYA_EKSIK',
        cozum: 'Excel dosyası (.xls, .xlsx, .xlsm) seçin ve tekrar deneyin'
      });
    }
    
    uploadedFile = req.file.path;
    const dosyaAdi = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // Dosya boyutu kontrolü
    if (req.file.size > 10 * 1024 * 1024) {
      return error(res, 'Dosya boyutu çok büyük', 400, {
        tip: 'DOSYA_BOYUTU',
        cozum: 'Dosya boyutu 10 MB\'dan küçük olmalıdır'
      });
    }
    
    // 2. Excel'i parse et
    const parseResult = parseIlKatsayiExcel(uploadedFile);
    
    if (!parseResult.success) {
      return error(res, 'Excel dosyası okunamadı', 400, {
        tip: 'PARSE_HATASI',
        detay: parseResult.error,
        cozum: 'Dosyanın bozuk olmadığından ve Excel formatında olduğundan emin olun'
      });
    }
    
    if (parseResult.rowCount === 0) {
      return error(res, 'Excel dosyası boş', 400, {
        tip: 'BOS_DOSYA',
        cozum: 'Excel dosyasında en az 1 satır veri olmalıdır'
      });
    }
    
    // 3. Validate et
    const validation = validateIlKatsayiData(parseResult.data);
    
    if (!validation.valid) {
      return error(res, 'Excel dosyasında hatalı veriler bulundu', 400, {
        tip: 'VALIDATION_HATASI',
        istatistik: validation.stats,
        hatalar: validation.errors.slice(0, 20),
        uyarilar: validation.warnings.slice(0, 10),
        cozum: 'Lütfen hatalı satırları düzeltin ve tekrar deneyin',
        detay: `${validation.stats.invalid} satırda hata bulundu.`
      });
    }
    
    // 4. Normalize et
    const normalizedData = normalizeIlKatsayiData(validation.validData);
    
    // 5. Mevcut verileri al
    const mevcutData = await getMevcutIlKatsayiData();
    
    // 6. Karşılaştır
    const comparison = compareIlKatsayiLists(mevcutData, normalizedData);
    
    // 7. Yeni versiyon oluştur
    const kullaniciAdi = req.user?.username || 
                        req.headers['x-user-name'] || 
                        'admin';
    
    // Yükleme tarihini belirle
    let yuklemeTarihi = req.body.yuklemeTarihi;
    
    if (!yuklemeTarihi) {
      // Dönem başlangıç tarihini kullan (Excel'den çıkarılan)
      if (parseResult.donemBaslangic) {
        yuklemeTarihi = new Date(parseResult.donemBaslangic + 'T00:00:00');
      } else {
        yuklemeTarihi = new Date();
      }
    } else {
      yuklemeTarihi = new Date(yuklemeTarihi);
    }
    
    const versionID = await createListeVersiyon(
      dosyaAdi,
      normalizedData.length,
      `${comparison.summary.added} eklendi, ${comparison.summary.updated} güncellendi, ${comparison.summary.deleted} silindi`,
      kullaniciAdi,
      yuklemeTarihi,
      'ILKATSAYI'
    );
    
    // 8. Değişiklikleri uygula
    const yuklemeTarihiDate = new Date(yuklemeTarihi);
    let eklenenSayisi = 0;
    let guncellenenSayisi = 0;
    let pasifYapilanSayisi = 0;
    let kopyalananSayisi = 0;
    const hatalar = [];
    
    // Yeni eklenenleri ekle
    for (const item of comparison.added) {
      try {
        const yeniData = normalizedData.find(d => d.IlAdi.toLowerCase().trim() === item.IlAdi.toLowerCase().trim());
        await addNewIlKatsayi(yeniData, versionID, yuklemeTarihiDate);
        eklenenSayisi++;
      } catch (err) {
        console.error(`❌ Ekleme hatası [${item.IlAdi}]:`, err.message);
        hatalar.push({
          IlAdi: item.IlAdi,
          hata: err.message
        });
      }
    }
    
    // Güncellenenleri güncelle (SCD Type 2)
    for (const item of comparison.updated) {
      try {
        const eskiIlKatsayi = mevcutData.find(d => d.IlAdi.toLowerCase().trim() === item.IlAdi.toLowerCase().trim());
        const yeniData = normalizedData.find(d => d.IlAdi.toLowerCase().trim() === item.IlAdi.toLowerCase().trim());
        
        await updateIlKatsayiWithVersion(eskiIlKatsayi.IlKatsayiID, yeniData, versionID, yuklemeTarihi);
        guncellenenSayisi++;
      } catch (err) {
        hatalar.push({
          IlAdi: item.IlAdi,
          hata: err.message
        });
      }
    }
    
    // Silinenleri pasif yap
    for (const item of comparison.deleted) {
      try {
        const eskiIlKatsayi = mevcutData.find(d => d.IlAdi.toLowerCase().trim() === item.IlAdi.toLowerCase().trim());
        await deactivateIlKatsayi(eskiIlKatsayi.IlKatsayiID, versionID, yuklemeTarihi);
        pasifYapilanSayisi++;
      } catch (err) {
        hatalar.push({
          IlAdi: item.IlAdi,
          hata: err.message
        });
      }
    }
    
    // Değişmeyenleri yeni versiyona kopyala
    for (const item of comparison.unchanged) {
      try {
        const eskiIlKatsayi = mevcutData.find(d => d.IlAdi.toLowerCase().trim() === item.IlAdi.toLowerCase().trim());
        await copyUnchangedIlKatsayiToVersion(eskiIlKatsayi.IlKatsayiID, eskiIlKatsayi, versionID, yuklemeTarihi);
        kopyalananSayisi++;
      } catch (err) {
        console.error(`❌ Kopyalama hatası [${item.IlAdi}]:`, err.message);
        hatalar.push({
          IlAdi: item.IlAdi,
          hata: err.message
        });
      }
    }
    
    // 9. ListeVersiyon tablosundaki özet sayıları güncelle
    await pool.request()
      .input('versionId', sql.Int, versionID)
      .input('eklenenSayisi', sql.Int, eklenenSayisi)
      .input('guncellenenSayisi', sql.Int, guncellenenSayisi)
      .input('silinenSayisi', sql.Int, pasifYapilanSayisi)
      .query(`
        UPDATE ListeVersiyon
        SET 
          EklenenSayisi = @eklenenSayisi,
          GuncellenenSayisi = @guncellenenSayisi,
          SilinenSayisi = @silinenSayisi
        WHERE VersionID = @versionId
      `);
    
    // 10. Dosyayı sil
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      fs.unlinkSync(uploadedFile);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // 11. Sonuç döndür
    return success(res, {
      versionID,
      dosyaAdi,
      donemBaslangic: parseResult.donemBaslangic,
      donemBitis: parseResult.donemBitis,
      summary: {
        added: eklenenSayisi,
        updated: guncellenenSayisi,
        deleted: pasifYapilanSayisi,
        unchanged: kopyalananSayisi
      },
      duration: `${duration} saniye`,
      errors: hatalar.length > 0 ? hatalar : undefined
    }, 'İl katsayıları başarıyla yüklendi', 201);
    
  } catch (err) {
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      fs.unlinkSync(uploadedFile);
    }
    
    console.error('❌ Import hatası:', err);
    console.error('❌ Hata detayı:', err.message);
    console.error('❌ Stack trace:', err.stack);
    
    let mesaj = 'Import işlemi sırasında beklenmeyen bir hata oluştu';
    let detay = err.message;
    
    if (err.message.includes('ECONNREFUSED')) {
      mesaj = 'Veritabanı bağlantısı kurulamadı';
      detay = 'Veritabanı sunucusunun çalıştığından emin olun';
    } else if (err.message.includes('timeout')) {
      mesaj = 'İşlem zaman aşımına uğradı';
      detay = 'Dosya çok büyük olabilir veya veritabanı yavaş yanıt veriyor';
    } else if (err.message.includes('duplicate')) {
      mesaj = 'Duplicate kayıt hatası';
      detay = 'Aynı il adı ile birden fazla kayıt var';
    }
    
    return error(res, mesaj, 500, {
      tip: 'SISTEM_HATASI',
      detay: detay,
      cozum: 'Lütfen sistem yöneticisi ile iletişime geçin'
    });
  }
};

module.exports = {
  importIlKatsayiList,
  previewIlKatsayiImport
};

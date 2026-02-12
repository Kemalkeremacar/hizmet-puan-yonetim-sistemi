// ============================================
// SUT IMPORT CONTROLLER
// ============================================
// Excel'den SUT listesi yükleme
// ============================================

const { parseSutExcel, validateSutData, normalizeSutData, extractDateFromFilename } = require('../services/sutExcelParser');
const { compareSutLists, generateComparisonReport } = require('../services/sutComparisonService');
const { getMevcutSutData, addNewSutIslem, updateSutIslemWithVersion, deactivateSutIslem, copyUnchangedSutIslemToVersion: copySutUnchangedToVersion } = require('../services/sutVersionManager');
const { createListeVersiyon } = require('../services/versionManager');
const { success, error } = require('../utils/response');
const { getPool, sql } = require('../config/database');
const fs = require('fs');

// ============================================
// Ana Başlıkları Eşleştir (Manuel Yönetim - HUV AnaDal gibi)
// ============================================
// NOT: SutAnaBasliklar tablosu manuel yönetilir, import sırasında ekleme/silme yapılmaz
// Sadece mevcut ana başlıkları Excel'den gelen verilerle eşleştiririz
const mapAnaBasliklarToHierarchy = async (hierarchyRows, pool) => {
  if (!hierarchyRows || hierarchyRows.length === 0) {
    console.log('⚠️ Hiyerarşi satırı bulunamadı, atlıyorum');
    return {};
  }
  
  console.log(`📊 Ana başlıklar eşleştiriliyor: ${hierarchyRows.length} başlık`);
  
  // Mevcut SutAnaBasliklar'ı al
  const existingAnaBasliklar = await pool.request().query(`
    SELECT AnaBaslikNo, AnaBaslikAdi, HiyerarsiID 
    FROM SutAnaBasliklar 
    WHERE AktifMi = 1
  `);
  
  const anaBaslikMap = {}; // AnaBaslikNo -> { AnaBaslikAdi, HiyerarsiID }
  existingAnaBasliklar.recordset.forEach(ab => {
    anaBaslikMap[ab.AnaBaslikNo] = {
      AnaBaslikAdi: ab.AnaBaslikAdi,
      HiyerarsiID: ab.HiyerarsiID
    };
  });
  
  console.log(`   ℹ️ Mevcut ana başlıklar: ${Object.keys(anaBaslikMap).length} adet`);
  
  // rowIndex -> HiyerarsiID mapping (tüm seviyeler için)
  const rowIndexToHiyerarsiID = {};
  
  // Excel'den gelen ana başlıkları kontrol et ve SutHiyerarsi'ye ekle
  const anaBasliklar = hierarchyRows.filter(h => h.SeviyeNo === 1);
  const hiyerarsiIDMap = {}; // AnaBaslikNo -> HiyerarsiID
  
  for (const anaBaslik of anaBasliklar) {
    const mevcutAnaBaslik = anaBaslikMap[anaBaslik.AnaBaslikNo];
    
    if (!mevcutAnaBaslik) {
      // Mevcut ana başlık yok - UYARI VER
      console.warn(`   ⚠️ Ana başlık bulunamadı: ${anaBaslik.AnaBaslikNo} - ${anaBaslik.Baslik}`);
      console.warn(`      → Bu ana başlık SutAnaBasliklar tablosuna MANUEL eklenmelidir!`);
      hiyerarsiIDMap[anaBaslik.AnaBaslikNo] = null;
      continue;
    }
    
    // Ana başlık var - SutHiyerarsi'ye ekle veya güncelle
    if (mevcutAnaBaslik.HiyerarsiID) {
      // Zaten HiyerarsiID var, kullan
      hiyerarsiIDMap[anaBaslik.AnaBaslikNo] = mevcutAnaBaslik.HiyerarsiID;
      rowIndexToHiyerarsiID[anaBaslik.rowIndex] = mevcutAnaBaslik.HiyerarsiID;
      console.log(`   ✓ Ana başlık eşleşti: ${anaBaslik.AnaBaslikNo} - ${anaBaslik.Baslik} (HiyerarsiID: ${mevcutAnaBaslik.HiyerarsiID})`);
    } else {
      // HiyerarsiID yok, SutHiyerarsi'ye ekle
      const insertResult = await pool.request()
        .input('parentID', sql.Int, null)
        .input('seviyeNo', sql.Int, 1)
        .input('baslik', sql.NVarChar, anaBaslik.Baslik)
        .input('sira', sql.Int, anaBaslik.Sira)
        .input('aktifMi', sql.Bit, 1)
        .query(`
          INSERT INTO SutHiyerarsi (ParentID, SeviyeNo, Baslik, Sira, AktifMi, OlusturmaTarihi)
          OUTPUT INSERTED.HiyerarsiID
          VALUES (@parentID, @seviyeNo, @baslik, @sira, @aktifMi, GETDATE())
        `);
      
      const hiyerarsiID = insertResult.recordset[0].HiyerarsiID;
      hiyerarsiIDMap[anaBaslik.AnaBaslikNo] = hiyerarsiID;
      rowIndexToHiyerarsiID[anaBaslik.rowIndex] = hiyerarsiID;
      
      // SutAnaBasliklar'da HiyerarsiID'yi güncelle
      await pool.request()
        .input('anaBaslikNo', sql.Int, anaBaslik.AnaBaslikNo)
        .input('hiyerarsiID', sql.Int, hiyerarsiID)
        .query(`
          UPDATE SutAnaBasliklar
          SET HiyerarsiID = @hiyerarsiID
          WHERE AnaBaslikNo = @anaBaslikNo
        `);
      
      console.log(`   ✓ Ana başlık eklendi: ${anaBaslik.AnaBaslikNo} - ${anaBaslik.Baslik} (HiyerarsiID: ${hiyerarsiID})`);
    }
  }
  
  // Alt başlıkları kaydet (SeviyeNo >= 2) - SutHiyerarsi tablosuna
  // NOT: Alt başlıklar otomatik yönetilir (ana başlıklar gibi manuel değil)
  // Seviye sırasına göre işle (önce seviye 2, sonra 3, vs.)
  const altBasliklar = hierarchyRows.filter(h => h.SeviyeNo >= 2);
  altBasliklar.sort((a, b) => a.SeviyeNo - b.SeviyeNo || a.Sira - b.Sira);
  
  for (const altBaslik of altBasliklar) {
    // ParentRowIndex'i kullanarak parent HiyerarsiID'yi bul
    const parentHiyerarsiID = rowIndexToHiyerarsiID[altBaslik.ParentRowIndex];
    
    if (!parentHiyerarsiID) {
      console.warn(`⚠️ Alt başlık için parent bulunamadı: ${altBaslik.Baslik} (ParentRowIndex: ${altBaslik.ParentRowIndex}, Seviye: ${altBaslik.SeviyeNo})`);
      continue;
    }
    
    // Mevcut kaydı kontrol et
    const existingResult = await pool.request()
      .input('baslik', sql.NVarChar, altBaslik.Baslik)
      .input('parentID', sql.Int, parentHiyerarsiID)
      .input('seviyeNo', sql.Int, altBaslik.SeviyeNo)
      .query(`
        SELECT HiyerarsiID FROM SutHiyerarsi 
        WHERE Baslik = @baslik AND ParentID = @parentID AND SeviyeNo = @seviyeNo
      `);
    
    let hiyerarsiID;
    
    if (existingResult.recordset.length > 0) {
      // Mevcut kayıt var, güncelle
      hiyerarsiID = existingResult.recordset[0].HiyerarsiID;
      
      await pool.request()
        .input('hiyerarsiID', sql.Int, hiyerarsiID)
        .input('sira', sql.Int, altBaslik.Sira)
        .input('aktifMi', sql.Bit, 1)
        .query(`
          UPDATE SutHiyerarsi
          SET Sira = @sira, AktifMi = @aktifMi
          WHERE HiyerarsiID = @hiyerarsiID
        `);
      
      console.log(`   ✓ Alt başlık güncellendi: ${altBaslik.Baslik} (ID: ${hiyerarsiID}, Seviye: ${altBaslik.SeviyeNo})`);
    } else {
      // Yeni kayıt ekle
      const insertResult = await pool.request()
        .input('parentID', sql.Int, parentHiyerarsiID)
        .input('seviyeNo', sql.Int, altBaslik.SeviyeNo)
        .input('baslik', sql.NVarChar, altBaslik.Baslik)
        .input('sira', sql.Int, altBaslik.Sira)
        .input('aktifMi', sql.Bit, 1)
        .query(`
          INSERT INTO SutHiyerarsi (ParentID, SeviyeNo, Baslik, Sira, AktifMi, OlusturmaTarihi)
          OUTPUT INSERTED.HiyerarsiID
          VALUES (@parentID, @seviyeNo, @baslik, @sira, @aktifMi, GETDATE())
        `);
      
      hiyerarsiID = insertResult.recordset[0].HiyerarsiID;
      console.log(`   ✓ Alt başlık eklendi: ${altBaslik.Baslik} (ID: ${hiyerarsiID}, Seviye: ${altBaslik.SeviyeNo})`);
    }
    
    // rowIndex -> HiyerarsiID mapping'e ekle (bir sonraki seviye için)
    rowIndexToHiyerarsiID[altBaslik.rowIndex] = hiyerarsiID;
  }
  
  console.log(`✅ Hiyerarşi eşleştirildi: ${anaBasliklar.length} ana başlık, ${altBasliklar.length} alt başlık`);
  
  // Return the map so we can assign HiyerarsiID to işlemler
  return hiyerarsiIDMap;
};

// ============================================
// POST /api/admin/import/sut/preview
// Excel önizleme ve karşılaştırma (DRY RUN)
// ============================================
const previewSutImport = async (req, res, next) => {
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      return error(res, 'Lütfen bir Excel dosyası yükleyin', 400, {
        tip: 'DOSYA_EKSIK'
      });
    }
    
    uploadedFile = req.file.path;
    // Türkçe karakter desteği için dosya adını düzgün decode et
    const dosyaAdi = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // Parse et
    const parseResult = parseSutExcel(uploadedFile);
    if (!parseResult.success) {
      console.error('❌ SUT Excel parse hatası:', parseResult.error);
      return error(res, 'Excel dosyası okunamadı', 400, {
        tip: 'PARSE_HATASI',
        detay: parseResult.error,
        cozum: 'Dosyanın bozuk olmadığından ve Excel formatında olduğundan emin olun'
      });
    }
    
    // Validate et
    const validation = validateSutData(parseResult.data);
    if (!validation.valid) {
      console.error('❌ SUT Validation hatası:', {
        toplam: validation.stats.total,
        gecerli: validation.stats.valid,
        gecersiz: validation.stats.invalid,
        hataSayisi: validation.errors.length
      });
      
      return error(res, 'Excel dosyasında hatalı veriler bulundu', 400, {
        tip: 'VALIDATION_HATASI',
        istatistik: validation.stats,
        hatalar: validation.errors.slice(0, 50),
        uyarilar: validation.warnings.slice(0, 20),
        cozum: 'Lütfen hatalı satırları düzeltin ve tekrar deneyin'
      });
    }
    
    // Normalize et
    const normalizeResult = await normalizeSutData(validation.validData);
    const normalizedData = normalizeResult.data;
    const hierarchyRows = normalizeResult.hierarchyRows;
    
    // Mevcut verileri al
    const { getMevcutSutData } = require('../services/sutVersionManager');
    const mevcutData = await getMevcutSutData();
    
    // Karşılaştır
    const comparison = compareSutLists(mevcutData, normalizedData);
    const report = generateComparisonReport(comparison);
    
    // Dosyayı SAKLAMA - İmport geçmişi için
    // if (uploadedFile && fs.existsSync(uploadedFile)) {
    //   fs.unlinkSync(uploadedFile);
    // }
    
    return success(res, {
      dosyaAdi,
      listeTipi: 'SUT',
      summary: {
        toplamOkunan: parseResult.rowCount,
        gecerli: validation.stats.valid,
        eklenen: comparison.summary.added,
        guncellenen: comparison.summary.updated,
        degismeyen: comparison.summary.unchanged,
        silinecek: comparison.summary.deleted,
        hiyerarsi: hierarchyRows.length
      },
      comparison: report,
      uyarilar: validation.warnings.slice(0, 20),
      onizleme: {
        eklenenler: comparison.added.slice(0, 10),
        guncellenenler: comparison.updated.slice(0, 10),
        silinecekler: comparison.deleted.slice(0, 10)
      },
      hiyerarsiSatirlari: {
        toplam: hierarchyRows.length,
        kayitlar: hierarchyRows.slice(0, 50),
        aciklama: 'Excel içindeki kategori, ana başlık ve grup satırları. Bu kayıtlar SutHiyerarsi tablosunda ayrıca yönetilir ve işlem karşılaştırmasına dahil edilmez.'
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
// POST /api/admin/import/sut
// SUT listesini Excel'den yükle (Batch processing ile)
// ============================================
const importSutList = async (req, res, next) => {
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
    // Türkçe karakter desteği için dosya adını düzgün decode et
    const dosyaAdi = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // Synchronous import - basitleştirilmiş
    
    // Dosya boyutu kontrolü
    if (req.file.size > 10 * 1024 * 1024) {
      return error(res, 'Dosya boyutu çok büyük', 400, {
        tip: 'DOSYA_BOYUTU',
        cozum: 'Dosya boyutu 10 MB\'dan küçük olmalıdır'
      });
    }
    
    // 2. Excel'i parse et
    const parseResult = await parseSutExcel(uploadedFile);
    
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
    const validation = await validateSutData(parseResult.data);
    
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
    const normalizeResult = await normalizeSutData(validation.validData);
    const normalizedData = normalizeResult.data;
    const hierarchyRows = normalizeResult.hierarchyRows;
    
    console.log(`📊 Normalize sonucu: ${normalizedData.length} işlem, ${hierarchyRows.length} hiyerarşi`);
    
    // 4.5. Ana Başlıkları eşleştir (Manuel Yönetim - HUV AnaDal gibi)
    const hiyerarsiIDMap = await mapAnaBasliklarToHierarchy(hierarchyRows, pool);
    
    // 4.6. HiyerarsiID'leri işlemlere ata
    console.log(`📊 HiyerarsiIDMap içeriği:`, hiyerarsiIDMap);
    console.log(`📊 İlk 5 işlem (atama öncesi):`, normalizedData.slice(0, 5).map(i => ({ 
      SutKodu: i.SutKodu, 
      AnaBaslikNo: i.AnaBaslikNo, 
      HiyerarsiID: i.HiyerarsiID 
    })));
    
    normalizedData.forEach(islem => {
      if (islem.AnaBaslikNo && hiyerarsiIDMap[islem.AnaBaslikNo]) {
        islem.HiyerarsiID = hiyerarsiIDMap[islem.AnaBaslikNo];
      }
    });
    
    console.log(`📊 İlk 5 işlem (atama sonrası):`, normalizedData.slice(0, 5).map(i => ({ 
      SutKodu: i.SutKodu, 
      AnaBaslikNo: i.AnaBaslikNo, 
      HiyerarsiID: i.HiyerarsiID 
    })));
    console.log(`✅ HiyerarsiID'ler atandı: ${normalizedData.filter(i => i.HiyerarsiID).length} işlem`);
    
    // 5. Mevcut verileri al
    const mevcutData = await getMevcutSutData();
    
    // 6. Karşılaştır
    const comparison = compareSutLists(mevcutData, normalizedData);
    
    // 7. Yeni versiyon oluştur
    const kullaniciAdi = req.user?.username || 
                        req.headers['x-user-name'] || 
                        'admin';
    
    let yuklemeTarihi = req.body.yuklemeTarihi;
    if (!yuklemeTarihi) {
      const extractedDate = extractDateFromFilename(dosyaAdi);
      yuklemeTarihi = extractedDate ? new Date(extractedDate) : new Date();
    } else {
      // String ise Date objesine çevir
      yuklemeTarihi = new Date(yuklemeTarihi);
    }
    
    const versionID = await createListeVersiyon(
      dosyaAdi,
      normalizedData.length,
      `${comparison.summary.added} eklendi, ${comparison.summary.updated} güncellendi, ${comparison.summary.deleted} silindi, ${comparison.summary.unchanged} değişmedi`,
      kullaniciAdi,
      yuklemeTarihi,
      'SUT'
    );
    
    // 8. Değişiklikleri uygula
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Ekleme
      for (const item of comparison.added) {
        await addNewSutIslem(item, versionID, yuklemeTarihi);
      }
      
      // Güncelleme
      for (const item of comparison.updated) {
        await updateSutIslemWithVersion(item.SutID, item, versionID, yuklemeTarihi);
      }
      
      // Silme (pasif yapma)
      for (const item of comparison.deleted) {
        await deactivateSutIslem(item.SutID, versionID, yuklemeTarihi);
      }
      
      // Değişmeyen kayıtlar için version kopyala
      for (const item of comparison.unchanged) {
        const mevcutItem = mevcutData.find(m => m.SutID === item.SutID);
        await copySutUnchangedToVersion(item.SutID, mevcutItem, versionID, yuklemeTarihi);
      }
      
      await transaction.commit();
      
      // Dosyayı SAKLAMA - İmport geçmişi için
      
      return success(res, {
        versionID: versionID,
        summary: comparison.summary,
        listeTipi: 'SUT'
      }, 'SUT listesi başarıyla import edildi');
      
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
    
  } catch (err) {
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      fs.unlinkSync(uploadedFile);
    }
    next(err);
  }
};

module.exports = {
  importSutList,
  previewSutImport
};

// ============================================
// IMPORT CONTROLLER
// ============================================
// Excel'den HUV listesi yükleme
// ============================================

const { parseHuvExcel, validateHuvData, normalizeHuvData, extractDateFromFilename } = require('../services/excelParser');
const { compareHuvLists, generateComparisonReport } = require('../services/comparisonService');
const {
  createListeVersiyon,
  getAktifVersiyon,
  getMevcutHuvData,
  updateIslemWithVersion,
  addNewIslem,
  deactivateIslem,
  copyUnchangedIslemToVersion
} = require('../services/versionManager');
// Batch import removed - using synchronous import only
const { success, error } = require('../utils/response');
const { getPool, sql } = require('../config/database');
const fs = require('fs');
const crypto = require('crypto');

// UUID oluştur (crypto kullanarak, uuid paketi yerine)
const generateJobId = () => {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// POST /api/admin/import/preview
// Excel önizleme ve karşılaştırma (DRY RUN)
// ============================================
const previewImport = async (req, res, next) => {
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
    const parseResult = parseHuvExcel(uploadedFile);
    if (!parseResult.success) {
      return error(res, 'Excel dosyası okunamadı', 400, {
        tip: 'PARSE_HATASI',
        detay: parseResult.error
      });
    }
    
    // Validate et
    const validation = validateHuvData(parseResult.data);
    if (!validation.valid) {
      return error(res, 'Excel dosyasında hatalı veriler bulundu', 400, {
        tip: 'VALIDATION_HATASI',
        istatistik: validation.stats,
        hatalar: validation.errors.slice(0, 50),
        uyarilar: validation.warnings.slice(0, 20)
      });
    }
    
    // Normalize et
    const normalizedData = await normalizeHuvData(validation.validData);
    
    // Mevcut verileri al
    const mevcutData = await getMevcutHuvData();
    
    // Karşılaştır
    const comparison = compareHuvLists(mevcutData, normalizedData);
    const report = generateComparisonReport(comparison);
    
    // Dosyayı SAKLAMA - İmport geçmişi için
    // if (uploadedFile && fs.existsSync(uploadedFile)) {
    //   fs.unlinkSync(uploadedFile);
    // }
    
    return success(res, {
      dosyaAdi,
      listeTipi: 'HUV',
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
// POST /api/admin/import/huv
// HUV listesini Excel'den yükle (Batch processing ile)
// Query param: useBatch=true (default: true)
// ============================================
const importHuvList = async (req, res, next) => {
  const startTime = Date.now();
  let uploadedFile = null;
  
  try {
    // Pool'u al
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
      return error(res, `Dosya boyutu çok büyük (${fileSizeMB} MB)`, 400, {
        tip: 'DOSYA_BOYUTU',
        cozum: 'Dosya boyutu 10 MB\'dan küçük olmalıdır'
      });
    }
    
    // 2. Excel'i parse et
    const parseResult = parseHuvExcel(uploadedFile);
    
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
    const validation = validateHuvData(parseResult.data);
    
    if (!validation.valid) {
      return error(res, 'Excel dosyasında hatalı veriler bulundu', 400, {
        tip: 'VALIDATION_HATASI',
        istatistik: validation.stats,
        hatalar: validation.errors.slice(0, 20), // İlk 20 hata
        uyarilar: validation.warnings.slice(0, 10), // İlk 10 uyarı
        cozum: 'Lütfen hatalı satırları düzeltin ve tekrar deneyin',
        detay: `${validation.stats.invalid} satırda hata bulundu. İlk ${Math.min(20, validation.errors.length)} hata gösteriliyor.`
      });
    }
    
    // 4. Normalize et
    const normalizedData = await normalizeHuvData(validation.validData);
    
    // 5. Mevcut verileri al
    const mevcutData = await getMevcutHuvData();
    
    // 6. Karşılaştır
    const comparison = compareHuvLists(mevcutData, normalizedData);
    
    // 7. Yeni versiyon oluştur
    
    // Kullanıcı adını al (şimdilik req.user veya header'dan)
    const kullaniciAdi = req.user?.username || 
                        req.headers['x-user-name'] || 
                        'admin';
    
    // Yükleme tarihini al
    // 1. Önce body'den al (frontend'den gönderilirse)
    // 2. Dosya adından çıkarmayı dene (07.10.2025.xls → 2025-10-07)
    // 3. Yoksa bugünün tarihini kullan
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
      `${comparison.summary.added} eklendi, ${comparison.summary.updated} güncellendi`,
      kullaniciAdi,
      yuklemeTarihi
    );
    
    // 8. Değişiklikleri uygula
    
    // Yükleme tarihini kullan (versiyon oluşturma tarihiyle aynı)
    const yuklemeTarihiDate = new Date(yuklemeTarihi);
    let eklenenSayisi = 0;
    let guncellenenSayisi = 0;
    let pasifYapilanSayisi = 0;
    let kopyalananSayisi = 0;
    const hatalar = [];
    
    // Yeni eklenenleri ekle
    for (const item of comparison.added) {
      try {
        const yeniData = normalizedData.find(d => d.HuvKodu === item.HuvKodu);
        await addNewIslem(yeniData, versionID, yuklemeTarihiDate);
        eklenenSayisi++;
      } catch (err) {
        console.error(`❌ Ekleme hatası [${item.HuvKodu}]:`, err.message);
        hatalar.push({
          HuvKodu: item.HuvKodu,
          hata: err.message
        });
      }
    }
    
    // Güncellenenleri güncelle (SCD Type 2)
    for (const item of comparison.updated) {
      try {
        const eskiIslem = mevcutData.find(d => d.HuvKodu === item.HuvKodu);
        const yeniData = normalizedData.find(d => d.HuvKodu === item.HuvKodu);
        
        await updateIslemWithVersion(eskiIslem.IslemID, yeniData, versionID, yuklemeTarihi);
        guncellenenSayisi++;
      } catch (err) {
        hatalar.push({
          HuvKodu: item.HuvKodu,
          hata: err.message
        });
      }
    }
    
    // Silinenleri pasif yap
    for (const item of comparison.deleted) {
      try {
        const eskiIslem = mevcutData.find(d => d.HuvKodu === item.HuvKodu);
        await deactivateIslem(eskiIslem.IslemID, versionID, yuklemeTarihi);
        pasifYapilanSayisi++;
      } catch (err) {
        hatalar.push({
          HuvKodu: item.HuvKodu,
          hata: err.message
        });
      }
    }
    
    // Değişmeyenleri yeni versiyona kopyala (IslemVersionlar'a da kaydet!)
    let progressCounter = 0;
    for (const item of comparison.unchanged) {
      try {
        const eskiIslem = mevcutData.find(d => d.HuvKodu === item.HuvKodu);
        await copyUnchangedIslemToVersion(eskiIslem.IslemID, eskiIslem, versionID, yuklemeTarihi);
        kopyalananSayisi++;
        progressCounter++;
      } catch (err) {
        console.error(`❌ Kopyalama hatası [${item.HuvKodu}]:`, err.message);
        hatalar.push({
          HuvKodu: item.HuvKodu,
          hata: err.message
        });
      }
    }
    
    // 9. Rapor oluştur
    const report = generateComparisonReport(comparison);
    
    // 10. Dosyayı sil
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      fs.unlinkSync(uploadedFile);
    }
    
    // 11. ListeVersiyon tablosundaki özet sayıları güncelle
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
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // 11. Sonuç döndür
    return success(res, {
      versionID,
      dosyaAdi,
      summary: {
        added: eklenenSayisi,
        updated: guncellenenSayisi,
        deleted: pasifYapilanSayisi,
        unchanged: kopyalananSayisi
      },
      duration: `${duration} saniye`,
      errors: hatalar.length > 0 ? hatalar : undefined
    }, 'HUV listesi başarıyla yüklendi', 201);
    
  } catch (err) {
    // Hata durumunda dosyayı sil
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      fs.unlinkSync(uploadedFile);
    }
    
    // Hata loglama
    console.error('❌ Import hatası:', err);
    console.error('❌ Hata detayı:', err.message);
    console.error('❌ Stack trace:', err.stack);
    
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    };
    
    // Türkçe hata mesajı
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
      detay = 'Aynı HuvKodu ile birden fazla kayıt var';
    }
    
    return error(res, mesaj, 500, {
      tip: 'SISTEM_HATASI',
      detay: detay,
      cozum: 'Lütfen sistem yöneticisi ile iletişime geçin'
    });
  }
};

// ============================================
// GET /api/admin/import/history
// Import geçmişini listele
// ============================================
const getImportHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    
    // Toplam kayıt
    const countResult = await pool.request()
      .query('SELECT COUNT(*) as total FROM ListeVersiyon WHERE ListeTipi = \'HUV\'');
    const total = countResult.recordset[0].total;
    
    // Veriler
    const result = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT 
          VersionID,
          ListeTipi,
          YuklemeTarihi,
          DosyaAdi,
          KayitSayisi,
          Aciklama,
          YukleyenKullanici,
          OlusturmaTarihi
        FROM ListeVersiyon
        WHERE ListeTipi = 'HUV'
        ORDER BY VersionID DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);
    
    return success(res, {
      data: result.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Import geçmişi');
    
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/admin/import/report/:versionId
// Import detay raporu
// ============================================
const getImportReport = async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const pool = await getPool();
    
    // Versiyon bilgisi
    const versionResult = await pool.request()
      .input('versionId', sql.Int, parseInt(versionId))
      .query('SELECT * FROM ListeVersiyon WHERE VersionID = @versionId');
    
    if (versionResult.recordset.length === 0) {
      return error(res, 'Versiyon bulunamadı', 404);
    }
    
    const version = versionResult.recordset[0];
    
    // Bu versiyonda eklenen işlemler
    // IslemVersionlar tablosunda DegisiklikSebebi'ne göre yeni eklenen işlemleri bul
    const addedResult = await pool.request()
      .input('versionId', sql.Int, parseInt(versionId))
      .query(`
        SELECT TOP 100
          i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim, a.BolumAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        INNER JOIN IslemVersionlar v ON i.IslemID = v.IslemID AND v.ListeVersiyonID = @versionId
        WHERE v.DegisiklikSebebi IN ('Yeni işlem eklendi', 'Pasif işlem tekrar aktif edildi', 'Silinmiş işlem tekrar eklendi')
        ORDER BY i.HuvKodu
      `);
    
    // Bu versiyonda güncellenen işlemler
    // IslemVersionlar tablosunda DegisiklikSebebi'ne göre güncellenen işlemleri bul
    const updatedResult = await pool.request()
      .input('versionId', sql.Int, parseInt(versionId))
      .query(`
        SELECT TOP 100
          i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim,
          v_curr.Birim as YeniBirim,
          v_prev.Birim as EskiBirim,
          v_prev.IslemAdi as EskiIslemAdi,
          v_prev.SutKodu as EskiSutKodu,
          v_prev.[Not] as EskiNot,
          a.BolumAdi,
          -- Hangi alanlar değişmiş
          CASE WHEN ABS(ISNULL(v_curr.Birim, 0) - ISNULL(v_prev.Birim, 0)) > 0.01 THEN 1 ELSE 0 END as BirimDegisti,
          CASE WHEN v_curr.IslemAdi != v_prev.IslemAdi THEN 1 ELSE 0 END as IslemAdiDegisti,
          CASE WHEN ISNULL(v_curr.SutKodu, '') != ISNULL(v_prev.SutKodu, '') THEN 1 ELSE 0 END as SutKoduDegisti,
          CASE WHEN ISNULL(v_curr.[Not], '') != ISNULL(v_prev.[Not], '') THEN 1 ELSE 0 END as NotDegisti
        FROM IslemVersionlar v_curr
        INNER JOIN HuvIslemler i ON v_curr.IslemID = i.IslemID
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        INNER JOIN IslemVersionlar v_prev ON v_curr.IslemID = v_prev.IslemID 
          AND v_prev.VersionID = (
            SELECT MAX(VersionID) 
            FROM IslemVersionlar 
            WHERE IslemID = v_curr.IslemID AND ListeVersiyonID < @versionId
          )
        WHERE v_curr.ListeVersiyonID = @versionId
        AND v_curr.DegisiklikSebebi = 'HUV listesi güncellendi'
        ORDER BY i.HuvKodu
      `);
    
    // Bu versiyonda silinen işlemler
    // IslemVersionlar'da GecerlilikBitis set edilen kayıtlar
    const deletedResult = await pool.request()
      .input('versionId', sql.Int, parseInt(versionId))
      .query(`
        -- Bu versiyonda kapatılan (GecerlilikBitis set edilen) kayıtları bul
        SELECT TOP 100
          i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim,
          a.BolumAdi
        FROM IslemVersionlar v
        INNER JOIN HuvIslemler i ON v.IslemID = i.IslemID
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE v.GecerlilikBitis IS NOT NULL
        AND v.GecerlilikBitis >= (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId)
        AND v.GecerlilikBitis < DATEADD(DAY, 1, (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId))
        AND NOT EXISTS (
          -- Bu versiyonda tekrar aktif edilmemiş olmalı
          SELECT 1 FROM IslemVersionlar v2
          WHERE v2.IslemID = v.IslemID
          AND v2.ListeVersiyonID = @versionId
          AND v2.AktifMi = 1
        )
        ORDER BY i.HuvKodu
      `);
    
    // Audit kayıtları
    const auditResult = await pool.request()
      .input('versionId', sql.Int, parseInt(versionId))
      .query(`
        SELECT TOP 100
          AuditID, IslemID, IslemTipi, HuvKodu, IslemAdi,
          EskiBirim, YeniBirim, DegisiklikTarihi, DegistirenKullanici, Aciklama
        FROM IslemAudit
        WHERE DegisiklikTarihi >= (SELECT OlusturmaTarihi FROM ListeVersiyon WHERE VersionID = @versionId)
        ORDER BY DegisiklikTarihi DESC
      `);
    
    return success(res, {
      version,
      summary: {
        eklenen: addedResult.recordset.length,
        guncellenen: updatedResult.recordset.length,
        silinen: deletedResult.recordset.length,
        toplamAudit: auditResult.recordset.length
      },
      eklenenler: addedResult.recordset,
      guncellenenler: updatedResult.recordset,
      silinenler: deletedResult.recordset,
      auditKayitlari: auditResult.recordset
    }, 'Import raporu');
    
  } catch (err) {
    next(err);
  }
};
module.exports = {
  importHuvList,
  getImportHistory,
  previewImport,
  getImportReport
};

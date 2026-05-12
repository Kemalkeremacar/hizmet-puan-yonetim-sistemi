// ============================================
// SUT IMPORT CONTROLLER
// ============================================
// Excel'den SUT listesi yükleme
// ============================================

const { parseSutExcel, validateSutData, normalizeSutData } = require('../services/sutExcelParser');
const { compareSutLists, generateComparisonReport } = require('../services/sutComparisonService');
const { getMevcutSutData, addNewSutIslem, updateSutIslemWithVersion, deactivateSutIslem } = require('../services/sutVersionManager');
const { createListeVersiyon } = require('../services/versionManager');
const { success, error } = require('../utils/response');
const { getPool, sql } = require('../config/database');
const { clearStartDateCache } = require('../utils/dateUtils');
const { decodeDosyaAdi } = require('../utils/fileCleanup');
const fs = require('fs');

// ============================================
// Ana Başlıkları Eşleştir (EXCEL-FIRST Yaklaşımı)
// ============================================
// SutAnaBasliklar ve SutHiyerarsi tablolarını Excel'den otomatik populate et
// İlk import'ta bile DB boş olabilir, Excel'den tüm yapı oluşturulur
const mapAnaBasliklarToHierarchy = async (hierarchyRows, pool) => {
  if (!hierarchyRows || hierarchyRows.length === 0) {
    return {};
  }
  
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
  
  // rowIndex -> HiyerarsiID mapping (tüm seviyeler için)
  const rowIndexToHiyerarsiID = {};
  
  // Excel'den gelen ana başlıkları kontrol et ve otomatik ekle
  const anaBasliklar = hierarchyRows.filter(h => h.SeviyeNo === 1);
  const hiyerarsiIDMap = {}; // AnaBaslikNo -> HiyerarsiID
  
  for (const anaBaslik of anaBasliklar) {
    let mevcutAnaBaslik = anaBaslikMap[anaBaslik.AnaBaslikNo];
    
    if (!mevcutAnaBaslik) {
      // ✨ EXCEL-FIRST: Mevcut ana başlık yok - OTOMATIK EKLE
      // 1. Önce SutHiyerarsi'ye ekle (Seviye 1)
      const insertHiyerarsiResult = await pool.request()
        .input('parentID', sql.Int, null)
        .input('seviyeNo', sql.Int, 1)
        .input('baslik', sql.NVarChar, anaBaslik.Baslik)
        .input('sira', sql.Int, anaBaslik.AnaBaslikNo)
        .input('aktifMi', sql.Bit, 1)
        .query(`
          INSERT INTO SutHiyerarsi (ParentID, SeviyeNo, Baslik, Sira, AktifMi, OlusturmaTarihi)
          OUTPUT INSERTED.HiyerarsiID
          VALUES (@parentID, @seviyeNo, @baslik, @sira, @aktifMi, GETDATE())
        `);
      
      const hiyerarsiID = insertHiyerarsiResult.recordset[0].HiyerarsiID;
      
      // 2. Sonra SutAnaBasliklar'a ekle
      await pool.request()
        .input('anaBaslikNo', sql.Int, anaBaslik.AnaBaslikNo)
        .input('anaBaslikAdi', sql.NVarChar, anaBaslik.Baslik)
        .input('hiyerarsiID', sql.Int, hiyerarsiID)
        .input('aktifMi', sql.Bit, 1)
        .query(`
          INSERT INTO SutAnaBasliklar (AnaBaslikNo, AnaBaslikAdi, HiyerarsiID, AktifMi, OlusturmaTarihi)
          VALUES (@anaBaslikNo, @anaBaslikAdi, @hiyerarsiID, @aktifMi, GETDATE())
        `);
      
      // Map'i güncelle
      mevcutAnaBaslik = {
        AnaBaslikAdi: anaBaslik.Baslik,
        HiyerarsiID: hiyerarsiID
      };
      anaBaslikMap[anaBaslik.AnaBaslikNo] = mevcutAnaBaslik;
    }
    
    // Ana başlık var - HiyerarsiID'yi kontrol et ve gerekirse güncelle
    if (mevcutAnaBaslik.HiyerarsiID) {
      // Zaten HiyerarsiID var, kullan
      hiyerarsiIDMap[anaBaslik.AnaBaslikNo] = mevcutAnaBaslik.HiyerarsiID;
      rowIndexToHiyerarsiID[anaBaslik.rowIndex] = mevcutAnaBaslik.HiyerarsiID;
      
      // Başlık adı değişmişse güncelle
      if (mevcutAnaBaslik.AnaBaslikAdi !== anaBaslik.Baslik) {
        await pool.request()
          .input('hiyerarsiID', sql.Int, mevcutAnaBaslik.HiyerarsiID)
          .input('baslik', sql.NVarChar, anaBaslik.Baslik)
          .query(`
            UPDATE SutHiyerarsi
            SET Baslik = @baslik
            WHERE HiyerarsiID = @hiyerarsiID
          `);
        
        await pool.request()
          .input('anaBaslikNo', sql.Int, anaBaslik.AnaBaslikNo)
          .input('anaBaslikAdi', sql.NVarChar, anaBaslik.Baslik)
          .query(`
            UPDATE SutAnaBasliklar
            SET AnaBaslikAdi = @anaBaslikAdi
            WHERE AnaBaslikNo = @anaBaslikNo
          `);
      }
    } else {
      // HiyerarsiID yok ama kayıt var - SutHiyerarsi'ye ekle ve bağla
      const insertResult = await pool.request()
        .input('parentID', sql.Int, null)
        .input('seviyeNo', sql.Int, 1)
        .input('baslik', sql.NVarChar, anaBaslik.Baslik)
        .input('sira', sql.Int, anaBaslik.AnaBaslikNo)
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
    }
    
    // rowIndex -> HiyerarsiID mapping'e ekle (bir sonraki seviye için)
    rowIndexToHiyerarsiID[altBaslik.rowIndex] = hiyerarsiID;
  }
  
  // Return both maps: AnaBaslikNo -> HiyerarsiID ve rowIndex -> HiyerarsiID
  return {
    anaBaslikMap: hiyerarsiIDMap, // AnaBaslikNo -> HiyerarsiID (fallback için)
    rowIndexMap: rowIndexToHiyerarsiID // rowIndex -> HiyerarsiID (doğru eşleştirme için)
  };
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
    const dosyaAdi = decodeDosyaAdi(req.file.originalname);
    
    // Parse et
    const parseResult = parseSutExcel(uploadedFile);
    if (!parseResult.success) {
      return error(res, 'Excel dosyası okunamadı', 400, {
        tip: 'PARSE_HATASI',
        detay: parseResult.error,
        cozum: 'Dosyanın bozuk olmadığından ve Excel formatında olduğundan emin olun'
      });
    }
    
    // Validate et
    const validation = validateSutData(parseResult.data);
    if (!validation.valid) {
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
    const mevcutData = await getMevcutSutData();
    
    // Karşılaştır
    const comparison = compareSutLists(mevcutData, normalizedData);
    const report = generateComparisonReport(comparison);
    
    // Değişiklik dağılımını tüm güncellenenlerden hesapla
    const changeDist = {};
    comparison.updated.forEach(item => {
      (item.changes || []).forEach(c => {
        changeDist[c.field] = (changeDist[c.field] || 0) + 1;
      });
    });
    
    return success(res, {
      dosyaAdi,
      listeTipi: 'SUT',
      summary: {
        toplamOkunan: normalizedData.length,
        gecerli: normalizedData.length,
        hiyerarsi: hierarchyRows.length,
        hatali: validation.stats.invalid,
        atlanan: parseResult.rowCount - normalizedData.length - hierarchyRows.length - validation.stats.invalid,
        eklenen: comparison.summary.added,
        guncellenen: comparison.summary.updated,
        degismeyen: comparison.summary.unchanged,
        silinecek: comparison.summary.deleted,
        degisiklikDagilimi: changeDist
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
    const dosyaAdi = decodeDosyaAdi(req.file.originalname);
    
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
    
    // 4.5. Ana Başlıkları eşleştir (Manuel Yönetim - HUV AnaDal gibi)
    const hiyerarsiMaps = await mapAnaBasliklarToHierarchy(hierarchyRows, pool);
    const anaBaslikMap = hiyerarsiMaps.anaBaslikMap; // AnaBaslikNo -> HiyerarsiID (fallback)
    const rowIndexMap = hiyerarsiMaps.rowIndexMap; // rowIndex -> HiyerarsiID (doğru eşleştirme)
    
    // 4.6. HiyerarsiID'leri işlemlere ata (rowIndex'e göre en yakın üstteki hiyerarşi node'u)
    // Hiyerarşi rowIndex'lerini sırala (yukarıdan aşağıya)
    const sortedHierarchyIndices = Object.keys(rowIndexMap)
      .map(Number)
      .sort((a, b) => a - b);
    
    normalizedData.forEach(islem => {
      if (!islem.rowIndex && islem.rowIndex !== 0) {
        // rowIndex yoksa fallback: Ana başlığa ata
        if (islem.AnaBaslikNo && anaBaslikMap[islem.AnaBaslikNo]) {
          islem.HiyerarsiID = anaBaslikMap[islem.AnaBaslikNo];
        }
        return;
      }
      
      // İşlemin rowIndex'ine göre en yakın üstteki hiyerarşi node'unu bul
      let assignedHiyerarsiID = null;
      
      // rowIndex'e göre doğrudan eşleşme var mı?
      if (rowIndexMap[islem.rowIndex]) {
        assignedHiyerarsiID = rowIndexMap[islem.rowIndex];
      } else {
        // En yakın üstteki hiyerarşi node'unu bul
        for (let i = sortedHierarchyIndices.length - 1; i >= 0; i--) {
          const hierarchyIndex = sortedHierarchyIndices[i];
          if (hierarchyIndex < islem.rowIndex) {
            assignedHiyerarsiID = rowIndexMap[hierarchyIndex];
            break;
          }
        }
      }
      
      // ÖZEL KURAL: Ana Başlık 4 (AMELİYATHANE) için
      // İşlem adından anlaşılacak şekilde doğru üst dalına bağla
      if (islem.AnaBaslikNo === 4) {
        const islemAdi = (islem.IslemAdi || '').trim();
        const islemAdiLower = islemAdi.toLowerCase();
        
        // ÖZEL DURUM: "Yenidoğan ek puanı X grubu" işlemleri
        // Bu işlemler kendi gruplarına (A1, A2, A3, B, C, D, E) bağlanmalı
        const yenidoganMatch = islemAdi.match(/yenidoğan\s+ek\s+puanı\s+([A-Z]\d?)\s+grubu/i);
        if (yenidoganMatch) {
          const grupAdi = `${yenidoganMatch[1]} grubu`;
          const grupBaslik = hierarchyRows.find(h => 
            h.AnaBaslikNo === 4 && 
            h.SeviyeNo === 2 && 
            h.Baslik && 
            h.Baslik.toLowerCase().includes(grupAdi.toLowerCase())
          );
          
          if (grupBaslik && rowIndexMap[grupBaslik.rowIndex]) {
            assignedHiyerarsiID = rowIndexMap[grupBaslik.rowIndex];
          }
        } else {
          // Normal işlemler: AMELİYATHANE veya AMELİYATHANE DIŞI'na bağla
          const ameliyathaneDisiRow = hierarchyRows.find(h => 
            h.AnaBaslikNo === 4 && 
            h.SeviyeNo === 2 && 
            h.Baslik && 
            h.Baslik.toUpperCase().includes('AMELİYATHANE') && 
            h.Baslik.toUpperCase().includes('DIŞI')
          );
          
          const ameliyathaneRow = hierarchyRows.find(h => 
            h.AnaBaslikNo === 4 && 
            h.SeviyeNo === 2 && 
            h.Baslik && 
            h.Baslik.toUpperCase().includes('AMELİYATHANE') && 
            !h.Baslik.toUpperCase().includes('DIŞI')
          );
          
          // İşlem adından anla: "AMELİYATHANE DIŞI" mı "AMELİYATHANE" mi?
          if (islemAdiLower.includes('dışı') || islemAdiLower.includes('disi')) {
            // AMELİYATHANE DIŞI'na bağla
            if (ameliyathaneDisiRow && rowIndexMap[ameliyathaneDisiRow.rowIndex]) {
              assignedHiyerarsiID = rowIndexMap[ameliyathaneDisiRow.rowIndex];
            }
          } else if (islemAdiLower.includes('ameliyathane') || islemAdiLower.includes('ameliyat')) {
            // AMELİYATHANE'ye bağla
            if (ameliyathaneRow && rowIndexMap[ameliyathaneRow.rowIndex]) {
              assignedHiyerarsiID = rowIndexMap[ameliyathaneRow.rowIndex];
            }
          }
        }
        // Eğer işlem adında hiçbir ipucu yoksa, mevcut atamayı koru (rowIndex'e göre)
      }
      
      // Eğer hiyerarşi node'u bulunamazsa, ana başlığa ata (fallback)
      if (!assignedHiyerarsiID && islem.AnaBaslikNo && anaBaslikMap[islem.AnaBaslikNo]) {
        assignedHiyerarsiID = anaBaslikMap[islem.AnaBaslikNo];
      }
      
      islem.HiyerarsiID = assignedHiyerarsiID;
    });
    
    // 5. Mevcut verileri al
    const mevcutData = await getMevcutSutData();
    
    // 6. Karşılaştır
    const comparison = compareSutLists(mevcutData, normalizedData);
    
    // 7. Yeni versiyon oluştur
    const kullaniciAdi = req.user?.kullaniciAdi || 
                        req.headers['x-user-name'] || 
                        'admin';
    
    // Yükleme tarihi: Frontend'den gönderilirse kullan, yoksa server-side import anı.
    // Dosya adından / Excel'den tarih çıkarma KALDIRILDI - import anı esas alınır.
    let yuklemeTarihi;
    if (req.body.yuklemeTarihi) {
      const yt = req.body.yuklemeTarihi.toString();
      yuklemeTarihi = /^\d{4}-\d{2}-\d{2}$/.test(yt)
        ? new Date(yt + 'T00:00:00')
        : new Date(yt);
    } else {
      const bugun = new Date();
      yuklemeTarihi = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
    }
    
    // 8. Değişiklikleri atomik olarak uygula (tek transaction)
    let versionID = null;
    const transaction = pool.transaction();
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    
    try {
      versionID = await createListeVersiyon(
        dosyaAdi,
        normalizedData.length,
        `${comparison.summary.added} eklendi, ${comparison.summary.updated} güncellendi, ${comparison.summary.deleted} silindi, ${comparison.summary.unchanged} değişmedi`,
        kullaniciAdi,
        yuklemeTarihi,
        'SUT',
        transaction
      );
      
      // Ekleme
      for (const item of comparison.added) {
        await addNewSutIslem(item, versionID, yuklemeTarihi, transaction);
      }
      
      // Güncelleme
      for (const item of comparison.updated) {
        await updateSutIslemWithVersion(item.SutID, item, versionID, yuklemeTarihi, transaction);
      }
      
      // Silme (pasif yapma)
      for (const item of comparison.deleted) {
        await deactivateSutIslem(item.SutID, versionID, yuklemeTarihi, transaction);
      }
      
      // ListeVersiyon tablosundaki özet sayıları güncelle
      await transaction.request()
        .input('versionId', sql.Int, versionID)
        .input('eklenenSayisi', sql.Int, comparison.summary.added)
        .input('guncellenenSayisi', sql.Int, comparison.summary.updated)
        .input('silinenSayisi', sql.Int, comparison.summary.deleted)
        .query(`
          UPDATE ListeVersiyon
          SET 
            EklenenSayisi = @eklenenSayisi,
            GuncellenenSayisi = @guncellenenSayisi,
            SilinenSayisi = @silinenSayisi
          WHERE VersionID = @versionId
        `);
      
      await transaction.commit();
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      // Otomatik eşleştirme (transaction dışında - import'u etkilememeli)
      let matchingSummary = null;
      if (comparison.summary.added > 0 || comparison.summary.updated > 0) {
        try {
          const MatchingEngine = require('../services/matching/MatchingEngine');
          const matchingEngine = new MatchingEngine(pool);
          matchingSummary = await matchingEngine.runBatch({
            batchSize: 10000,
            anaDalKodu: null,
            forceRematch: false
          });
        } catch (matchErr) {
          console.error('Otomatik eşleştirme hatası (import başarılı):', matchErr.message);
        }
      }
      
      clearStartDateCache();
      
      return success(res, {
        versionID: versionID,
        summary: comparison.summary,
        matchingSummary: matchingSummary,
        listeTipi: 'SUT',
        duration: `${duration} saniye`
      }, 'SUT listesi başarıyla import edildi');
      
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Transaction rollback hatası:', rollbackErr.message);
      }
      
      // Hata mesajını yeniden fırlat
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

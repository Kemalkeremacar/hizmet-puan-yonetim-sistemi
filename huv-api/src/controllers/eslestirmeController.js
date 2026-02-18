// ============================================
// EŞLEŞTİRME KONTROL CONTROLLER
// ============================================
// Doktor kontrolü, manuel düzenleme
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const cache = require('../utils/cache');

// ============================================
// POST /api/external/eslestirme/kontrol
// Yeni kontrol kaydı oluştur (low confidence için)
// ============================================
const createKontrol = async (req, res, next) => {
  try {
    const { sutId, sutKodu, huvUstTeminatKod, huvAltTeminatKod, eslestirmeSkoru, eslestirmeTipi, lowConfidence } = req.body;
    const kullaniciId = req.user.kullaniciId;

    // Detaylı validasyon
    if (!sutId) {
      return error(res, 'SutID eksik', 400);
    }
    if (!sutKodu || typeof sutKodu !== 'string' || sutKodu.trim() === '') {
      return error(res, 'SutKodu eksik veya geçersiz', 400);
    }
    if (!huvUstTeminatKod || typeof huvUstTeminatKod !== 'string' || huvUstTeminatKod.trim() === '') {
      console.error('❌ HuvUstTeminatKod hatası:', { 
        huvUstTeminatKod, 
        type: typeof huvUstTeminatKod,
        body: req.body 
      });
      return error(res, 'HuvUstTeminatKod eksik veya geçersiz', 400);
    }
    if (!huvAltTeminatKod || typeof huvAltTeminatKod !== 'string' || huvAltTeminatKod.trim() === '') {
      console.error('❌ HuvAltTeminatKod hatası:', { 
        huvAltTeminatKod, 
        type: typeof huvAltTeminatKod,
        body: req.body 
      });
      return error(res, 'HuvAltTeminatKod eksik veya geçersiz', 400);
    }
    
    // String'leri temizle ve normalize et
    const cleanHuvUstTeminatKod = String(huvUstTeminatKod).trim();
    const cleanHuvAltTeminatKod = String(huvAltTeminatKod).trim();
    const cleanSutKodu = String(sutKodu).trim();
    
    if (!cleanHuvUstTeminatKod || !cleanHuvAltTeminatKod || !cleanSutKodu) {
      return error(res, 'Teminat kodları boş olamaz', 400);
    }

    const pool = await getPool();
    
    // Aynı kontrol kaydı var mı kontrol et
    const mevcutKontrol = await pool.request()
      .input('SutID', sql.Int, sutId)
      .input('HuvUstTeminatKod', sql.NVarChar, cleanHuvUstTeminatKod)
      .input('HuvAltTeminatKod', sql.NVarChar, cleanHuvAltTeminatKod)
      .input('AktifMi', sql.Bit, true)
      .query(`
        SELECT TOP 1 KontrolID, Durum
        FROM SutEslestirmeKontrolleri
        WHERE SutID = @SutID
          AND HuvUstTeminatKod = @HuvUstTeminatKod
          AND HuvAltTeminatKod = @HuvAltTeminatKod
          AND AktifMi = @AktifMi
      `);

    if (mevcutKontrol.recordset.length > 0) {
      return success(res, {
        kontrolId: mevcutKontrol.recordset[0].KontrolID,
        durum: mevcutKontrol.recordset[0].Durum,
        mesaj: 'Bu kontrol kaydı zaten mevcut'
      }, 'Kontrol kaydı mevcut');
    }

    // Yeni kontrol kaydı oluştur
    const result = await pool.request()
      .input('SutID', sql.Int, sutId)
      .input('SutKodu', sql.NVarChar, cleanSutKodu)
      .input('HuvUstTeminatKod', sql.NVarChar, cleanHuvUstTeminatKod)
      .input('HuvAltTeminatKod', sql.NVarChar, cleanHuvAltTeminatKod)
      .input('EslestirmeSkoru', sql.Decimal(5, 3), eslestirmeSkoru || 0)
      .input('EslestirmeTipi', sql.NVarChar, eslestirmeTipi || 'benzerlik')
      .input('LowConfidence', sql.Bit, lowConfidence || false)
      .input('OlusturanKullaniciID', sql.Int, kullaniciId)
      .query(`
        INSERT INTO SutEslestirmeKontrolleri 
          (SutID, SutKodu, HuvUstTeminatKod, HuvAltTeminatKod, EslestirmeSkoru, EslestirmeTipi, LowConfidence, Durum, OlusturanKullaniciID)
        OUTPUT INSERTED.KontrolID, INSERTED.Durum
        VALUES 
          (@SutID, @SutKodu, @HuvUstTeminatKod, @HuvAltTeminatKod, @EslestirmeSkoru, @EslestirmeTipi, @LowConfidence, 'beklemede', @OlusturanKullaniciID)
      `);

    return success(res, {
      kontrolId: result.recordset[0].KontrolID,
      durum: result.recordset[0].Durum
    }, 'Kontrol kaydı oluşturuldu');
  } catch (err) {
    console.error('❌ Kontrol kaydı oluşturma hatası:', err);
    console.error('❌ Hata detayları:', {
      message: err.message,
      code: err.code,
      number: err.number,
      state: err.state,
      class: err.class,
      serverName: err.serverName,
      procName: err.procName,
      lineNumber: err.lineNumber,
      stack: err.stack
    });
    
    // SQL Server hatası ise daha açıklayıcı mesaj
    if (err.number) {
      // Invalid object name (tablo yok)
      if (err.number === 208) {
        return error(res, 'SutEslestirmeKontrolleri tablosu bulunamadı. Lütfen migration scriptini çalıştırın.', 500);
      }
      // Invalid column name
      if (err.number === 207) {
        return error(res, `Geçersiz kolon adı: ${err.message}`, 500);
      }
    }
    
    next(err);
  }
};

// ============================================
// PUT /api/external/eslestirme/kontrol/:id
// Kontrol durumunu güncelle (onayla/reddet)
// ============================================
const updateKontrol = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { durum, doktorNotu } = req.body; // durum: 'onaylandi' veya 'reddedildi'
    const kullaniciId = req.user.kullaniciId;

    if (!durum || !['onaylandi', 'reddedildi'].includes(durum)) {
      return error(res, 'Geçersiz durum. Durum "onaylandi" veya "reddedildi" olmalı', 400);
    }

    const pool = await getPool();
    
    // Önce güncelleme yap
    const updateResult = await pool.request()
      .input('KontrolID', sql.Int, id)
      .input('Durum', sql.NVarChar, durum)
      .input('DoktorNotu', sql.NVarChar, doktorNotu || null)
      .input('OnaylayanKullaniciID', sql.Int, kullaniciId)
      .query(`
        UPDATE SutEslestirmeKontrolleri
        SET 
          Durum = @Durum,
          DoktorNotu = @DoktorNotu,
          OnaylayanKullaniciID = @OnaylayanKullaniciID,
          OnayTarihi = GETDATE(),
          GuncellemeTarihi = GETDATE()
        WHERE KontrolID = @KontrolID
          AND AktifMi = 1
      `);

    // Hiçbir satır güncellenmediyse kayıt bulunamadı
    if (updateResult.rowsAffected[0] === 0) {
      return error(res, 'Kontrol kaydı bulunamadı veya zaten güncellenmiş', 404);
    }

    // Güncellenmiş kaydı çek
    const result = await pool.request()
      .input('KontrolID', sql.Int, id)
      .query(`
        SELECT 
          KontrolID,
          Durum,
          DoktorNotu,
          OnayTarihi
        FROM SutEslestirmeKontrolleri
        WHERE KontrolID = @KontrolID
          AND AktifMi = 1
      `);

    if (result.recordset.length === 0) {
      return error(res, 'Güncellenmiş kayıt bulunamadı', 404);
    }

    return success(res, {
      kontrolId: result.recordset[0].KontrolID,
      durum: result.recordset[0].Durum,
      doktorNotu: result.recordset[0].DoktorNotu,
      onayTarihi: result.recordset[0].OnayTarihi
    }, `Kontrol ${durum === 'onaylandi' ? 'onaylandı' : 'reddedildi'}`);
  } catch (err) {
    console.error('❌ Kontrol güncelleme hatası:', err);
    next(err);
  }
};

// ============================================
// GET /api/external/eslestirme/kontroller
// Kontrol listesi (filtreleme ile)
// ============================================
const getKontroller = async (req, res, next) => {
  try {
    const { durum, lowConfidence, sutKodu, limit = 100, offset = 0 } = req.query;
    const pool = await getPool();

    let query = `
      SELECT 
        k.KontrolID,
        k.SutID,
        k.SutKodu,
        s.IslemAdi as SutIslemAdi,
        k.HuvUstTeminatKod,
        k.HuvAltTeminatKod,
        k.EslestirmeSkoru,
        k.EslestirmeTipi,
        k.LowConfidence,
        k.Durum,
        k.DoktorNotu,
        k.OnaylayanKullaniciID,
        u1.KullaniciAdi as OnaylayanKullaniciAdi,
        k.OnayTarihi,
        k.OlusturanKullaniciID,
        u2.KullaniciAdi as OlusturanKullaniciAdi,
        k.OlusturmaTarihi,
        k.GuncellemeTarihi
      FROM SutEslestirmeKontrolleri k
      INNER JOIN SutIslemler s ON s.SutID = k.SutID
      LEFT JOIN Kullanicilar u1 ON u1.KullaniciID = k.OnaylayanKullaniciID
      LEFT JOIN Kullanicilar u2 ON u2.KullaniciID = k.OlusturanKullaniciID
      WHERE k.AktifMi = 1
    `;

    const request = pool.request();
    
    if (durum) {
      query += ` AND k.Durum = @Durum`;
      request.input('Durum', sql.NVarChar, durum);
    }
    
    if (lowConfidence !== undefined) {
      query += ` AND k.LowConfidence = @LowConfidence`;
      request.input('LowConfidence', sql.Bit, lowConfidence === 'true' || lowConfidence === true);
    }
    
    if (sutKodu) {
      query += ` AND k.SutKodu LIKE @SutKodu`;
      request.input('SutKodu', sql.NVarChar, `%${sutKodu}%`);
    }

    query += ` ORDER BY k.OlusturmaTarihi DESC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`;
    request.input('Offset', sql.Int, parseInt(offset));
    request.input('Limit', sql.Int, parseInt(limit));

    // Toplam sayı için ayrı sorgu
    let countQuery = `
      SELECT COUNT(*) as Toplam
      FROM SutEslestirmeKontrolleri k
      WHERE k.AktifMi = 1
    `;
    const countRequest = pool.request();
    
    if (durum) {
      countQuery += ` AND k.Durum = @Durum`;
      countRequest.input('Durum', sql.NVarChar, durum);
    }
    
    if (lowConfidence !== undefined) {
      countQuery += ` AND k.LowConfidence = @LowConfidence`;
      countRequest.input('LowConfidence', sql.Bit, lowConfidence === 'true' || lowConfidence === true);
    }
    
    if (sutKodu) {
      countQuery += ` AND k.SutKodu LIKE @SutKodu`;
      countRequest.input('SutKodu', sql.NVarChar, `%${sutKodu}%`);
    }

    const [result, countResult] = await Promise.all([
      request.query(query),
      countRequest.query(countQuery)
    ]);

    return success(res, {
      kontroller: result.recordset,
      toplam: countResult.recordset[0].Toplam,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }, 'Kontrol listesi');
  } catch (err) {
    console.error('❌ Kontrol listesi hatası:', err);
    next(err);
  }
};

// ============================================
// POST /api/external/eslestirme/manuel-duzenleme
// Manuel eşleştirme düzenleme
// ============================================
const createManuelDuzenleme = async (req, res, next) => {
  try {
    const { sutId, sutKodu, eskiHuvUstTeminatKod, eskiHuvAltTeminatKod, yeniHuvUstTeminatKod, yeniHuvAltTeminatKod, manuelSkor, duzenlemeNotu } = req.body;
    const kullaniciId = req.user.kullaniciId;

    if (!sutId || !sutKodu || !yeniHuvUstTeminatKod || !yeniHuvAltTeminatKod) {
      return error(res, 'Eksik parametreler', 400);
    }

    // Detaylı validasyon
    if (!sutId) {
      return error(res, 'SutID eksik', 400);
    }
    if (!sutKodu || typeof sutKodu !== 'string' || sutKodu.trim() === '') {
      return error(res, 'SutKodu eksik veya geçersiz', 400);
    }
    if (!yeniHuvUstTeminatKod || typeof yeniHuvUstTeminatKod !== 'string' || yeniHuvUstTeminatKod.trim() === '') {
      return error(res, 'YeniHuvUstTeminatKod eksik veya geçersiz', 400);
    }
    if (!yeniHuvAltTeminatKod || typeof yeniHuvAltTeminatKod !== 'string' || yeniHuvAltTeminatKod.trim() === '') {
      return error(res, 'YeniHuvAltTeminatKod eksik veya geçersiz', 400);
    }
    
    // String'leri temizle ve normalize et
    const cleanSutKodu = String(sutKodu).trim();
    const cleanYeniHuvUstTeminatKod = String(yeniHuvUstTeminatKod).trim();
    const cleanYeniHuvAltTeminatKod = String(yeniHuvAltTeminatKod).trim();
    
    // Eski değerler opsiyonel (null olabilir)
    const cleanEskiHuvUstTeminatKod = eskiHuvUstTeminatKod 
      ? String(eskiHuvUstTeminatKod).trim() 
      : null;
    const cleanEskiHuvAltTeminatKod = eskiHuvAltTeminatKod 
      ? String(eskiHuvAltTeminatKod).trim() 
      : null;
    
    const cleanDuzenlemeNotu = duzenlemeNotu 
      ? String(duzenlemeNotu).trim() 
      : null;

    const pool = await getPool();

    // Aynı SUT için birden fazla manuel kayıt olmasın: eskileri pasifleştir, yenisini aktif ekle
    const transaction = pool.transaction();
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      await transaction.request()
        .input('SutID', sql.Int, sutId)
        .query(`
          UPDATE SutEslestirmeManuelDuzenlemeler
          SET AktifMi = 0
          WHERE SutID = @SutID AND AktifMi = 1
        `);

      const result = await transaction.request()
        .input('SutID', sql.Int, sutId)
        .input('SutKodu', sql.NVarChar, cleanSutKodu)
        .input('EskiHuvUstTeminatKod', sql.NVarChar, cleanEskiHuvUstTeminatKod || null)
        .input('EskiHuvAltTeminatKod', sql.NVarChar, cleanEskiHuvAltTeminatKod || null)
        .input('YeniHuvUstTeminatKod', sql.NVarChar, cleanYeniHuvUstTeminatKod)
        .input('YeniHuvAltTeminatKod', sql.NVarChar, cleanYeniHuvAltTeminatKod)
        .input('ManuelSkor', sql.Decimal(5, 3), manuelSkor ?? null)
        .input('DuzenlemeNotu', sql.NVarChar, cleanDuzenlemeNotu || null)
        .input('DuzenleyenKullaniciID', sql.Int, kullaniciId)
        .query(`
          INSERT INTO SutEslestirmeManuelDuzenlemeler 
            (SutID, SutKodu, EskiHuvUstTeminatKod, EskiHuvAltTeminatKod, YeniHuvUstTeminatKod, YeniHuvAltTeminatKod, ManuelSkor, DuzenlemeNotu, DuzenleyenKullaniciID, AktifMi)
          OUTPUT INSERTED.DuzenlemeID, INSERTED.DuzenlemeTarihi
          VALUES 
            (@SutID, @SutKodu, @EskiHuvUstTeminatKod, @EskiHuvAltTeminatKod, @YeniHuvUstTeminatKod, @YeniHuvAltTeminatKod, @ManuelSkor, @DuzenlemeNotu, @DuzenleyenKullaniciID, 1)
        `);

      await transaction.commit();

      // Cache'i temizle (birleşik liste değişti)
      cache.delete('birlesik_liste');

      return success(res, {
        duzenlemeId: result.recordset[0].DuzenlemeID,
        duzenlemeTarihi: result.recordset[0].DuzenlemeTarihi
      }, 'Manuel düzenleme kaydedildi');
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

  } catch (err) {
    console.error('❌ Manuel düzenleme hatası:', err);
    next(err);
  }
};

module.exports = {
  createKontrol,
  updateKontrol,
  getKontroller,
  createManuelDuzenleme
};

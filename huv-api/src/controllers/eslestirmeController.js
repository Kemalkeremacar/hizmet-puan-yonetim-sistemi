// ============================================
// EŞLEŞTIRME CONTROLLER
// ============================================
// HUV-SUT kod eşleştirme operasyonları
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');

// ============================================
// GET /api/eslestirme/istatistik
// Eşleştirme istatistikleri
// ============================================
const getIstatistik = async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().execute('sp_EslestirmeIstatistik');

    return success(res, {
      genel: result.recordsets[0],
      eslestirilmemisHuv: result.recordsets[1][0],
      eslestirilmemisSut: result.recordsets[2][0]
    }, 'Eşleştirme istatistikleri');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/eslestirme/huv/:islemId
// Bir HUV kodunun tüm SUT eşleştirmeleri
// ============================================
const getHuvEslestirmeleri = async (req, res, next) => {
  try {
    const { islemId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('islemId', sql.Int, islemId)
      .query(`
        SELECT * FROM vw_HuvSutEslestirmeOzet
        WHERE IslemID = @islemId AND AktifMi = 1
        ORDER BY GuvenilirlikSkoru DESC
      `);

    return success(res, result.recordset, 'HUV eşleştirmeleri');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/eslestirme/sut/:sutId
// Bir SUT kodunun tüm HUV eşleştirmeleri
// ============================================
const getSutEslestirmeleri = async (req, res, next) => {
  try {
    const { sutId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('sutId', sql.Int, sutId)
      .query(`
        SELECT * FROM vw_HuvSutEslestirmeOzet
        WHERE SutID = @sutId AND AktifMi = 1
        ORDER BY GuvenilirlikSkoru DESC
      `);

    return success(res, result.recordset, 'SUT eşleştirmeleri');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/eslestirme/liste
// Tüm eşleştirmeler (sayfalı)
// ============================================
const getEslestirmeler = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      eslestirmeTipi,
      minGuvenilirlik,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const pool = await getPool();

    // Toplam sayı
    const countResult = await pool.request()
      .input('eslestirmeTipi', sql.NVarChar, eslestirmeTipi)
      .input('minGuvenilirlik', sql.Decimal(5, 2), minGuvenilirlik)
      .input('search', sql.NVarChar, search ? `%${search}%` : null)
      .query(`
        SELECT COUNT(*) as total
        FROM vw_HuvSutEslestirmeOzet
        WHERE AktifMi = 1
          AND (@eslestirmeTipi IS NULL OR EslestirmeTipi = @eslestirmeTipi)
          AND (@minGuvenilirlik IS NULL OR GuvenilirlikSkoru >= @minGuvenilirlik)
          AND (@search IS NULL OR 
               HuvIslemAdi LIKE @search OR 
               SutIslemAdi LIKE @search OR
               CAST(HuvKodu AS NVARCHAR) LIKE @search OR
               SutKodu LIKE @search)
      `);

    const total = countResult.recordset[0].total;

    // Sayfalı veri
    const result = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .input('eslestirmeTipi', sql.NVarChar, eslestirmeTipi)
      .input('minGuvenilirlik', sql.Decimal(5, 2), minGuvenilirlik)
      .input('search', sql.NVarChar, search ? `%${search}%` : null)
      .query(`
        SELECT *
        FROM vw_HuvSutEslestirmeOzet
        WHERE AktifMi = 1
          AND (@eslestirmeTipi IS NULL OR EslestirmeTipi = @eslestirmeTipi)
          AND (@minGuvenilirlik IS NULL OR GuvenilirlikSkoru >= @minGuvenilirlik)
          AND (@search IS NULL OR 
               HuvIslemAdi LIKE @search OR 
               SutIslemAdi LIKE @search OR
               CAST(HuvKodu AS NVARCHAR) LIKE @search OR
               SutKodu LIKE @search)
        ORDER BY GuvenilirlikSkoru DESC, HuvKodu
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return success(res, {
      data: result.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Eşleştirmeler listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// POST /api/eslestirme
// Yeni eşleştirme oluştur
// ============================================
const createEslestirme = async (req, res, next) => {
  try {
    const {
      islemId,
      sutId,
      eslestirmeTipi = 'MANUEL',
      guvenilirlikSkoru = 50,
      aciklama
    } = req.body;

    if (!islemId || !sutId) {
      return error(res, 'IslemID ve SutID gerekli', 400);
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('islemId', sql.Int, islemId)
      .input('sutId', sql.Int, sutId)
      .input('eslestirmeTipi', sql.NVarChar, eslestirmeTipi)
      .input('guvenilirlikSkoru', sql.Decimal(5, 2), guvenilirlikSkoru)
      .input('aciklama', sql.NVarChar, aciklama)
      .query(`
        INSERT INTO HuvSutEslestirme (
          IslemID, SutID, EslestirmeTipi, GuvenilirlikSkoru, Aciklama
        )
        VALUES (
          @islemId, @sutId, @eslestirmeTipi, @guvenilirlikSkoru, @aciklama
        );
        
        SELECT SCOPE_IDENTITY() as EslestirmeID;
      `);

    const eslestirmeId = result.recordset[0].EslestirmeID;

    // Yeni oluşturulan eşleştirmeyi getir
    const newRecord = await pool.request()
      .input('eslestirmeId', sql.Int, eslestirmeId)
      .query(`
        SELECT * FROM vw_HuvSutEslestirmeOzet
        WHERE EslestirmeID = @eslestirmeId
      `);

    return success(res, newRecord.recordset[0], 'Eşleştirme oluşturuldu', 201);
  } catch (err) {
    if (err.number === 2627) { // Unique constraint violation
      return error(res, 'Bu eşleştirme zaten mevcut', 409);
    }
    next(err);
  }
};

// ============================================
// PUT /api/eslestirme/:id
// Eşleştirme güncelle
// ============================================
const updateEslestirme = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      eslestirmeTipi,
      guvenilirlikSkoru,
      aciklama,
      aktifMi
    } = req.body;

    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, id)
      .input('eslestirmeTipi', sql.NVarChar, eslestirmeTipi)
      .input('guvenilirlikSkoru', sql.Decimal(5, 2), guvenilirlikSkoru)
      .input('aciklama', sql.NVarChar, aciklama)
      .input('aktifMi', sql.Bit, aktifMi)
      .query(`
        UPDATE HuvSutEslestirme
        SET 
          EslestirmeTipi = ISNULL(@eslestirmeTipi, EslestirmeTipi),
          GuvenilirlikSkoru = ISNULL(@guvenilirlikSkoru, GuvenilirlikSkoru),
          Aciklama = ISNULL(@aciklama, Aciklama),
          AktifMi = ISNULL(@aktifMi, AktifMi)
        WHERE EslestirmeID = @id
      `);

    // Güncellenmiş kaydı getir
    const updated = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT * FROM vw_HuvSutEslestirmeOzet
        WHERE EslestirmeID = @id
      `);

    return success(res, updated.recordset[0], 'Eşleştirme güncellendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// POST /api/eslestirme/:id/onayla
// Eşleştirmeyi onayla
// ============================================
const onaylaEslestirme = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kullanici = 'admin' } = req.body;

    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, id)
      .input('kullanici', sql.NVarChar, kullanici)
      .query(`
        UPDATE HuvSutEslestirme
        SET 
          EslestirmeTipi = 'ONAYLANMIS',
          GuvenilirlikSkoru = 100,
          OnaylayanKullanici = @kullanici,
          OnaylamaTarihi = GETDATE()
        WHERE EslestirmeID = @id
      `);

    return success(res, null, 'Eşleştirme onaylandı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// DELETE /api/eslestirme/:id
// Eşleştirme sil (soft delete)
// ============================================
const deleteEslestirme = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE HuvSutEslestirme
        SET AktifMi = 0
        WHERE EslestirmeID = @id
      `);

    return success(res, null, 'Eşleştirme silindi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/eslestirme/eslestirilmemis/huv
// Eşleştirilmemiş HUV kodları
// ============================================
const getEslestirilmemisHuv = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;
    const pool = await getPool();

    const result = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .input('search', sql.NVarChar, search ? `%${search}%` : null)
      .query(`
        SELECT 
          i.IslemID,
          i.HuvKodu,
          i.IslemAdi,
          i.Birim,
          a.BolumAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE i.AktifMi = 1
          AND i.Birim IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM HuvSutEslestirme e 
              WHERE e.IslemID = i.IslemID AND e.AktifMi = 1
          )
          AND (@search IS NULL OR 
               i.IslemAdi LIKE @search OR 
               CAST(i.HuvKodu AS NVARCHAR) LIKE @search)
        ORDER BY i.HuvKodu
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return success(res, result.recordset, 'Eşleştirilmemiş HUV kodları');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/eslestirme/eslestirilmemis/sut
// Eşleştirilmemiş SUT kodları
// ============================================
const getEslestirilmemisSut = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;
    const pool = await getPool();

    const result = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .input('search', sql.NVarChar, search ? `%${search}%` : null)
      .query(`
        SELECT 
          s.SutID,
          s.SutKodu,
          s.IslemAdi,
          s.Puan,
          s.Kategori
        FROM SutIslemler s
        WHERE s.AktifMi = 1
          AND NOT EXISTS (
              SELECT 1 FROM HuvSutEslestirme e 
              WHERE e.SutID = s.SutID AND e.AktifMi = 1
          )
          AND (@search IS NULL OR 
               s.IslemAdi LIKE @search OR 
               s.SutKodu LIKE @search)
        ORDER BY s.SutKodu
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return success(res, result.recordset, 'Eşleştirilmemiş SUT kodları');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getIstatistik,
  getHuvEslestirmeleri,
  getSutEslestirmeleri,
  getEslestirmeler,
  createEslestirme,
  updateEslestirme,
  onaylaEslestirme,
  deleteEslestirme,
  getEslestirilmemisHuv,
  getEslestirilmemisSut
};

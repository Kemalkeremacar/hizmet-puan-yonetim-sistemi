// ============================================
// ALT TEMİNATLAR CONTROLLER
// ============================================
// HuvAltTeminatlar tablosundan verileri çeker
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');

// ============================================
// GET /api/alt-teminatlar
// Tüm alt teminatları listele (anadalkodu'na göre sıralı)
// ============================================
const getAltTeminatlar = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        t.AltTeminatID,
        t.AltTeminatAdi,
        t.UstTeminatAdi,
        t.AnaDalKodu,
        a.BolumAdi as AnaDalAdi,
        t.AktifMi,
        t.OlusturmaTarihi,
        t.GuncellemeTarihi,
        t.Sira,
        ISNULL(ai.IslemSayisi, 0) as IslemSayisi
      FROM HuvAltTeminatlar t
      LEFT JOIN AnaDallar a ON t.AnaDalKodu = a.AnaDalKodu
      LEFT JOIN (
        SELECT AltTeminatID, COUNT(*) as IslemSayisi
        FROM AltTeminatIslemler
        GROUP BY AltTeminatID
      ) ai ON t.AltTeminatID = ai.AltTeminatID
      WHERE t.AktifMi = 1
      ORDER BY t.AnaDalKodu, t.Sira, t.AltTeminatID
    `);

    return success(res, result.recordset, 'Alt teminatlar listelendi');
  } catch (err) {
    console.error('❌ Alt teminatlar hatası:', err);
    next(err);
  }
};

// ============================================
// GET /api/alt-teminatlar/sut-islemler
// SUT işlemlerini ara
// ============================================
const searchSutIslemler = async (req, res, next) => {
  try {
    const { search, limit = 20 } = req.query;
    const pool = await getPool();

    if (!search || search.length < 2) {
      return success(res, [], 'Arama terimi çok kısa');
    }

    const result = await pool.request()
      .input('search', sql.NVarChar, `%${search}%`)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          s.SutID,
          s.SutKodu,
          s.IslemAdi,
          s.Puan,
          ab.AnaBaslikAdi
        FROM SutIslemler s
        LEFT JOIN SutAnaBasliklar ab ON s.AnaBaslikNo = ab.AnaBaslikNo
        WHERE s.AktifMi = 1
          AND (
            s.SutKodu LIKE @search
            OR s.IslemAdi LIKE @search
          )
        ORDER BY s.SutKodu
      `);

    return success(res, result.recordset, 'SUT işlemleri listelendi');
  } catch (err) {
    console.error('❌ SUT işlem arama hatası:', err);
    next(err);
  }
};

// ============================================
// GET /api/alt-teminatlar/:id/islemler
// Bir alt teminata atanmış işlemleri getir
// ============================================
const getAltTeminatIslemler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('AltTeminatID', sql.Int, id)
      .query(`
        SELECT 
          ai.ID,
          ai.AltTeminatID,
          ai.SutID,
          s.SutKodu,
          s.IslemAdi,
          s.Puan,
          ai.EklemeTarihi
        FROM AltTeminatIslemler ai
        INNER JOIN SutIslemler s ON ai.SutID = s.SutID
        WHERE ai.AltTeminatID = @AltTeminatID
        ORDER BY ai.EklemeTarihi DESC
      `);

    return success(res, result.recordset, 'Alt teminat işlemleri listelendi');
  } catch (err) {
    console.error('❌ Alt teminat işlemleri hatası:', err);
    next(err);
  }
};

// ============================================
// POST /api/alt-teminatlar/:id/islemler
// Bir alt teminata işlem ata
// ============================================
const addAltTeminatIslem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sutID, altTeminatIDs } = req.body; // altTeminatIDs: toplu atama için array

    if (!sutID) {
      return error(res, 'SUT ID gereklidir', 400);
    }

    const pool = await getPool();

    // Toplu atama mı yoksa tekli mi?
    const teminatIDList = altTeminatIDs && Array.isArray(altTeminatIDs) && altTeminatIDs.length > 0
      ? altTeminatIDs
      : [id];

    const results = [];
    const errors = [];

    for (const teminatID of teminatIDList) {
      try {
        // Önce bu işlem zaten atanmış mı kontrol et
        const checkResult = await pool.request()
          .input('AltTeminatID', sql.Int, teminatID)
          .input('SutID', sql.Int, sutID)
          .query(`
            SELECT ID FROM AltTeminatIslemler 
            WHERE AltTeminatID = @AltTeminatID AND SutID = @SutID
          `);

        if (checkResult.recordset.length > 0) {
          errors.push({ teminatID, message: 'Bu işlem zaten bu alt teminata atanmış' });
          continue;
        }

        // İşlemi ata
        const result = await pool.request()
          .input('AltTeminatID', sql.Int, teminatID)
          .input('SutID', sql.Int, sutID)
          .query(`
            INSERT INTO AltTeminatIslemler (AltTeminatID, SutID, EklemeTarihi)
            VALUES (@AltTeminatID, @SutID, GETDATE())
            
            SELECT 
              ai.ID,
              ai.AltTeminatID,
              ai.SutID,
              s.SutKodu,
              s.IslemAdi,
              s.Puan,
              ai.EklemeTarihi
            FROM AltTeminatIslemler ai
            INNER JOIN SutIslemler s ON ai.SutID = s.SutID
            WHERE ai.ID = SCOPE_IDENTITY()
          `);

        results.push(result.recordset[0]);
      } catch (err) {
        errors.push({ teminatID, message: err.message });
      }
    }

    if (results.length === 0) {
      return error(res, 'Hiçbir işlem atanamadı', 400, { errors });
    }

    return success(res, { 
      added: results, 
      errors: errors.length > 0 ? errors : undefined 
    }, `${results.length} işlem başarıyla atandı`);
  } catch (err) {
    console.error('❌ İşlem atama hatası:', err);
    next(err);
  }
};

// ============================================
// DELETE /api/alt-teminatlar/:id/islemler/:sutId
// Bir alt teminattan işlem kaldır
// ============================================
const removeAltTeminatIslem = async (req, res, next) => {
  try {
    const { id, sutId } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('AltTeminatID', sql.Int, id)
      .input('SutID', sql.Int, sutId)
      .query(`
        DELETE FROM AltTeminatIslemler 
        WHERE AltTeminatID = @AltTeminatID AND SutID = @SutID
      `);

    return success(res, null, 'İşlem başarıyla kaldırıldı');
  } catch (err) {
    console.error('❌ İşlem kaldırma hatası:', err);
    next(err);
  }
};

module.exports = {
  getAltTeminatlar,
  searchSutIslemler,
  getAltTeminatIslemler,
  addAltTeminatIslem,
  removeAltTeminatIslem
};

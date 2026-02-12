// ============================================
// ANA DALLAR CONTROLLER
// ============================================
// Tüm ana dal (uzmanlık bölümü) işlemlerini yönetir
// Endpoint'ler: GET /api/anadal, GET /api/anadal/:kod, GET /api/anadal/:kod/islemler
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error, paginated } = require('../utils/response');

// ============================================
// GET /api/anadal
// Tüm ana dalları listele
// ============================================
const getAnaDallar = async (req, res, next) => {
  try {
    const pool = await getPool();

    // View yerine direkt sorgu kullan
    const result = await pool.request().query(`
      SELECT 
        a.AnaDalKodu,
        a.BolumAdi,
        COUNT(i.IslemID) as ToplamKayit,
        COUNT(CASE WHEN i.Birim IS NOT NULL AND i.Birim > 0 THEN 1 END) as FiyatliIslemSayisi,
        COUNT(CASE WHEN i.[Not] IS NOT NULL AND LEN(i.[Not]) > 0 THEN 1 END) as AciklamaSayisi,
        COUNT(DISTINCT i.UstBaslik) as KategoriSayisi,
        AVG(CASE WHEN i.Birim > 0 THEN i.Birim ELSE NULL END) as OrtalamaBirim
      FROM AnaDallar a
      LEFT JOIN HuvIslemler i ON a.AnaDalKodu = i.AnaDalKodu AND i.AktifMi = 1
      GROUP BY a.AnaDalKodu, a.BolumAdi
      ORDER BY a.AnaDalKodu
    `);

    return success(res, result.recordset, 'Ana dallar listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/anadal/:kod
// Ana dal detayı + istatistikler
// ============================================
const getAnaDalByKod = async (req, res, next) => {
  try {
    const { kod } = req.params;
    const pool = await getPool();

    // SP yerine direkt sorgu kullan
    const result = await pool.request()
      .input('AnaDalKodu', sql.Int, parseInt(kod))
      .query(`
        SELECT 
          a.AnaDalKodu,
          a.BolumAdi,
          COUNT(i.IslemID) as ToplamIslem,
          COUNT(CASE WHEN i.Birim IS NOT NULL AND i.Birim > 0 THEN 1 END) as FiyatliIslemSayisi,
          MIN(CASE WHEN i.Birim > 0 THEN i.Birim ELSE NULL END) as MinBirim,
          MAX(i.Birim) as MaxBirim,
          AVG(CASE WHEN i.Birim > 0 THEN i.Birim ELSE NULL END) as OrtalamaBirim,
          COUNT(DISTINCT i.UstBaslik) as KategoriSayisi,
          COUNT(CASE WHEN i.[Not] IS NOT NULL AND LEN(i.[Not]) > 0 THEN 1 END) as AciklamaSayisi
        FROM AnaDallar a
        LEFT JOIN HuvIslemler i ON a.AnaDalKodu = i.AnaDalKodu AND i.AktifMi = 1
        WHERE a.AnaDalKodu = @AnaDalKodu
        GROUP BY a.AnaDalKodu, a.BolumAdi
      `);

    if (result.recordset.length === 0) {
      return error(res, 'Ana dal bulunamadı', 404);
    }

    return success(res, result.recordset[0], 'Ana dal detayı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/anadal/:kod/islemler
// Ana dala ait işlemler (sayfalı)
// Query Params: page, limit
// ============================================
const getAnaDalIslemler = async (req, res, next) => {
  try {
    const { kod } = req.params;
    const {
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;
    const pool = await getPool();

    // Toplam kayıt sayısı
    let countQuery = 'SELECT COUNT(*) as total FROM HuvIslemler WHERE AnaDalKodu = @kod';

    const countRequest = pool.request()
      .input('kod', sql.Int, parseInt(kod));

    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    // Veri çekme
    let dataQuery = `
      SELECT 
        i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim, i.SutKodu,
        i.UstBaslik, i.HiyerarsiSeviyesi, i.[Not],
        i.GuncellemeTarihi, i.EklemeTarihi
      FROM HuvIslemler i
      WHERE i.AnaDalKodu = @kod
    `;

    dataQuery += ' ORDER BY i.HuvKodu';
    dataQuery += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';

    const dataRequest = pool.request()
      .input('kod', sql.Int, parseInt(kod))
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit));

    const dataResult = await dataRequest.query(dataQuery);

    return paginated(res, dataResult.recordset, page, limit, total, 'Ana dal işlemleri listelendi');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAnaDallar,
  getAnaDalByKod,
  getAnaDalIslemler
};

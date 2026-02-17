// ============================================
// ISLEMLER CONTROLLER
// ============================================
// HUV işlemlerinin READ-ONLY operasyonları
// Endpoint'ler: GET /api/islemler
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error, paginated } = require('../utils/response');

// ============================================
// GET /api/islemler
// Tüm işlemleri listele (sayfalı, filtrelenebilir)
// View: vw_IslemlerDetay
// Query Params: page, limit, anaDalKodu, sort, order
// ============================================
const getIslemler = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      anaDalKodu,
      sort = 'IslemID',
      order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const pool = await getPool();

    // Toplam kayıt sayısı
    let countQuery = 'SELECT COUNT(*) as total FROM HuvIslemler i WHERE i.AktifMi = 1';
    const countParams = [];

    // anaDalKodu 0 olabilir, bu yüzden !== undefined kontrolü yapıyoruz
    if (anaDalKodu !== undefined && anaDalKodu !== null && anaDalKodu !== '') {
      countQuery += ' AND i.AnaDalKodu = @anaDalKodu';
      countParams.push({ name: 'anaDalKodu', type: sql.Int, value: parseInt(anaDalKodu) });
    }

    const countRequest = pool.request();
    countParams.forEach(p => countRequest.input(p.name, p.type, p.value));
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    // Veri çekme
    const validSortColumns = ['IslemID', 'HuvKodu', 'IslemAdi', 'Birim', 'BolumAdi'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'IslemID';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let dataQuery = `
      SELECT 
        i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim, i.SutKodu,
        i.UstBaslik, i.HiyerarsiSeviyesi, i.[Not],
        i.GuncellemeTarihi, i.EklemeTarihi,
        i.GuncellemeTarihiDate, i.EklemeTarihiDate,
        i.AnaDalKodu, a.BolumAdi
      FROM HuvIslemler i
      LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
      WHERE i.AktifMi = 1
    `;

    // anaDalKodu 0 olabilir, bu yüzden !== undefined kontrolü yapıyoruz
    if (anaDalKodu !== undefined && anaDalKodu !== null && anaDalKodu !== '') {
      dataQuery += ' AND i.AnaDalKodu = @anaDalKodu';
    }
    
    dataQuery += ` ORDER BY ${sortColumn} ${sortOrder}`;
    dataQuery += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const dataRequest = pool.request();
    countParams.forEach(p => dataRequest.input(p.name, p.type, p.value));
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, parseInt(limit));

    const dataResult = await dataRequest.query(dataQuery);

    return paginated(res, dataResult.recordset, page, limit, total, 'İşlemler listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/ara
// Gelişmiş arama (metin, fiyat aralığı, ana dal)
// SP: sp_IslemAra
// Query Params: q, minBirim, maxBirim, anaDalKodu, page, limit
// ============================================
const araIslem = async (req, res, next) => {
  try {
    const {
      q,
      minBirim,
      maxBirim,
      anaDalKodu,
      page = 1,
      limit = 50
    } = req.query;

    const pool = await getPool();
    const offset = (page - 1) * limit;

    // sp_IslemAra kullan
    const result = await pool.request()
      .input('AramaMetni', sql.NVarChar, q || null)
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .input('MinBirim', sql.Float, minBirim ? parseFloat(minBirim) : null)
      .input('MaxBirim', sql.Float, maxBirim ? parseFloat(maxBirim) : null)
      .execute('sp_IslemAra');

    const data = result.recordset;
    const total = data.length;

    // Manuel sayfalama (SP sayfalama yapmıyor)
    const paginatedData = data.slice(offset, offset + parseInt(limit));

    return paginated(res, paginatedData, page, limit, total, 'Arama tamamlandı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/fiyat-aralik
// Fiyat aralığına göre işlemler
// SP: sp_IslemlerFiyatAralik
// Query: minFiyat, maxFiyat, anaDalKodu, page, limit
// ============================================
const getFiyatAralik = async (req, res, next) => {
  try {
    const { minFiyat, maxFiyat, anaDalKodu, page = 1, limit = 50 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('MinFiyat', sql.Float, minFiyat ? parseFloat(minFiyat) : null)
      .input('MaxFiyat', sql.Float, maxFiyat ? parseFloat(maxFiyat) : null)
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .input('Sayfa', sql.Int, parseInt(page))
      .input('SayfaBoyutu', sql.Int, parseInt(limit))
      .execute('sp_IslemlerFiyatAralik');

    const total = result.recordsets[0][0].ToplamKayit;
    const data = result.recordsets[1];

    return paginated(res, data, page, limit, total, 'Fiyat aralığına göre işlemler');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/hiyerarsi
// Hiyerarşi seviyesine göre işlemler
// SP: sp_IslemlerHiyerarsi
// Query: seviye, anaDalKodu, page, limit
// ============================================
const getHiyerarsi = async (req, res, next) => {
  try {
    const { seviye, anaDalKodu, page = 1, limit = 50 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('HiyerarsiSeviyesi', sql.Int, seviye ? parseInt(seviye) : null)
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .input('Sayfa', sql.Int, parseInt(page))
      .input('SayfaBoyutu', sql.Int, parseInt(limit))
      .execute('sp_IslemlerHiyerarsi');

    const total = result.recordsets[0][0].ToplamKayit;
    const data = result.recordsets[1];

    return paginated(res, data, page, limit, total, 'Hiyerarşi seviyesine göre işlemler');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/son-guncellemeler
// Tarihe göre güncellenenler
// SP: sp_IslemlerTariheGore
// Query: gunSayisi, anaDalKodu, page, limit
// ============================================
const getSonGuncellemeler = async (req, res, next) => {
  try {
    const { gunSayisi = 30, anaDalKodu, page = 1, limit = 50 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('GunSayisi', sql.Int, parseInt(gunSayisi))
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .input('Sayfa', sql.Int, parseInt(page))
      .input('SayfaBoyutu', sql.Int, parseInt(limit))
      .execute('sp_IslemlerTariheGore');

    const total = result.recordsets[0][0].ToplamKayit;
    const data = result.recordsets[1];

    return paginated(res, data, page, limit, total, `Son ${gunSayisi} günde güncellenenler`);
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/sut-kodu
// Süt koduna göre işlemler
// SP: sp_IslemlerSutKodu
// Query: sutKodu, page, limit
// ============================================
const getSutKodu = async (req, res, next) => {
  try {
    const { sutKodu, page = 1, limit = 50 } = req.query;

    if (!sutKodu) {
      return error(res, 'Süt kodu gereklidir', 400);
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('SutKodu', sql.NVarChar, sutKodu)
      .input('Sayfa', sql.Int, parseInt(page))
      .input('SayfaBoyutu', sql.Int, parseInt(limit))
      .execute('sp_IslemlerSutKodu');

    const total = result.recordsets[0][0].ToplamKayit;
    const data = result.recordsets[1];

    return paginated(res, data, page, limit, total, 'Süt koduna göre işlemler');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/en-pahali
// En pahalı işlemler
// SP: sp_EnPahaliIslemler
// Query: topN, anaDalKodu
// ============================================
const getEnPahali = async (req, res, next) => {
  try {
    const { topN = 50, anaDalKodu } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('TopN', sql.Int, parseInt(topN))
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .execute('sp_EnPahaliIslemler');

    return success(res, result.recordset, `En pahalı ${topN} işlem`);
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/en-ucuz
// En ucuz işlemler
// SP: sp_EnUcuzIslemler
// Query: topN, anaDalKodu
// ============================================
const getEnUcuz = async (req, res, next) => {
  try {
    const { topN = 50, anaDalKodu } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('TopN', sql.Int, parseInt(topN))
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .execute('sp_EnUcuzIslemler');

    return success(res, result.recordset, `En ucuz ${topN} işlem`);
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/kategori
// Kategoriye göre işlemler
// SP: sp_IslemlerKategoriye
// Query: ustBaslik, page, limit
// ============================================
const getKategori = async (req, res, next) => {
  try {
    const { ustBaslik, page = 1, limit = 50 } = req.query;

    if (!ustBaslik) {
      return error(res, 'Üst başlık gereklidir', 400);
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('UstBaslik', sql.NVarChar, ustBaslik)
      .input('Sayfa', sql.Int, parseInt(page))
      .input('SayfaBoyutu', sql.Int, parseInt(limit))
      .execute('sp_IslemlerKategoriye');

    const total = result.recordsets[0][0].ToplamKayit;
    const data = result.recordsets[1];

    return paginated(res, data, page, limit, total, 'Kategoriye göre işlemler');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/gelismis-arama
// Gelişmiş arama (Çoklu filtre)
// SP: sp_IslemlerGelismisArama
// Query: q, anaDalKodu, minFiyat, maxFiyat, seviye, gunSayisi, page, limit
// ============================================
const getGelismisArama = async (req, res, next) => {
  try {
    const { 
      q, 
      anaDalKodu, 
      minFiyat, 
      maxFiyat, 
      seviye, 
      gunSayisi,
      page = 1, 
      limit = 50 
    } = req.query;

    const pool = await getPool();

    const result = await pool.request()
      .input('AramaMetni', sql.NVarChar, q || null)
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .input('MinFiyat', sql.Float, minFiyat ? parseFloat(minFiyat) : null)
      .input('MaxFiyat', sql.Float, maxFiyat ? parseFloat(maxFiyat) : null)
      .input('HiyerarsiSeviyesi', sql.Int, seviye ? parseInt(seviye) : null)
      .input('GunSayisi', sql.Int, gunSayisi ? parseInt(gunSayisi) : null)
      .input('Sayfa', sql.Int, parseInt(page))
      .input('SayfaBoyutu', sql.Int, parseInt(limit))
      .execute('sp_IslemlerGelismisArama');

    const total = result.recordsets[0][0].ToplamKayit;
    const data = result.recordsets[1];

    return paginated(res, data, page, limit, total, 'Gelişmiş arama sonuçları');
  } catch (err) {
    next(err);
  }
};

// ============================================
// EXPORT
// ============================================
module.exports = {
  getIslemler,
  araIslem,
  getFiyatAralik,
  getHiyerarsi,
  getSonGuncellemeler,
  getSutKodu,
  getEnPahali,
  getEnUcuz,
  getKategori,
  getGelismisArama
};

// ============================================
// SUT CONTROLLER
// ============================================
// SUT kodlarının tüm operasyonları
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error, paginated } = require('../utils/response');

// ============================================
// GET /api/sut/ana-basliklar
// SUT ana başlıklarını listele (1-10)
// ============================================
const getAnaBasliklar = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT * FROM vw_SutAnaBaslikOzet
      ORDER BY AnaBaslikNo
    `);

    return success(res, result.recordset, 'SUT ana başlıkları listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/ana-baslik/:no
// Bir ana başlığın detayları
// ============================================
const getAnaBaslikDetay = async (req, res, next) => {
  try {
    const { no } = req.params;
    const pool = await getPool();

    // Ana başlık bilgisi
    const anaBaslikResult = await pool.request()
      .input('no', sql.Int, no)
      .query(`
        SELECT * FROM vw_SutAnaBaslikOzet
        WHERE AnaBaslikNo = @no
      `);

    if (anaBaslikResult.recordset.length === 0) {
      return error(res, 'Ana başlık bulunamadı', 404);
    }

    // Bu ana başlığa ait kategoriler
    const kategoriResult = await pool.request()
      .input('no', sql.Int, no)
      .query(`
        SELECT * FROM vw_SutKategoriOzet
        WHERE AnaBaslikNo = @no
        ORDER BY KategoriID
      `);

    return success(res, {
      anaBaslik: anaBaslikResult.recordset[0],
      kategoriler: kategoriResult.recordset
    }, 'Ana başlık detayı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/kategoriler
// Tüm kategorileri listele (grup sayısı ile)
// ============================================
const getKategoriler = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT * FROM vw_SutKategoriOzet
      ORDER BY KategoriID
    `);

    return success(res, result.recordset, 'Kategoriler listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/kategori/:kategoriId
// Kategoriye göre SUT kodları
// ============================================
const getSutByKategori = async (req, res, next) => {
  try {
    const { kategoriId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('kategoriId', sql.Int, kategoriId)
      .query(`
        SELECT * FROM vw_SutIslemDetay
        WHERE KategoriID = @kategoriId
        ORDER BY SutKodu
      `);

    return success(res, result.recordset, 'Kategori işlemleri listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut
// Tüm SUT kodları (sayfalı)
// ============================================
const getSutKodlari = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      kategoriId,
      anaBaslikNo,
      search,
      sort = 'SutKodu',
      order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const pool = await getPool();

    // Toplam kayıt sayısı
    let countQuery = 'SELECT COUNT(*) as total FROM vw_SutIslemDetay WHERE 1=1';
    const countParams = [];

    if (kategoriId) {
      countQuery += ' AND KategoriID = @kategoriId';
      countParams.push({ name: 'kategoriId', type: sql.Int, value: parseInt(kategoriId) });
    }

    if (anaBaslikNo) {
      countQuery += ' AND AnaBaslikNo = @anaBaslikNo';
      countParams.push({ name: 'anaBaslikNo', type: sql.Int, value: parseInt(anaBaslikNo) });
    }

    if (search) {
      countQuery += ' AND (SutKodu LIKE @search OR IslemAdi LIKE @search)';
      countParams.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    const countRequest = pool.request();
    countParams.forEach(p => countRequest.input(p.name, p.type, p.value));
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    // Veri çekme
    const validSortColumns = ['SutKodu', 'IslemAdi', 'Puan', 'KategoriAdi'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'SutKodu';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let dataQuery = `
      SELECT * FROM vw_SutIslemDetay
      WHERE 1=1
    `;

    if (kategoriId) {
      dataQuery += ' AND KategoriID = @kategoriId';
    }

    if (anaBaslikNo) {
      dataQuery += ' AND AnaBaslikNo = @anaBaslikNo';
    }

    if (search) {
      dataQuery += ' AND (SutKodu LIKE @search OR IslemAdi LIKE @search)';
    }

    // SutKodu sıralaması için özel mantık (harf+rakam kodları dahil)
    if (sortColumn === 'SutKodu') {
      dataQuery += ` ORDER BY 
        CASE 
          WHEN ${sortColumn} LIKE '[0-9]%' THEN 0  -- Sayısal kodlar önce
          ELSE 1  -- Harf ile başlayanlar sonra (R, L, G)
        END,
        ${sortColumn} ${sortOrder}`;
    } else {
      dataQuery += ` ORDER BY ${sortColumn} ${sortOrder}`;
    }
    dataQuery += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const dataRequest = pool.request();
    countParams.forEach(p => dataRequest.input(p.name, p.type, p.value));
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, parseInt(limit));

    const dataResult = await dataRequest.query(dataQuery);

    return paginated(res, dataResult.recordset, page, limit, total, 'SUT kodları listelendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/:kod
// SUT kodu detayı
// ============================================
const getSutByKod = async (req, res, next) => {
  try {
    const { kod } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('kod', sql.NVarChar, kod)
      .query(`
        SELECT * FROM vw_SutIslemDetay
        WHERE SutKodu = @kod
      `);

    if (result.recordset.length === 0) {
      return error(res, 'SUT kodu bulunamadı', 404);
    }

    return success(res, result.recordset[0], 'SUT kodu detayı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/ara
// SUT kodlarında arama (harf+rakam kodları dahil: R, L, G)
// ============================================
const araSut = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;

    if (!q) {
      return error(res, 'Arama terimi gereklidir', 400);
    }

    const pool = await getPool();
    const offset = (page - 1) * limit;

    // Toplam kayıt
    const countResult = await pool.request()
      .input('search', sql.NVarChar, `%${q}%`)
      .query(`
        SELECT COUNT(*) as total 
        FROM vw_SutIslemDetay 
        WHERE SutKodu LIKE @search OR IslemAdi LIKE @search OR Aciklama LIKE @search
      `);

    const total = countResult.recordset[0].total;

    // Veri çekme - SutKodu'na göre sıralama (harf+rakam kodları da doğru sıralanır)
    const result = await pool.request()
      .input('search', sql.NVarChar, `%${q}%`)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT * FROM vw_SutIslemDetay
        WHERE SutKodu LIKE @search OR IslemAdi LIKE @search OR Aciklama LIKE @search
        ORDER BY 
          CASE 
            WHEN SutKodu LIKE '[0-9]%' THEN 0  -- Sayısal kodlar önce
            ELSE 1  -- Harf ile başlayanlar sonra (R, L, G)
          END,
          SutKodu
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return paginated(res, result.recordset, page, limit, total, 'Arama tamamlandı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/stats
// SUT istatistikleri
// ============================================
const getSutStats = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as ToplamSutKodu,
        COUNT(DISTINCT KategoriID) as KategoriSayisi,
        MIN(Puan) as MinPuan,
        MAX(Puan) as MaxPuan,
        AVG(Puan) as OrtalamaPuan,
        SUM(CASE WHEN Puan > 0 THEN 1 ELSE 0 END) as PuanliIslemSayisi
      FROM vw_SutIslemDetay
    `);

    return success(res, result.recordset[0], 'SUT istatistikleri');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/sut/hiyerarsi
// SUT hiyerarşi ağacını getir (stored procedure kullanarak)
// ============================================
const getHiyerarsi = async (req, res, next) => {
  try {
    const { anaBaslikNo, parentId } = req.query;
    const pool = await getPool();

    const request = pool.request();
    
    if (anaBaslikNo) {
      request.input('AnaBaslikNo', sql.Int, parseInt(anaBaslikNo));
    }
    
    if (parentId) {
      request.input('ParentID', sql.Int, parseInt(parentId));
    }

    const result = await request.execute('sp_SutHiyerarsiGetir');

    return success(res, result.recordset, 'SUT hiyerarşi ağacı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// EXPORT
// ============================================
module.exports = {
  getAnaBasliklar,
  getAnaBaslikDetay,
  getKategoriler,
  getSutByKategori,
  getSutKodlari,
  getSutByKod,
  araSut,
  getSutStats,
  getHiyerarsi,
};

// ============================================
// ISLEMLER CONTROLLER
// ============================================
// HUV işlemlerinin tüm CRUD operasyonları
// Endpoint'ler: GET, POST, PUT, DELETE /api/islemler
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error, paginated } = require('../utils/response');

// ============================================
// GET /api/islemler/:id/eslesmeler
// Bir HUV işleminin SUT eşleştirmelerini getir
// ============================================
const getIslemEslesmeler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    // İşlem bilgisi
    const islemResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          i.IslemID,
          i.HuvKodu,
          i.IslemAdi,
          i.Birim,
          a.BolumAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE i.IslemID = @id
      `);

    if (islemResult.recordset.length === 0) {
      return error(res, 'İşlem bulunamadı', 404);
    }

    // Eşleşmeler
    const eslesmelerResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          e.EslestirmeID,
          e.EslestirmeTipi,
          e.GuvenilirlikSkoru,
          s.SutID,
          s.SutKodu,
          s.IslemAdi as SutIslemAdi,
          s.Puan,
          s.Aciklama,
          h.Baslik as HiyerarsiAdi
        FROM HuvSutEslestirme e
        INNER JOIN SutIslemler s ON e.SutID = s.SutID
        LEFT JOIN SutHiyerarsi h ON s.HiyerarsiID = h.HiyerarsiID
        WHERE e.IslemID = @id AND e.AktifMi = 1
        ORDER BY e.GuvenilirlikSkoru DESC
      `);

    return success(res, {
      islem: islemResult.recordset[0],
      eslesmeler: eslesmelerResult.recordset
    }, 'İşlem eşleşmeleri');
  } catch (err) {
    next(err);
  }
};

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
// GET /api/islemler/:id
// İşlem detayı (tam bilgi)
// ============================================
const getIslemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT 
          i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim, i.SutKodu,
          i.UstBaslik, i.HiyerarsiSeviyesi, i.[Not],
          i.GuncellemeTarihi, i.EklemeTarihi,
          i.GuncellemeTarihiDate, i.EklemeTarihiDate,
          i.AnaDalKodu, a.BolumAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE i.IslemID = @id
      `);

    if (result.recordset.length === 0) {
      return error(res, 'İşlem bulunamadı', 404);
    }

    return success(res, result.recordset[0], 'İşlem detayı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/islemler/huv/:kod
// HUV koduna göre işlem bul
// ============================================
const getIslemByHuvKodu = async (req, res, next) => {
  try {
    const { kod } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('kod', sql.Float, parseFloat(kod))
      .query(`
        SELECT 
          i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim, i.SutKodu,
          i.UstBaslik, i.HiyerarsiSeviyesi, i.[Not],
          i.GuncellemeTarihi, i.EklemeTarihi,
          i.AnaDalKodu, a.BolumAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE i.HuvKodu = @kod
      `);

    if (result.recordset.length === 0) {
      return error(res, 'İşlem bulunamadı', 404);
    }

    return success(res, result.recordset[0], 'İşlem bulundu');
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
// POST /api/islemler
// Yeni işlem ekle
// SP: sp_IslemEkle
// Body: huvKodu, islemAdi, birim, sutKodu, ustBaslik, not
// ============================================
const createIslem = async (req, res, next) => {
  try {
    const {
      huvKodu,
      islemAdi,
      birim,
      sutKodu,
      ustBaslik,
      not
    } = req.body;

    // Validation
    if (!huvKodu || !islemAdi) {
      return error(res, 'HUV kodu ve işlem adı zorunludur', 400);
    }

    const pool = await getPool();

    // sp_IslemEkle kullan
    const result = await pool.request()
      .input('HuvKodu', sql.Float, parseFloat(huvKodu))
      .input('IslemAdi', sql.NVarChar, islemAdi)
      .input('Birim', sql.Float, birim ? parseFloat(birim) : null)
      .input('SutKodu', sql.NVarChar, sutKodu || null)
      .input('UstBaslik', sql.NVarChar, ustBaslik || null)
      .input('Not', sql.NVarChar, not || null)
      .execute('sp_IslemEkle');

    const yeniIslemID = result.recordset[0].YeniIslemID;

    // Yeni eklenen işlemi getir
    const yeniIslem = await pool.request()
      .input('id', sql.Int, yeniIslemID)
      .query('SELECT * FROM HuvIslemler WHERE IslemID = @id');

    return success(res, yeniIslem.recordset[0], 'İşlem başarıyla eklendi', 201);
  } catch (err) {
    if (err.message.includes('Bu HUV kodu zaten mevcut')) {
      return error(res, 'Bu HUV kodu zaten mevcut', 409);
    }
    next(err);
  }
};

// ============================================
// PUT /api/islemler/:id
// İşlem güncelle (partial update destekli)
// SP: sp_IslemGuncelle
// Body: islemAdi, birim, sutKodu, not
// ============================================
const updateIslem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      islemAdi,
      birim,
      sutKodu,
      not
    } = req.body;

    const pool = await getPool();

    // İşlem var mı kontrol et
    const checkResult = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('SELECT IslemID FROM HuvIslemler WHERE IslemID = @id');

    if (checkResult.recordset.length === 0) {
      return error(res, 'İşlem bulunamadı', 404);
    }

    // sp_IslemGuncelle kullan
    await pool.request()
      .input('IslemID', sql.Int, parseInt(id))
      .input('IslemAdi', sql.NVarChar, islemAdi || null)
      .input('Birim', sql.Float, birim ? parseFloat(birim) : null)
      .input('SutKodu', sql.NVarChar, sutKodu || null)
      .input('Not', sql.NVarChar, not || null)
      .execute('sp_IslemGuncelle');

    // Güncellenmiş işlemi getir
    const updatedIslem = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT 
          i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim, i.SutKodu,
          i.UstBaslik, i.HiyerarsiSeviyesi, i.[Not],
          i.GuncellemeTarihi, i.EklemeTarihi,
          i.AnaDalKodu, a.BolumAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE i.IslemID = @id
      `);

    return success(res, updatedIslem.recordset[0], 'İşlem başarıyla güncellendi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// DELETE /api/islemler/:id
// İşlem sil (fiziksel silme + audit kaydı)
// İşlem Islemler tablosundan silinir ama versiyonlar ve audit geçmişi korunur
// ============================================
const deleteIslem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    // İşlem var mı kontrol et
    const checkResult = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('SELECT IslemID, HuvKodu, IslemAdi, Birim FROM HuvIslemler WHERE IslemID = @id');

    if (checkResult.recordset.length === 0) {
      return error(res, 'İşlem bulunamadı', 404);
    }

    const islem = checkResult.recordset[0];

    // Audit kaydı ekle (silmeden önce)
    await pool.request()
      .input('IslemID', sql.Int, parseInt(id))
      .input('IslemTipi', sql.NVarChar, 'DELETE')
      .input('EskiBirim', sql.Float, islem.Birim)
      .input('YeniBirim', sql.Float, null)
      .input('DegistirenKullanici', sql.NVarChar, 'system')
      .input('Aciklama', sql.NVarChar, `İşlem silindi: ${islem.IslemAdi} (HUV: ${islem.HuvKodu})`)
      .query(`
        INSERT INTO IslemAudit (IslemID, IslemTipi, EskiBirim, YeniBirim, DegisiklikTarihi, DegistirenKullanici, Aciklama)
        VALUES (@IslemID, @IslemTipi, @EskiBirim, @YeniBirim, GETDATE(), @DegistirenKullanici, @Aciklama)
      `);

    // Fiziksel silme (versiyonlar korunur)
    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM HuvIslemler WHERE IslemID = @id');

    return success(res, {
      islemID: parseInt(id),
      huvKodu: islem.HuvKodu,
      islemAdi: islem.IslemAdi,
      silindi: true
    }, 'İşlem silindi ve audit kaydı oluşturuldu');
  } catch (err) {
    next(err);
  }
};

// ============================================
// POST /api/islemler/toplu-guncelle
// Toplu fiyat güncelleme (%X artış/azalış veya sabit miktar)
// SP: sp_TopluBirimGuncelle
// Body: anaDalKodu, yuzdeOran, sabitArtisMiktari, minBirim, maxBirim
// ============================================
const topluBirimGuncelle = async (req, res, next) => {
  try {
    const {
      anaDalKodu,
      yuzdeOran,
      sabitArtisMiktari,
      minBirim,
      maxBirim
    } = req.body;

    // Validation
    if (!yuzdeOran && !sabitArtisMiktari) {
      return error(res, 'Yüzde oran veya sabit artış miktarı belirtilmelidir', 400);
    }

    if (yuzdeOran && sabitArtisMiktari) {
      return error(res, 'Yüzde oran ve sabit artış miktarı birlikte kullanılamaz', 400);
    }

    const pool = await getPool();

    // sp_TopluBirimGuncelle kullan
    const result = await pool.request()
      .input('AnaDalKodu', sql.Int, anaDalKodu || null)
      .input('YuzdeOran', sql.Float, yuzdeOran || null)
      .input('SabitArtisMiktari', sql.Float, sabitArtisMiktari || null)
      .input('MinBirim', sql.Float, minBirim || null)
      .input('MaxBirim', sql.Float, maxBirim || null)
      .execute('sp_TopluBirimGuncelle');

    const etkilenenKayit = result.recordset[0].EtkilenenKayitSayisi;

    return success(res, {
      etkilenenKayitSayisi: etkilenenKayit,
      anaDalKodu: anaDalKodu || 'Tümü',
      yuzdeOran: yuzdeOran || null,
      sabitArtisMiktari: sabitArtisMiktari || null,
      minBirim: minBirim || null,
      maxBirim: maxBirim || null
    }, `${etkilenenKayit} işlem başarıyla güncellendi`);
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
  // READ-ONLY Operations
  getIslemler,
  getIslemById,
  getIslemByHuvKodu,
  getIslemEslesmeler,
  araIslem,
  getFiyatAralik,
  getHiyerarsi,
  getSonGuncellemeler,
  getSutKodu,
  getEnPahali,
  getEnUcuz,
  getKategori,
  getGelismisArama
  
  // CRUD Operations (Devre Dışı - Excel Import Kullanılıyor)
  // createIslem,
  // updateIslem,
  // deleteIslem,
  // topluBirimGuncelle
};

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

module.exports = {
  getAnaDallar
};

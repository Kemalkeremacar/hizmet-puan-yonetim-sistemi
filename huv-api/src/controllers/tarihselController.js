// ============================================
// TARIHSEL SORGULAR CONTROLLER
// ============================================
// Geçmiş fiyat ve versiyon sorgulama işlemleri
// Endpoint'ler: GET /api/tarihsel/fiyat, GET /api/tarihsel/degisen, GET /api/tarihsel/gecmis/:id
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const { isValidDate, isFutureDate, validateDateRange } = require('../utils/dateUtils');

// ============================================
// GET /api/tarihsel/fiyat
// Belirli tarihteki fiyat sorgulama
// SP: sp_TarihtekiFiyat
// Query Params: huvKodu veya islemId, tarih (zorunlu)
// ============================================
const getFiyatByTarih = async (req, res, next) => {
  try {
    const { huvKodu, islemId, tarih } = req.query;

    if (!tarih) {
      return error(res, 'Tarih parametresi zorunludur', 400);
    }

    if (!isValidDate(tarih)) {
      return error(res, 'Geçersiz tarih formatı', 400);
    }

    if (isFutureDate(tarih)) {
      return error(res, 'Gelecek tarih için sorgu yapılamaz', 400);
    }

    if (!huvKodu && !islemId) {
      return error(res, 'HUV kodu veya işlem ID gereklidir', 400);
    }

    const pool = await getPool();

    // sp_TarihtekiFiyat kullan
    const result = await pool.request()
      .input('HuvKodu', sql.Float, huvKodu ? parseFloat(huvKodu) : null)
      .input('IslemID', sql.Int, islemId ? parseInt(islemId) : null)
      .input('Tarih', sql.Date, tarih)
      .execute('sp_TarihtekiFiyat');

    if (result.recordset.length === 0) {
      return error(res, 'Belirtilen tarihte fiyat bulunamadı', 404);
    }

    return success(res, result.recordset[0], 'Tarihsel fiyat bulundu');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/degisen
// Tarih aralığında değişen işlemler
// SP: sp_TarihAraligindaDegişenler
// Query Params: baslangic, bitis (zorunlu), anaDalKodu
// ============================================
const getDegişenler = async (req, res, next) => {
  try {
    const { baslangic, bitis, anaDalKodu } = req.query;

    // Tarih aralığı validasyonu
    const validation = validateDateRange(baslangic, bitis);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const pool = await getPool();

    // sp_TarihAraligindaDegişenler kullan
    const result = await pool.request()
      .input('BaslangicTarihi', sql.Date, baslangic)
      .input('BitisTarihi', sql.Date, bitis)
      .input('AnaDalKodu', sql.Int, anaDalKodu ? parseInt(anaDalKodu) : null)
      .execute('sp_TarihAraligindaDegişenler');

    return success(res, result.recordset, `${result.recordset.length} işlem değişikliği bulundu`);
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/gecmis/:identifier
// İşlemin tüm fiyat geçmişi (HUV Kodu veya İşlem ID ile)
// SP: sp_FiyatDegisimRaporu (3 result set döndürür)
// ============================================
const getFiyatGecmisi = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const pool = await getPool();

    // Identifier sayı mı yoksa HUV kodu mu kontrol et
    const isNumericId = /^\d+$/.test(identifier);
    let islemId;

    if (isNumericId && parseInt(identifier) < 100000) {
      // Küçük sayı = İşlem ID
      islemId = parseInt(identifier);
    } else {
      // HUV Kodu - önce işlem ID'yi bul
      const huvKodu = parseFloat(identifier);
      const islemResult = await pool.request()
        .input('HuvKodu', sql.Float, huvKodu)
        .query('SELECT IslemID FROM HuvIslemler WHERE HuvKodu = @HuvKodu');

      if (islemResult.recordset.length === 0) {
        return error(res, 'Bu HUV koduna sahip işlem bulunamadı', 404);
      }
      islemId = islemResult.recordset[0].IslemID;
    }

    // sp_FiyatDegisimRaporu kullan - 3 result set döndürür
    const result = await pool.request()
      .input('IslemID', sql.Int, islemId)
      .execute('sp_FiyatDegisimRaporu');

    // SP 3 result set döndürür: işlem bilgisi, versiyonlar, audit
    const islemBilgisi = result.recordsets[0]?.[0];
    const versiyonlar = result.recordsets[1] || [];
    const auditGecmisi = result.recordsets[2] || [];

    // İşlem bilgisi yoksa (silinmiş olabilir), versiyonlardan al
    let islemInfo = islemBilgisi;
    if (!islemInfo && versiyonlar.length > 0) {
      // En son versiyondan bilgi al
      const sonVersiyon = versiyonlar[0];
      islemInfo = {
        IslemID: islemId,
        HuvKodu: sonVersiyon.HuvKodu || identifier,
        IslemAdi: sonVersiyon.IslemAdi || 'Bilinmiyor',
        GuncelBirim: null,
        BolumAdi: sonVersiyon.BolumAdi || null,
        AktifMi: false
      };
    }

    if (!islemInfo) {
      return error(res, 'İşlem bulunamadı', 404);
    }

    // AktifMi durumunu kontrol et (hem 1 hem true olabilir)
    const mevcutMu = islemInfo.AktifMi === true || islemInfo.AktifMi === 1;

    return success(res, {
      islem: islemInfo,
      versiyonlar: versiyonlar,
      auditGecmisi: auditGecmisi,
      mevcutMu: mevcutMu
    }, 'Fiyat geçmişi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/versiyonlar/:islemId
// İşlemin tüm versiyonları
// Table: IslemVersionlar
// ============================================
const getVersionlar = async (req, res, next) => {
  try {
    const { islemId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('islemId', sql.Int, parseInt(islemId))
      .query(`
        SELECT 
          VersionID, IslemID, HuvKodu, IslemAdi, Birim, SutKodu,
          [Not], GecerlilikBaslangic, GecerlilikBitis,
          AktifMi, OlusturanKullanici, OlusturmaTarihi, DegisiklikSebebi
        FROM IslemVersionlar
        WHERE IslemID = @islemId
        ORDER BY GecerlilikBaslangic DESC
      `);

    return success(res, result.recordset, 'Versiyon geçmişi');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFiyatByTarih,
  getDegişenler,
  getFiyatGecmisi,
  getVersionlar
};

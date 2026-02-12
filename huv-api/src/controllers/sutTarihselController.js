// ============================================
// SUT TARİHSEL SORGULAR CONTROLLER
// ============================================
// SUT kodlarının geçmiş puan ve versiyon sorgulama işlemleri
// Endpoint'ler: GET /api/tarihsel/sut/*
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const { isValidDate, isFutureDate, validateDateRange } = require('../utils/dateUtils');

// ============================================
// GET /api/tarihsel/sut/puan
// Belirli tarihteki SUT puan sorgulama
// SP: sp_SutTarihtekiPuan
// Query Params: sutKodu veya sutId, tarih (zorunlu)
// ============================================
const getPuanByTarih = async (req, res, next) => {
  try {
    const { sutKodu, sutId, tarih } = req.query;

    if (!tarih) {
      return error(res, 'Tarih parametresi zorunludur', 400);
    }

    if (!isValidDate(tarih)) {
      return error(res, 'Geçersiz tarih formatı (YYYY-MM-DD)', 400);
    }

    if (isFutureDate(tarih)) {
      return error(res, 'Gelecek tarih için sorgu yapılamaz', 400);
    }

    if (!sutKodu && !sutId) {
      return error(res, 'SUT kodu veya SUT ID gereklidir', 400);
    }

    const pool = await getPool();

    // sp_SutTarihtekiPuan kullan
    const result = await pool.request()
      .input('SutKodu', sql.NVarChar, sutKodu || null)
      .input('SutID', sql.Int, sutId ? parseInt(sutId) : null)
      .input('Tarih', sql.Date, tarih)
      .execute('sp_SutTarihtekiPuan');

    if (result.recordset.length === 0) {
      return error(res, 'Belirtilen tarihte puan bulunamadı', 404, {
        tip: 'PUAN_BULUNAMADI',
        detay: 'Bu SUT kodu için belirtilen tarihte geçerli bir kayıt yok'
      });
    }

    return success(res, result.recordset[0], 'Tarihsel puan bulundu');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/sut/degisen
// Tarih aralığında değişen SUT kodları
// SP: sp_SutTarihAraligindaDegişenler
// Query Params: baslangic, bitis (zorunlu), anaBaslikNo
// ============================================
const getDegişenler = async (req, res, next) => {
  try {
    const { baslangic, bitis, anaBaslikNo } = req.query;

    // Tarih aralığı validasyonu
    const validation = validateDateRange(baslangic, bitis);
    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    const pool = await getPool();

    // sp_SutTarihAraligindaDegis kullan (Türkçe karakter olmadan)
    const result = await pool.request()
      .input('BaslangicTarihi', sql.Date, baslangic)
      .input('BitisTarihi', sql.Date, bitis)
      .input('AnaBaslikNo', sql.Int, anaBaslikNo ? parseInt(anaBaslikNo) : null)
      .execute('sp_SutTarihAraligindaDegis');

    return success(res, result.recordset, `${result.recordset.length} SUT kodu değişikliği bulundu`);
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/sut/gecmis/:identifier
// SUT kodunun tüm puan geçmişi (SUT Kodu veya SUT ID ile)
// SP: sp_SutPuanDegisimRaporu (3 result set döndürür)
// ============================================
const getPuanGecmisi = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const pool = await getPool();

    // Identifier sayı mı yoksa SUT kodu mu kontrol et
    const isNumericId = /^\d+$/.test(identifier);
    let sutId;

    if (isNumericId && parseInt(identifier) < 100000) {
      // Küçük sayı = SUT ID
      sutId = parseInt(identifier);
    } else {
      // SUT Kodu - önce SUT ID'yi bul
      const sutKodu = identifier;
      const islemResult = await pool.request()
        .input('SutKodu', sql.NVarChar, sutKodu)
        .query('SELECT SutID FROM SutIslemler WHERE SutKodu = @SutKodu');

      if (islemResult.recordset.length === 0) {
        return error(res, 'Bu SUT koduna sahip işlem bulunamadı', 404, {
          tip: 'SUT_BULUNAMADI',
          sutKodu: identifier
        });
      }
      sutId = islemResult.recordset[0].SutID;
    }

    // sp_SutPuanDegisimRaporu kullan - 3 result set döndürür
    const result = await pool.request()
      .input('SutID', sql.Int, sutId)
      .execute('sp_SutPuanDegisimRaporu');

    // SP 3 result set döndürür: işlem bilgisi, versiyonlar, istatistikler
    const islemBilgisi = result.recordsets[0]?.[0];
    const versiyonlar = result.recordsets[1] || [];
    const istatistikler = result.recordsets[2]?.[0];

    // İşlem bilgisi yoksa (silinmiş olabilir), versiyonlardan al
    let islemInfo = islemBilgisi;
    if (!islemInfo && versiyonlar.length > 0) {
      // En son versiyondan bilgi al
      const sonVersiyon = versiyonlar[0];
      islemInfo = {
        SutID: sutId,
        SutKodu: sonVersiyon.SutKodu || identifier,
        IslemAdi: sonVersiyon.IslemAdi || 'Bilinmiyor',
        GuncelPuan: null,
        KategoriAdi: sonVersiyon.KategoriAdi || null,
        AktifMi: false
      };
    }

    if (!islemInfo) {
      return error(res, 'SUT işlemi bulunamadı', 404, {
        tip: 'SUT_BULUNAMADI',
        sutId: sutId
      });
    }

    // AktifMi durumunu kontrol et (hem 1 hem true olabilir)
    const mevcutMu = islemInfo.AktifMi === true || islemInfo.AktifMi === 1;

    return success(res, {
      islem: islemInfo,
      versiyonlar: versiyonlar,
      istatistikler: istatistikler,
      mevcutMu: mevcutMu
    }, 'Puan geçmişi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/sut/versiyonlar/:sutId
// SUT işleminin tüm versiyonları
// Table: SutIslemVersionlar
// ============================================
const getVersionlar = async (req, res, next) => {
  try {
    const { sutId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('sutId', sql.Int, parseInt(sutId))
      .query(`
        SELECT 
          v.VersionID, 
          v.SutID, 
          v.SutKodu, 
          v.IslemAdi, 
          v.Puan,
          v.Aciklama,
          v.AnaBaslikNo,
          v.HiyerarsiID,
          v.GecerlilikBaslangic, 
          v.GecerlilikBitis,
          v.AktifMi, 
          v.OlusturanKullanici, 
          v.OlusturmaTarihi, 
          v.DegisiklikSebebi,
          lv.DosyaAdi,
          lv.YukleyenKullanici,
          lv.YuklemeTarihi
        FROM SutIslemVersionlar v
        LEFT JOIN ListeVersiyonlari lv ON v.ListeVersiyonID = lv.VersiyonID
        WHERE v.SutID = @sutId
        ORDER BY v.GecerlilikBaslangic DESC
      `);

    return success(res, result.recordset, 'Versiyon geçmişi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/sut/karsilastir
// İki liste versiyonu arasındaki SUT farklarını karşılaştır
// SP: sp_SutVersiyonKarsilastir
// Query Params: eskiVersiyon, yeniVersiyon (zorunlu)
// ============================================
const karsilastirVersiyonlar = async (req, res, next) => {
  try {
    const { eskiVersiyon, yeniVersiyon } = req.query;

    if (!eskiVersiyon || !yeniVersiyon) {
      return error(res, 'Eski ve yeni versiyon ID\'leri gereklidir', 400, {
        tip: 'PARAMETRE_EKSIK',
        detay: 'eskiVersiyon ve yeniVersiyon query parametreleri zorunludur'
      });
    }

    if (parseInt(eskiVersiyon) === parseInt(yeniVersiyon)) {
      return error(res, 'Eski ve yeni versiyon aynı olamaz', 400, {
        tip: 'AYNI_VERSIYON'
      });
    }

    const pool = await getPool();

    // sp_SutVersiyonKarsilastir kullan
    const result = await pool.request()
      .input('EskiVersiyonID', sql.Int, parseInt(eskiVersiyon))
      .input('YeniVersiyonID', sql.Int, parseInt(yeniVersiyon))
      .execute('sp_SutVersiyonKarsilastir');

    const farklar = result.recordset;

    // Özet istatistikler
    const ozet = {
      toplam: farklar.length,
      eklenen: farklar.filter(f => f.DegisiklikTipi === 'ADDED').length,
      guncellenen: farklar.filter(f => f.DegisiklikTipi === 'UPDATED').length,
      silinen: farklar.filter(f => f.DegisiklikTipi === 'DELETED').length
    };

    // Versiyon bilgileri (ilk satırdan al)
    const versionInfo = farklar.length > 0 ? {
      eskiVersiyon: {
        VersiyonID: parseInt(eskiVersiyon),
        DosyaAdi: farklar[0].EskiDosyaAdi,
        YuklemeTarihi: farklar[0].EskiTarih
      },
      yeniVersiyon: {
        VersiyonID: parseInt(yeniVersiyon),
        DosyaAdi: farklar[0].YeniDosyaAdi,
        YuklemeTarihi: farklar[0].YeniTarih
      }
    } : null;

    return success(res, {
      ...versionInfo,
      ozet: ozet,
      farklar: farklar
    }, `${farklar.length} fark bulundu`);
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/tarihsel/sut/stats
// SUT tarihsel istatistikleri
// ============================================
const getTarihselStats = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        COUNT(DISTINCT SutID) as ToplamSutSayisi,
        COUNT(*) as ToplamVersionSayisi,
        COUNT(DISTINCT ListeVersiyonID) as ToplamListeVersiyonu,
        MIN(GecerlilikBaslangic) as IlkKayitTarihi,
        MAX(GecerlilikBaslangic) as SonKayitTarihi,
        AVG(Puan) as OrtalamaPuan,
        MIN(Puan) as MinPuan,
        MAX(Puan) as MaxPuan,
        -- Değişiklik istatistikleri
        SUM(CASE WHEN DegisiklikSebebi LIKE '%Puan%' THEN 1 ELSE 0 END) as PuanDegisiklikSayisi,
        SUM(CASE WHEN DegisiklikSebebi LIKE '%İşlem Adı%' THEN 1 ELSE 0 END) as IslemAdiDegisiklikSayisi,
        SUM(CASE WHEN DegisiklikSebebi = 'Yeni işlem eklendi' THEN 1 ELSE 0 END) as YeniEklemeSayisi,
        SUM(CASE WHEN DegisiklikSebebi = 'Reaktivasyon' THEN 1 ELSE 0 END) as ReaktivasyonSayisi
      FROM SutIslemVersionlar
    `);

    return success(res, result.recordset[0], 'SUT tarihsel istatistikleri');
  } catch (err) {
    next(err);
  }
};

// ============================================
// EXPORT
// ============================================
module.exports = {
  getPuanByTarih,
  getDegişenler,
  getPuanGecmisi,
  getVersionlar,
  karsilastirVersiyonlar,
  getTarihselStats
};

// ============================================
// TARIHSEL SORGULAR CONTROLLER
// ============================================
// Geçmiş fiyat ve versiyon sorgulama işlemleri
// Endpoint'ler: GET /api/tarihsel/fiyat, GET /api/tarihsel/degisen, GET /api/tarihsel/gecmis/:id
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const { 
  isValidDate, 
  isFutureDate, 
  validateDateRange,
  validateStartDate,
  validateDateRangeWithStart,
  HUV_START_DATE
} = require('../utils/dateUtils');

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

    // Tarih formatı kontrolü
    if (!isValidDate(tarih)) {
      return error(res, 'Geçersiz tarih formatı. Lütfen YYYY-MM-DD formatında girin (örn: 2025-10-07)', 400, {
        tip: 'GECERSIZ_TARIH_FORMATI',
        cozum: 'Tarih formatı YYYY-MM-DD olmalıdır (örn: 2025-10-07)'
      });
    }

    // Gelecek tarih kontrolü
    if (isFutureDate(tarih)) {
      return error(res, 'Gelecek tarih için sorgu yapılamaz. Lütfen bugün veya geçmiş bir tarih seçin.', 400, {
        tip: 'GELECEK_TARIH',
        cozum: 'Sorgu yapmak için bugün veya geçmiş bir tarih seçmelisiniz'
      });
    }

    // Başlangıç tarihi kontrolü (HUV için 07.10.2025)
    const startDateValidation = validateStartDate(tarih, 'HUV');
    if (!startDateValidation.valid) {
      return error(res, startDateValidation.error, 400, {
        tip: startDateValidation.tip || 'TARIH_BASLANGIC_ONDEN',
        cozum: startDateValidation.cozum || `HUV listesi için sorgu yapılabilecek en eski tarih ${HUV_START_DATE} tarihidir.`,
        baslangicTarihi: HUV_START_DATE,
        girilenTarih: tarih
      });
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

    // Tarih aralığı validasyonu (başlangıç tarihi kontrolü dahil)
    const validation = validateDateRangeWithStart(baslangic, bitis, 'HUV');
    if (!validation.valid) {
      return error(res, validation.error, 400, {
        tip: validation.tip || 'GECERSIZ_TARIH_ARALIGI',
        cozum: validation.cozum || `HUV listesi için sorgu yapılabilecek en eski tarih ${HUV_START_DATE} tarihidir.`,
        baslangicTarihi: HUV_START_DATE,
        girilenBaslangic: baslangic,
        girilenBitis: bitis
      });
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

    // En eski versiyon tarihini kontrol et
    const enEskiVersiyon = versiyonlar.length > 0 
      ? versiyonlar[versiyonlar.length - 1] 
      : null;
    const enEskiTarih = enEskiVersiyon?.GecerlilikBaslangic 
      ? new Date(enEskiVersiyon.GecerlilikBaslangic).toISOString().split('T')[0]
      : null;

    return success(res, {
      islem: islemInfo,
      versiyonlar: versiyonlar,
      auditGecmisi: auditGecmisi,
      mevcutMu: mevcutMu,
      baslangicTarihi: HUV_START_DATE,
      enEskiVersiyonTarihi: enEskiTarih,
      uyari: enEskiTarih && new Date(enEskiTarih) < new Date(HUV_START_DATE)
        ? `Not: Bu işlemin bazı versiyonları başlangıç tarihinden (${HUV_START_DATE}) önce olabilir. Sistemde sorgu yapılabilecek en eski tarih ${HUV_START_DATE} tarihidir.`
        : null
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

// ============================================
// GET /api/tarihsel/yasam-dongusu/:identifier
// HUV işleminin yaşam döngüsü (eklenme, güncellenme, silinme olayları)
// Fiyat geçmişinden farklı: Bu endpoint sadece yaşam döngüsü olaylarını gösterir
// Param: identifier (HUV Kodu veya İşlem ID)
// ============================================
const getYasamDongusu = async (req, res, next) => {
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
        return error(res, 'Bu HUV koduna sahip işlem bulunamadı', 404, {
          tip: 'HUV_BULUNAMADI',
          huvKodu: identifier
        });
      }
      islemId = islemResult.recordset[0].IslemID;
    }

    // Yaşam döngüsü olaylarını al (tüm versiyonlar, kronolojik sırada)
    const yasamDongusuResult = await pool.request()
      .input('IslemID', sql.Int, islemId)
      .query(`
        SELECT 
          v.VersionID,
          v.HuvKodu,
          v.IslemAdi,
          v.Birim,
          v.GecerlilikBaslangic as Tarih,
          v.GecerlilikBitis,
          v.AktifMi,
          v.DegisiklikSebebi as Aciklama,
          v.OlusturmaTarihi,
          lv.YuklemeTarihi,
          lv.DosyaAdi,
          lv.YukleyenKullanici,
          -- Durum belirleme
          CASE 
            WHEN v.DegisiklikSebebi LIKE '%eklendi%' OR v.DegisiklikSebebi LIKE '%Reaktivasyon%' THEN 'Eklendi'
            WHEN v.DegisiklikSebebi LIKE '%güncellendi%' OR v.DegisiklikSebebi LIKE '%Birim%' THEN 'Güncellendi'
            WHEN v.GecerlilikBitis IS NOT NULL AND v.AktifMi = 0 THEN 'Silindi'
            WHEN v.AktifMi = 1 AND v.GecerlilikBitis IS NULL THEN 'Aktif'
            ELSE 'Bilinmiyor'
          END as Durum
        FROM IslemVersionlar v
        LEFT JOIN ListeVersiyon lv ON v.ListeVersiyonID = lv.VersionID
        WHERE v.IslemID = @IslemID
        ORDER BY v.GecerlilikBaslangic ASC, v.OlusturmaTarihi ASC
      `);

    if (yasamDongusuResult.recordset.length === 0) {
      return error(res, 'HUV işlemi bulunamadı', 404, {
        tip: 'HUV_BULUNAMADI',
        islemId: islemId
      });
    }

    // İlk kayıt tarihini bul (tahmini - en eski versiyon)
    const ilkKayit = yasamDongusuResult.recordset[0];
    const ilkKayitTarihi = ilkKayit.Tarih || ilkKayit.OlusturmaTarihi;

    // Şu anki durumu belirle
    const sonKayit = yasamDongusuResult.recordset[yasamDongusuResult.recordset.length - 1];
    const suAnkiDurum = sonKayit.AktifMi === 1 || sonKayit.AktifMi === true ? 'Aktif' : 'Pasif';
    const suAnkiDurumAciklama = suAnkiDurum === 'Aktif' 
      ? 'HUV kodu sistemde aktif olarak bulunuyor'
      : 'HUV kodu sistemde pasif durumda';

    // Yaşam döngüsü olaylarını map et
    const yasamDongusu = yasamDongusuResult.recordset.map((kayit, index) => {
      // İlk kayıt için özel açıklama
      let aciklama = kayit.Aciklama;
      if (index === 0 && !aciklama) {
        aciklama = 'İlk kayıt oluşturuldu (tahmini)';
      }

      return {
        tarih: kayit.Tarih || kayit.OlusturmaTarihi,
        durum: kayit.Durum,
        aciklama: aciklama,
        birim: kayit.Birim,
        versiyonId: kayit.VersionID,
        dosyaAdi: kayit.DosyaAdi,
        yukleyenKullanici: kayit.YukleyenKullanici,
        yuklemeTarihi: kayit.YuklemeTarihi
      };
    });

    // İşlem bilgisi
    const islemBilgisi = await pool.request()
      .input('IslemID', sql.Int, islemId)
      .query(`
        SELECT TOP 1
          IslemID,
          HuvKodu,
          IslemAdi,
          Birim,
          AktifMi
        FROM HuvIslemler
        WHERE IslemID = @IslemID
      `);

    return success(res, {
      islem: islemBilgisi.recordset[0] || {
        IslemID: islemId,
        HuvKodu: ilkKayit.HuvKodu,
        IslemAdi: ilkKayit.IslemAdi,
        AktifMi: sonKayit.AktifMi
      },
      suAnkiDurum: suAnkiDurum,
      suAnkiDurumAciklama: suAnkiDurumAciklama,
      ilkKayitTarihi: ilkKayitTarihi,
      yasamDongusu: yasamDongusu,
      toplamOlay: yasamDongusu.length
    }, 'HUV kodu yaşam döngüsü');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFiyatByTarih,
  getDegişenler,
  getFiyatGecmisi,
  getVersionlar,
  getYasamDongusu
};

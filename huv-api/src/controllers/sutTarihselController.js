// ============================================
// SUT TARİHSEL SORGULAR CONTROLLER
// ============================================
// SUT kodlarının geçmiş puan ve versiyon sorgulama işlemleri
// Endpoint'ler: GET /api/tarihsel/sut/*
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const { 
  isValidDate, 
  isFutureDate, 
  validateDateRange,
  validateStartDate,
  validateDateRangeWithStart,
  SUT_START_DATE
} = require('../utils/dateUtils');

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

    // Tarih formatı kontrolü
    if (!isValidDate(tarih)) {
      return error(res, 'Geçersiz tarih formatı. Lütfen YYYY-MM-DD formatında girin (örn: 2026-01-01)', 400, {
        tip: 'GECERSIZ_TARIH_FORMATI',
        cozum: 'Tarih formatı YYYY-MM-DD olmalıdır (örn: 2026-01-01)'
      });
    }

    // Gelecek tarih kontrolü
    if (isFutureDate(tarih)) {
      return error(res, 'Gelecek tarih için sorgu yapılamaz. Lütfen bugün veya geçmiş bir tarih seçin.', 400, {
        tip: 'GELECEK_TARIH',
        cozum: 'Sorgu yapmak için bugün veya geçmiş bir tarih seçmelisiniz'
      });
    }

    // Başlangıç tarihi kontrolü (SUT için 01.01.2026)
    const startDateValidation = validateStartDate(tarih, 'SUT');
    if (!startDateValidation.valid) {
      return error(res, startDateValidation.error, 400, {
        tip: startDateValidation.tip || 'TARIH_BASLANGIC_ONDEN',
        cozum: startDateValidation.cozum || `SUT listesi için sorgu yapılabilecek en eski tarih ${SUT_START_DATE} tarihidir.`,
        baslangicTarihi: SUT_START_DATE,
        girilenTarih: tarih
      });
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
      // Daha detaylı hata mesajı için versiyon bilgilerini kontrol et
      const versiyonKontrol = await pool.request()
        .input('SutKodu', sql.NVarChar, sutKodu || null)
        .input('SutID', sql.Int, sutId ? parseInt(sutId) : null)
        .query(`
          SELECT 
            MIN(GecerlilikBaslangic) as EnEskiTarih,
            MAX(GecerlilikBaslangic) as EnYeniTarih,
            COUNT(*) as ToplamVersiyon
          FROM SutIslemVersionlar
          WHERE (@SutKodu IS NULL OR SutKodu = @SutKodu)
            AND (@SutID IS NULL OR SutID = @SutID)
        `);
      
      const versiyonInfo = versiyonKontrol.recordset[0];
      const enEskiTarih = versiyonInfo?.EnEskiTarih 
        ? new Date(versiyonInfo.EnEskiTarih).toISOString().split('T')[0]
        : null;
      
      let detayMesaji = 'Bu SUT kodu için belirtilen tarihte geçerli bir kayıt yok';
      if (enEskiTarih && new Date(tarih) < new Date(enEskiTarih)) {
        detayMesaji += `. En eski kayıt tarihi: ${enEskiTarih}`;
      } else if (enEskiTarih) {
        detayMesaji += `. Mevcut kayıtlar: ${enEskiTarih} - ${versiyonInfo?.EnYeniTarih ? new Date(versiyonInfo.EnYeniTarih).toISOString().split('T')[0] : 'şimdi'}`;
      }
      
      return error(res, 'Belirtilen tarihte puan bulunamadı', 404, {
        tip: 'PUAN_BULUNAMADI',
        detay: detayMesaji,
        tarih: tarih,
        enEskiTarih: enEskiTarih
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

    // Tarih aralığı validasyonu (başlangıç tarihi kontrolü dahil)
    const validation = validateDateRangeWithStart(baslangic, bitis, 'SUT');
    if (!validation.valid) {
      return error(res, validation.error, 400, {
        tip: validation.tip || 'GECERSIZ_TARIH_ARALIGI',
        cozum: validation.cozum || `SUT listesi için sorgu yapılabilecek en eski tarih ${SUT_START_DATE} tarihidir.`,
        baslangicTarihi: SUT_START_DATE,
        girilenBaslangic: baslangic,
        girilenBitis: bitis
      });
    }

    const pool = await getPool();

    // sp_SutTarihAraligindaDegis kullan (Türkçe karakter olmadan)
    const result = await pool.request()
      .input('BaslangicTarihi', sql.Date, baslangic)
      .input('BitisTarihi', sql.Date, bitis)
      .input('AnaBaslikNo', sql.Int, anaBaslikNo ? parseInt(anaBaslikNo) : null)
      .execute('sp_SutTarihAraligindaDegis');

    // Frontend uyumluluğu için field mapping
    const mappedData = result.recordset.map(item => ({
      ...item,
      Fark: item.PuanDegisimi || item.Fark, // PuanDegisimi -> Fark
      DegisimYuzdesi: item.PuanDegisimYuzdesi || item.DegisimYuzdesi, // PuanDegisimYuzdesi -> DegisimYuzdesi
      DegisiklikTarihi: item.SonDegisiklik || item.DegisiklikTarihi || item.IlkDegisiklik // SonDegisiklik -> DegisiklikTarihi
    }));

    // Boş sonuç için bilgilendirme
    if (mappedData.length === 0) {
      return success(res, [], 'Belirtilen tarih aralığında değişiklik bulunamadı', {
        baslangic,
        bitis,
        uyari: 'Bu tarih aralığında puan değişikliği olan SUT kodu bulunamadı'
      });
    }

    return success(res, mappedData, `${mappedData.length} SUT kodu değişikliği bulundu`);
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

    // İşlem bilgisi yoksa (silinmiş olabilir), mevcut kayda veya versiyonlardan al
    let islemInfo = islemBilgisi;
    if (!islemInfo) {
      // Önce mevcut kayda bak
      const mevcutKayitKontrol = await pool.request()
        .input('SutID', sql.Int, sutId)
        .query(`
          SELECT TOP 1
            SutID,
            SutKodu,
            IslemAdi,
            Puan as GuncelPuan,
            AnaBaslikNo,
            AktifMi
          FROM SutIslemler
          WHERE SutID = @SutID
        `);
      
      if (mevcutKayitKontrol.recordset.length > 0) {
        islemInfo = mevcutKayitKontrol.recordset[0];
      } else if (versiyonlar.length > 0) {
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
    }

    if (!islemInfo) {
      return error(res, 'SUT işlemi bulunamadı', 404, {
        tip: 'SUT_BULUNAMADI',
        sutId: sutId
      });
    }

    // AktifMi durumunu kontrol et (hem 1 hem true olabilir)
    const mevcutMu = islemInfo.AktifMi === true || islemInfo.AktifMi === 1;

    // Versiyonları map et: SutVersionID -> VersionID (frontend uyumluluğu için)
    const mappedVersiyonlar = versiyonlar.map((v, index) => {
      // Puan değişimi kontrolü - eğer NULL ise ve önceki versiyon varsa hesapla
      let puanDegisimi = v.PuanDegisimi;
      if (puanDegisimi === null && index < versiyonlar.length - 1) {
        const oncekiVersiyon = versiyonlar[index + 1];
        if (oncekiVersiyon && oncekiVersiyon.Puan !== null && v.Puan !== null) {
          puanDegisimi = v.Puan - oncekiVersiyon.Puan;
        }
      }
      
      return {
        ...v,
        VersionID: v.SutVersionID || v.VersionID, // Frontend uyumluluğu
        PuanDegisimi: puanDegisimi !== null ? puanDegisimi : v.PuanDegisimi // Düzeltilmiş puan değişimi
      };
    });

    // En eski versiyon tarihini kontrol et
    const enEskiVersiyon = mappedVersiyonlar.length > 0 
      ? mappedVersiyonlar[mappedVersiyonlar.length - 1] 
      : null;
    const enEskiTarih = enEskiVersiyon?.GecerlilikBaslangic 
      ? new Date(enEskiVersiyon.GecerlilikBaslangic).toISOString().split('T')[0]
      : null;

    return success(res, {
      islem: islemInfo,
      sut: islemInfo, // Frontend uyumluluğu için (sut field'ı da ekle)
      versiyonlar: mappedVersiyonlar,
      istatistikler: istatistikler,
      mevcutMu: mevcutMu,
      baslangicTarihi: SUT_START_DATE,
      enEskiVersiyonTarihi: enEskiTarih,
      uyari: enEskiTarih && new Date(enEskiTarih) < new Date(SUT_START_DATE)
        ? `Not: Bu işlemin bazı versiyonları başlangıç tarihinden (${SUT_START_DATE}) önce olabilir. Sistemde sorgu yapılabilecek en eski tarih ${SUT_START_DATE} tarihidir.`
        : null
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
          v.SutVersionID as VersionID, 
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
        LEFT JOIN ListeVersiyon lv ON v.ListeVersiyonID = lv.VersionID
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
// GET /api/tarihsel/sut/yasam-dongusu/:identifier
// SUT kodunun yaşam döngüsü (eklenme, güncellenme, silinme olayları)
// Puan geçmişinden farklı: Bu endpoint sadece yaşam döngüsü olaylarını gösterir
// Param: identifier (SUT Kodu veya SUT ID)
// ============================================
const getYasamDongusu = async (req, res, next) => {
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

    // Önce mevcut kaydı kontrol et
    const mevcutKayit = await pool.request()
      .input('SutID', sql.Int, sutId)
      .query(`
        SELECT TOP 1
          SutID,
          SutKodu,
          IslemAdi,
          Puan,
          AktifMi,
          OlusturmaTarihi
        FROM SutIslemler
        WHERE SutID = @SutID
      `);

    if (mevcutKayit.recordset.length === 0) {
      return error(res, 'SUT işlemi bulunamadı', 404, {
        tip: 'SUT_BULUNAMADI',
        sutId: sutId
      });
    }

    const mevcutKayitData = mevcutKayit.recordset[0];

    // Yaşam döngüsü olaylarını al (tüm versiyonlar, kronolojik sırada)
    const yasamDongusuResult = await pool.request()
      .input('SutID', sql.Int, sutId)
      .query(`
        SELECT 
          v.SutVersionID as VersionID,
          v.SutKodu,
          v.IslemAdi,
          v.Puan,
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
            WHEN v.DegisiklikSebebi LIKE '%güncellendi%' OR v.DegisiklikSebebi LIKE '%Puan%' THEN 'Güncellendi'
            WHEN v.GecerlilikBitis IS NOT NULL AND v.AktifMi = 0 THEN 'Silindi'
            WHEN v.AktifMi = 1 AND v.GecerlilikBitis IS NULL THEN 'Aktif'
            ELSE 'Bilinmiyor'
          END as Durum
        FROM SutIslemVersionlar v
        LEFT JOIN ListeVersiyon lv ON v.ListeVersiyonID = lv.VersionID
        WHERE v.SutID = @SutID
        ORDER BY v.GecerlilikBaslangic ASC, v.OlusturmaTarihi ASC
      `);

    // Eğer versiyon yoksa, mevcut kaydı yaşam döngüsüne ekle
    let yasamDongusuData = yasamDongusuResult.recordset;
    
    if (yasamDongusuData.length === 0) {
      // Versiyon yok, mevcut kaydı ekle
      // İlk import tarihini ListeVersiyon'dan al
      let ilkImportTarihi = new Date('2026-01-01'); // Varsayılan
      
      try {
        const ilkImportResult = await pool.request().query(`
          SELECT TOP 1 CAST(YuklemeTarihi AS DATE) as IlkImportTarihi
          FROM ListeVersiyon
          WHERE ListeTipi = 'SUT'
          ORDER BY VersionID ASC
        `);
        
        if (ilkImportResult.recordset.length > 0 && ilkImportResult.recordset[0].IlkImportTarihi) {
          ilkImportTarihi = new Date(ilkImportResult.recordset[0].IlkImportTarihi);
        }
      } catch (err) {
        console.warn('İlk import tarihi alınamadı, varsayılan tarih kullanılıyor:', err.message);
      }
      
      const ilkKayitTarihi = mevcutKayitData.OlusturmaTarihi 
        ? new Date(mevcutKayitData.OlusturmaTarihi)
        : ilkImportTarihi;
      
      yasamDongusuData = [{
        VersionID: null,
        SutKodu: mevcutKayitData.SutKodu,
        IslemAdi: mevcutKayitData.IslemAdi,
        Puan: mevcutKayitData.Puan,
        Tarih: ilkKayitTarihi,
        GecerlilikBitis: null,
        AktifMi: mevcutKayitData.AktifMi,
        Aciklama: 'İlk kayıt oluşturuldu (tahmini)',
        OlusturmaTarihi: ilkKayitTarihi,
        YuklemeTarihi: null,
        DosyaAdi: null,
        YukleyenKullanici: null,
        Durum: mevcutKayitData.AktifMi === 1 || mevcutKayitData.AktifMi === true ? 'Aktif' : 'Pasif'
      }];
    }

    // İlk kayıt tarihini bul (tahmini - en eski versiyon)
    const ilkKayit = yasamDongusuData[0];
    const ilkKayitTarihi = ilkKayit.Tarih || ilkKayit.OlusturmaTarihi;

    // Şu anki durumu belirle - mevcut kayıttan al
    const suAnkiDurum = mevcutKayitData.AktifMi === 1 || mevcutKayitData.AktifMi === true ? 'Aktif' : 'Pasif';
    const suAnkiDurumAciklama = suAnkiDurum === 'Aktif' 
      ? 'SUT kodu sistemde aktif olarak bulunuyor'
      : 'SUT kodu sistemde pasif durumda';

    // Yaşam döngüsü olaylarını map et
    const yasamDongusu = yasamDongusuData.map((kayit, index) => {
      // İlk kayıt için özel açıklama
      let aciklama = kayit.Aciklama;
      if (index === 0 && !aciklama) {
        aciklama = 'İlk kayıt oluşturuldu (tahmini)';
      }

      return {
        tarih: kayit.Tarih || kayit.OlusturmaTarihi,
        durum: kayit.Durum,
        aciklama: aciklama,
        puan: kayit.Puan,
        versiyonId: kayit.VersionID,
        dosyaAdi: kayit.DosyaAdi,
        yukleyenKullanici: kayit.YukleyenKullanici,
        yuklemeTarihi: kayit.YuklemeTarihi
      };
    });

    // İşlem bilgisi
    const islemBilgisi = await pool.request()
      .input('SutID', sql.Int, sutId)
      .query(`
        SELECT TOP 1
          SutID,
          SutKodu,
          IslemAdi,
          Puan,
          AktifMi
        FROM SutIslemler
        WHERE SutID = @SutID
      `);

    return success(res, {
      islem: mevcutKayitData,
      suAnkiDurum: suAnkiDurum,
      suAnkiDurumAciklama: suAnkiDurumAciklama,
      ilkKayitTarihi: ilkKayitTarihi,
      yasamDongusu: yasamDongusu,
      toplamOlay: yasamDongusu.length
    }, 'SUT kodu yaşam döngüsü');
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
  getTarihselStats,
  getYasamDongusu
};

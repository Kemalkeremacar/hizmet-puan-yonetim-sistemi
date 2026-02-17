// ============================================
// EXTERNAL API CONTROLLER
// ============================================
// Dış servisler için HUV ve SUT listeleri
// Kural: Sadece 2 seviye kırılım (üst teminat, alt teminat, işlem)
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');

// ============================================
// GET /api/external/huv
// HUV listesi - 2 seviye kırılım
// Üst Teminat: AnaDal
// Alt Teminat: AnaDal (aynı)
// İşlem: HuvIslem
// ============================================
const getHuvList = async (req, res, next) => {
  try {
    const pool = await getPool();

    // Ana dalları al (üst teminat)
    const anaDallarResult = await pool.request().query(`
      SELECT 
        AnaDalKodu as UstTeminatKodu,
        BolumAdi as UstTeminatAdi,
        AnaDalKodu as AltTeminatKodu,
        BolumAdi as AltTeminatAdi
      FROM AnaDallar
      ORDER BY AnaDalKodu
    `);

    // Her ana dal için işlemleri al
    const result = [];
    
    for (const anaDal of anaDallarResult.recordset) {
      const islemlerResult = await pool.request()
        .input('anaDalKodu', sql.Int, anaDal.UstTeminatKodu)
        .query(`
          SELECT 
            IslemID,
            HuvKodu,
            IslemAdi,
            Birim,
            SutKodu,
            UstBaslik,
            HiyerarsiSeviyesi,
            [Not] as Notlar
          FROM HuvIslemler
          WHERE AnaDalKodu = @anaDalKodu AND AktifMi = 1
          ORDER BY HuvKodu
        `);

      result.push({
        ustTeminat: {
          kod: anaDal.UstTeminatKodu,
          adi: anaDal.UstTeminatAdi
        },
        altTeminat: {
          kod: anaDal.AltTeminatKodu,
          adi: anaDal.AltTeminatAdi
        },
        islemler: islemlerResult.recordset.map(islem => ({
          islemId: islem.IslemID,
          huvKodu: islem.HuvKodu,
          islemAdi: islem.IslemAdi,
          birim: islem.Birim,
          sutKodu: islem.SutKodu,
          ustBaslik: islem.UstBaslik,
          hiyerarsiSeviyesi: islem.HiyerarsiSeviyesi,
          notlar: islem.Notlar
        }))
      });
    }

    return success(res, {
      listeTipi: 'HUV',
      toplamUstTeminat: result.length,
      toplamIslem: result.reduce((sum, item) => sum + item.islemler.length, 0),
      data: result
    }, 'HUV listesi (2 seviye kırılım)');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/external/sut
// SUT listesi - 2 seviye kırılım
// Üst Teminat: Ana Başlık (Seviye 1)
// Alt Teminat: İlk alt seviye (Seviye 2) - yoksa Ana Başlık
// İşlem: SutIslem
// ============================================
const getSutList = async (req, res, next) => {
  try {
    const pool = await getPool();

    // Ana başlıkları al (üst teminat - Seviye 1)
    const anaBasliklarResult = await pool.request().query(`
      SELECT 
        ab.AnaBaslikNo,
        ab.AnaBaslikAdi,
        ab.HiyerarsiID
      FROM SutAnaBasliklar ab
      WHERE ab.AktifMi = 1
      ORDER BY ab.AnaBaslikNo
    `);

    const result = [];

    for (const anaBaslik of anaBasliklarResult.recordset) {
      // Bu ana başlığın ilk alt seviyesini bul (Seviye 2)
      // Eğer yoksa, ana başlığı alt teminat olarak kullan
      const altSeviyeResult = await pool.request()
        .input('parentID', sql.Int, anaBaslik.HiyerarsiID)
        .query(`
          SELECT TOP 1
            HiyerarsiID,
            Baslik,
            SeviyeNo
          FROM SutHiyerarsi
          WHERE ParentID = @parentID 
            AND SeviyeNo = 2 
            AND AktifMi = 1
          ORDER BY Sira
        `);

      // Alt seviye yoksa, ana başlığı alt teminat olarak kullan
      let altTeminat = {
        kod: anaBaslik.HiyerarsiID,
        adi: anaBaslik.AnaBaslikAdi
      };

      if (altSeviyeResult.recordset.length > 0) {
        altTeminat = {
          kod: altSeviyeResult.recordset[0].HiyerarsiID,
          adi: altSeviyeResult.recordset[0].Baslik
        };
      }

      // Bu alt teminata bağlı işlemleri al
      // KURAL: Sadece en yukarıdaki kırılımları al
      // Eğer alt teminatın altında başka seviyeler varsa, 
      // sadece en üstteki seviyeye bağlı işlemleri al
      
      let islemlerResult;
      
      // Alt teminatın altında başka seviyeler var mı?
      const altSeviyeVarMi = await pool.request()
        .input('parentID', sql.Int, altTeminat.kod)
        .query(`
          SELECT TOP 1
            HiyerarsiID,
            Baslik,
            SeviyeNo
          FROM SutHiyerarsi
          WHERE ParentID = @parentID AND AktifMi = 1
          ORDER BY SeviyeNo, Sira
        `);

      if (altSeviyeVarMi.recordset.length > 0) {
        // Alt teminatın altında başka seviyeler var
        // En üstteki seviyeye bağlı işlemleri al
        const enUstSeviyeID = altSeviyeVarMi.recordset[0].HiyerarsiID;
        
        islemlerResult = await pool.request()
          .input('hiyerarsiID', sql.Int, enUstSeviyeID)
          .query(`
            SELECT 
              s.SutID,
              s.SutKodu,
              s.IslemAdi,
              s.Puan,
              s.Aciklama
            FROM SutIslemler s
            WHERE s.HiyerarsiID = @hiyerarsiID AND s.AktifMi = 1
            ORDER BY s.SutKodu
          `);
      } else {
        // Alt teminata direkt bağlı işlemler
        islemlerResult = await pool.request()
          .input('hiyerarsiID', sql.Int, altTeminat.kod)
          .query(`
            SELECT 
              s.SutID,
              s.SutKodu,
              s.IslemAdi,
              s.Puan,
              s.Aciklama
            FROM SutIslemler s
            WHERE s.HiyerarsiID = @hiyerarsiID AND s.AktifMi = 1
            ORDER BY s.SutKodu
          `);
      }

      result.push({
        ustTeminat: {
          kod: anaBaslik.AnaBaslikNo,
          adi: anaBaslik.AnaBaslikAdi
        },
        altTeminat: {
          kod: altTeminat.kod,
          adi: altTeminat.adi
        },
        islemler: islemlerResult.recordset.map(islem => ({
          sutId: islem.SutID,
          sutKodu: islem.SutKodu,
          islemAdi: islem.IslemAdi,
          puan: islem.Puan,
          aciklama: islem.Aciklama
        }))
      });
    }

    return success(res, {
      listeTipi: 'SUT',
      toplamUstTeminat: result.length,
      toplamIslem: result.reduce((sum, item) => sum + item.islemler.length, 0),
      data: result
    }, 'SUT listesi (2 seviye kırılım)');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/external/huv/changes
// HUV listesi değişiklikleri (en son import)
// ============================================
const getHuvChanges = async (req, res, next) => {
  try {
    const pool = await getPool();

    // En son HUV import versiyonunu bul
    const lastVersionResult = await pool.request().query(`
      SELECT TOP 1
        VersionID,
        ListeTipi,
        YuklemeTarihi,
        DosyaAdi,
        KayitSayisi,
        EklenenSayisi,
        GuncellenenSayisi,
        SilinenSayisi,
        Aciklama,
        YukleyenKullanici,
        OlusturmaTarihi
      FROM ListeVersiyon
      WHERE ListeTipi = 'HUV'
      ORDER BY VersionID DESC
    `);

    if (lastVersionResult.recordset.length === 0) {
      return success(res, {
        listeTipi: 'HUV',
        versiyon: null,
        degisiklikler: {
          eklenenler: [],
          guncellenenler: [],
          silinenler: []
        },
        ozet: {
          eklenenSayisi: 0,
          guncellenenSayisi: 0,
          silinenSayisi: 0
        }
      }, 'Henüz import yapılmamış');
    }

    const lastVersion = lastVersionResult.recordset[0];
    const versionID = lastVersion.VersionID;

    // Eklenen işlemler
    const eklenenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          i.IslemID,
          i.HuvKodu,
          i.IslemAdi,
          i.Birim,
          a.BolumAdi as AnaDalAdi
        FROM HuvIslemler i
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        INNER JOIN IslemVersionlar v ON i.IslemID = v.IslemID AND v.ListeVersiyonID = @versionId
        WHERE v.DegisiklikSebebi IN ('Yeni işlem eklendi', 'Pasif işlem tekrar aktif edildi', 'Silinmiş işlem tekrar eklendi')
        ORDER BY i.HuvKodu
      `);

    // Güncellenen işlemler
    const guncellenenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          i.IslemID,
          i.HuvKodu,
          i.IslemAdi,
          i.Birim as YeniBirim,
          v_prev.Birim as EskiBirim,
          v_prev.IslemAdi as EskiIslemAdi,
          a.BolumAdi as AnaDalAdi
        FROM IslemVersionlar v_curr
        INNER JOIN HuvIslemler i ON v_curr.IslemID = i.IslemID
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        INNER JOIN IslemVersionlar v_prev ON v_curr.IslemID = v_prev.IslemID 
          AND v_prev.VersionID = (
            SELECT MAX(VersionID) 
            FROM IslemVersionlar 
            WHERE IslemID = v_curr.IslemID AND ListeVersiyonID < @versionId
          )
        WHERE v_curr.ListeVersiyonID = @versionId
        AND v_curr.DegisiklikSebebi = 'HUV listesi güncellendi'
        ORDER BY i.HuvKodu
      `);

    // Silinen işlemler (pasif yapılanlar)
    const silinenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          i.IslemID,
          i.HuvKodu,
          i.IslemAdi,
          i.Birim,
          a.BolumAdi as AnaDalAdi
        FROM IslemVersionlar v
        INNER JOIN HuvIslemler i ON v.IslemID = i.IslemID
        LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
        WHERE v.GecerlilikBitis IS NOT NULL
        AND v.GecerlilikBitis >= (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId)
        AND v.GecerlilikBitis < DATEADD(DAY, 1, (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId))
        AND NOT EXISTS (
          SELECT 1 FROM IslemVersionlar v2
          WHERE v2.IslemID = v.IslemID
          AND v2.ListeVersiyonID = @versionId
          AND v2.AktifMi = 1
        )
        ORDER BY i.HuvKodu
      `);

    return success(res, {
      listeTipi: 'HUV',
      versiyon: {
        versionId: lastVersion.VersionID,
        yuklemeTarihi: lastVersion.YuklemeTarihi,
        dosyaAdi: lastVersion.DosyaAdi,
        kayitSayisi: lastVersion.KayitSayisi,
        olusturmaTarihi: lastVersion.OlusturmaTarihi,
        yukleyenKullanici: lastVersion.YukleyenKullanici
      },
      degisiklikler: {
        eklenenler: eklenenlerResult.recordset.map(item => ({
          islemId: item.IslemID,
          huvKodu: item.HuvKodu,
          islemAdi: item.IslemAdi,
          birim: item.Birim,
          anaDalAdi: item.AnaDalAdi
        })),
        guncellenenler: guncellenenlerResult.recordset.map(item => ({
          islemId: item.IslemID,
          huvKodu: item.HuvKodu,
          islemAdi: item.IslemAdi,
          yeniBirim: item.YeniBirim,
          eskiBirim: item.EskiBirim,
          eskiIslemAdi: item.EskiIslemAdi,
          anaDalAdi: item.AnaDalAdi
        })),
        silinenler: silinenlerResult.recordset.map(item => ({
          islemId: item.IslemID,
          huvKodu: item.HuvKodu,
          islemAdi: item.IslemAdi,
          birim: item.Birim,
          anaDalAdi: item.AnaDalAdi
        }))
      },
      ozet: {
        eklenenSayisi: lastVersion.EklenenSayisi || eklenenlerResult.recordset.length,
        guncellenenSayisi: lastVersion.GuncellenenSayisi || guncellenenlerResult.recordset.length,
        silinenSayisi: lastVersion.SilinenSayisi || silinenlerResult.recordset.length
      }
    }, 
    (lastVersion.EklenenSayisi === 0 && lastVersion.GuncellenenSayisi === 0 && lastVersion.SilinenSayisi === 0)
      ? 'HUV değişiklikleri (en son import - değişiklik yok)'
      : 'HUV değişiklikleri (en son import)'
    );
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/external/sut/changes
// SUT listesi değişiklikleri (en son import)
// ============================================
const getSutChanges = async (req, res, next) => {
  try {
    const pool = await getPool();

    // En son SUT import versiyonunu bul
    const lastVersionResult = await pool.request().query(`
      SELECT TOP 1
        VersionID,
        ListeTipi,
        YuklemeTarihi,
        DosyaAdi,
        KayitSayisi,
        EklenenSayisi,
        GuncellenenSayisi,
        SilinenSayisi,
        Aciklama,
        YukleyenKullanici,
        OlusturmaTarihi
      FROM ListeVersiyon
      WHERE ListeTipi = 'SUT'
      ORDER BY VersionID DESC
    `);

    if (lastVersionResult.recordset.length === 0) {
      return success(res, {
        listeTipi: 'SUT',
        versiyon: null,
        degisiklikler: {
          eklenenler: [],
          guncellenenler: [],
          silinenler: []
        },
        ozet: {
          eklenenSayisi: 0,
          guncellenenSayisi: 0,
          silinenSayisi: 0
        }
      }, 'Henüz import yapılmamış');
    }

    const lastVersion = lastVersionResult.recordset[0];
    const versionID = lastVersion.VersionID;

    // Eklenen SUT işlemleri
    const eklenenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          s.SutID,
          s.SutKodu,
          s.IslemAdi,
          s.Puan,
          s.AnaBaslikNo
        FROM SutIslemler s
        INNER JOIN SutIslemVersionlar v ON s.SutID = v.SutID AND v.ListeVersiyonID = @versionId
        WHERE v.DegisiklikSebebi IN ('Yeni işlem eklendi', 'Pasif işlem tekrar aktif edildi', 'Silinmiş işlem tekrar eklendi')
        AND s.AktifMi = 1
        ORDER BY s.SutKodu
      `);

    // Güncellenen SUT işlemleri
    const guncellenenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          s.SutID,
          s.SutKodu,
          s.IslemAdi,
          s.Puan as YeniPuan,
          v_prev.Puan as EskiPuan,
          v_prev.IslemAdi as EskiIslemAdi,
          s.AnaBaslikNo
        FROM SutIslemVersionlar v_curr
        INNER JOIN SutIslemler s ON v_curr.SutID = s.SutID
        INNER JOIN SutIslemVersionlar v_prev ON v_curr.SutID = v_prev.SutID 
          AND v_prev.SutVersionID = (
            SELECT MAX(SutVersionID) 
            FROM SutIslemVersionlar 
            WHERE SutID = v_curr.SutID AND ListeVersiyonID < @versionId
          )
        WHERE v_curr.ListeVersiyonID = @versionId
        AND v_curr.DegisiklikSebebi = 'SUT listesi güncellendi'
        AND s.AktifMi = 1
        ORDER BY s.SutKodu
      `);

    // Silinen SUT işlemleri (pasif yapılanlar)
    const silinenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          s.SutID,
          s.SutKodu,
          s.IslemAdi,
          s.Puan,
          s.AnaBaslikNo
        FROM SutIslemVersionlar v
        INNER JOIN SutIslemler s ON v.SutID = s.SutID
        WHERE v.GecerlilikBitis IS NOT NULL
        AND v.GecerlilikBitis >= (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId)
        AND v.GecerlilikBitis < DATEADD(DAY, 1, (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId))
        AND NOT EXISTS (
          SELECT 1 FROM SutIslemVersionlar v2
          WHERE v2.SutID = v.SutID
          AND v2.ListeVersiyonID = @versionId
          AND v2.AktifMi = 1
        )
        ORDER BY s.SutKodu
      `);

    return success(res, {
      listeTipi: 'SUT',
      versiyon: {
        versionId: lastVersion.VersionID,
        yuklemeTarihi: lastVersion.YuklemeTarihi,
        dosyaAdi: lastVersion.DosyaAdi,
        kayitSayisi: lastVersion.KayitSayisi,
        olusturmaTarihi: lastVersion.OlusturmaTarihi,
        yukleyenKullanici: lastVersion.YukleyenKullanici
      },
      degisiklikler: {
        eklenenler: eklenenlerResult.recordset.map(item => ({
          sutId: item.SutID,
          sutKodu: item.SutKodu,
          islemAdi: item.IslemAdi,
          puan: item.Puan,
          anaBaslikNo: item.AnaBaslikNo
        })),
        guncellenenler: guncellenenlerResult.recordset.map(item => ({
          sutId: item.SutID,
          sutKodu: item.SutKodu,
          islemAdi: item.IslemAdi,
          yeniPuan: item.YeniPuan,
          eskiPuan: item.EskiPuan,
          eskiIslemAdi: item.EskiIslemAdi,
          anaBaslikNo: item.AnaBaslikNo
        })),
        silinenler: silinenlerResult.recordset.map(item => ({
          sutId: item.SutID,
          sutKodu: item.SutKodu,
          islemAdi: item.IslemAdi,
          puan: item.Puan,
          anaBaslikNo: item.AnaBaslikNo
        }))
      },
      ozet: {
        eklenenSayisi: lastVersion.EklenenSayisi || eklenenlerResult.recordset.length,
        guncellenenSayisi: lastVersion.GuncellenenSayisi || guncellenenlerResult.recordset.length,
        silinenSayisi: lastVersion.SilinenSayisi || silinenlerResult.recordset.length
      }
    }, 
    (lastVersion.EklenenSayisi === 0 && lastVersion.GuncellenenSayisi === 0 && lastVersion.SilinenSayisi === 0)
      ? 'SUT değişiklikleri (en son import - değişiklik yok)'
      : 'SUT değişiklikleri (en son import)'
    );
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/external/il-katsayi
// İl katsayıları listesi
// ============================================
const getIlKatsayiList = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        IlKatsayiID,
        IlAdi,
        PlakaKodu,
        Katsayi,
        DonemBaslangic,
        DonemBitis
      FROM IlKatsayilari
      WHERE AktifMi = 1
      ORDER BY IlAdi
    `);

    return success(res, {
      listeTipi: 'ILKATSAYI',
      toplamIl: result.recordset.length,
      data: result.recordset.map(item => ({
        ilKatsayiId: item.IlKatsayiID,
        ilAdi: item.IlAdi,
        plakaKodu: item.PlakaKodu,
        katsayi: item.Katsayi,
        donemBaslangic: item.DonemBaslangic,
        donemBitis: item.DonemBitis
      }))
    }, 'İl katsayıları listesi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/external/il-katsayi/changes
// İl katsayıları değişiklikleri (en son import)
// ============================================
const getIlKatsayiChanges = async (req, res, next) => {
  try {
    const pool = await getPool();

    // En son il katsayı import versiyonunu bul
    const lastVersionResult = await pool.request().query(`
      SELECT TOP 1
        VersionID,
        ListeTipi,
        YuklemeTarihi,
        DosyaAdi,
        KayitSayisi,
        EklenenSayisi,
        GuncellenenSayisi,
        SilinenSayisi,
        Aciklama,
        YukleyenKullanici,
        OlusturmaTarihi
      FROM ListeVersiyon
      WHERE ListeTipi = 'ILKATSAYI'
      ORDER BY VersionID DESC
    `);

    if (lastVersionResult.recordset.length === 0) {
      return success(res, {
        listeTipi: 'ILKATSAYI',
        versiyon: null,
        degisiklikler: {
          eklenenler: [],
          guncellenenler: [],
          silinenler: []
        },
        ozet: {
          eklenenSayisi: 0,
          guncellenenSayisi: 0,
          silinenSayisi: 0
        }
      }, 'Henüz import yapılmamış');
    }

    const lastVersion = lastVersionResult.recordset[0];
    const versionID = lastVersion.VersionID;

    // Eklenen il katsayıları
    const eklenenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          ik.IlKatsayiID,
          ik.IlAdi,
          ik.PlakaKodu,
          ik.Katsayi,
          ik.DonemBaslangic,
          ik.DonemBitis
        FROM IlKatsayilari ik
        INNER JOIN IlKatsayiVersionlar v ON ik.IlKatsayiID = v.IlKatsayiID AND v.ListeVersiyonID = @versionId
        WHERE v.DegisiklikSebebi IN ('Yeni il katsayısı eklendi', 'Pasif il katsayısı tekrar aktif edildi', 'Silinmiş il katsayısı tekrar eklendi')
        ORDER BY ik.IlAdi
      `);

    // Güncellenen il katsayıları
    const guncellenenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          ik.IlKatsayiID,
          ik.IlAdi,
          ik.PlakaKodu,
          ik.Katsayi as YeniKatsayi,
          v_prev.Katsayi as EskiKatsayi,
          ik.DonemBaslangic as YeniDonemBaslangic,
          v_prev.DonemBaslangic as EskiDonemBaslangic,
          ik.DonemBitis as YeniDonemBitis,
          v_prev.DonemBitis as EskiDonemBitis
        FROM IlKatsayiVersionlar v_curr
        INNER JOIN IlKatsayilari ik ON v_curr.IlKatsayiID = ik.IlKatsayiID
        INNER JOIN IlKatsayiVersionlar v_prev ON v_curr.IlKatsayiID = v_prev.IlKatsayiID 
          AND v_prev.VersionID = (
            SELECT MAX(VersionID) 
            FROM IlKatsayiVersionlar 
            WHERE IlKatsayiID = v_curr.IlKatsayiID AND ListeVersiyonID < @versionId
          )
        WHERE v_curr.ListeVersiyonID = @versionId
        AND v_curr.DegisiklikSebebi LIKE 'İl katsayısı güncellendi%'
        ORDER BY ik.IlAdi
      `);

    // Silinen il katsayıları (pasif yapılanlar)
    const silinenlerResult = await pool.request()
      .input('versionId', sql.Int, versionID)
      .query(`
        SELECT TOP 100
          ik.IlKatsayiID,
          ik.IlAdi,
          ik.PlakaKodu,
          ik.Katsayi,
          ik.DonemBaslangic,
          ik.DonemBitis
        FROM IlKatsayiVersionlar v
        INNER JOIN IlKatsayilari ik ON v.IlKatsayiID = ik.IlKatsayiID
        WHERE v.GecerlilikBitis IS NOT NULL
        AND v.GecerlilikBitis >= (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId)
        AND v.GecerlilikBitis < DATEADD(DAY, 1, (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId))
        AND v.DegisiklikSebebi = 'İl katsayısı silindi'
        ORDER BY ik.IlAdi
      `);

    return success(res, {
      listeTipi: 'ILKATSAYI',
      versiyon: {
        versionId: lastVersion.VersionID,
        yuklemeTarihi: lastVersion.YuklemeTarihi,
        dosyaAdi: lastVersion.DosyaAdi,
        kayitSayisi: lastVersion.KayitSayisi,
        olusturmaTarihi: lastVersion.OlusturmaTarihi,
        yukleyenKullanici: lastVersion.YukleyenKullanici
      },
      degisiklikler: {
        eklenenler: eklenenlerResult.recordset.map(item => ({
          ilKatsayiId: item.IlKatsayiID,
          ilAdi: item.IlAdi,
          plakaKodu: item.PlakaKodu,
          katsayi: item.Katsayi,
          donemBaslangic: item.DonemBaslangic,
          donemBitis: item.DonemBitis
        })),
        guncellenenler: guncellenenlerResult.recordset.map(item => ({
          ilKatsayiId: item.IlKatsayiID,
          ilAdi: item.IlAdi,
          plakaKodu: item.PlakaKodu,
          yeniKatsayi: item.YeniKatsayi,
          eskiKatsayi: item.EskiKatsayi,
          yeniDonemBaslangic: item.YeniDonemBaslangic,
          eskiDonemBaslangic: item.EskiDonemBaslangic,
          yeniDonemBitis: item.YeniDonemBitis,
          eskiDonemBitis: item.EskiDonemBitis
        })),
        silinenler: silinenlerResult.recordset.map(item => ({
          ilKatsayiId: item.IlKatsayiID,
          ilAdi: item.IlAdi,
          plakaKodu: item.PlakaKodu,
          katsayi: item.Katsayi,
          donemBaslangic: item.DonemBaslangic,
          donemBitis: item.DonemBitis
        }))
      },
      ozet: {
        eklenenSayisi: lastVersion.EklenenSayisi || eklenenlerResult.recordset.length,
        guncellenenSayisi: lastVersion.GuncellenenSayisi || guncellenenlerResult.recordset.length,
        silinenSayisi: lastVersion.SilinenSayisi || silinenlerResult.recordset.length
      }
    }, 
    (lastVersion.EklenenSayisi === 0 && lastVersion.GuncellenenSayisi === 0 && lastVersion.SilinenSayisi === 0)
      ? 'İl katsayıları değişiklikleri (en son import - değişiklik yok)'
      : 'İl katsayıları değişiklikleri (en son import)'
    );
  } catch (err) {
    next(err);
  }
};

// ============================================
// Teminat adını normalize et (eşleştirme için)
// ============================================
const normalizeTeminatAdi = (adi) => {
  if (!adi) return '';
  return adi
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Diacritics kaldır
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ıİ]/g, 'i')
    .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa çevir
    .replace(/[^\w\s]/g, '') // Özel karakterleri kaldır
    .trim();
};

// ============================================
// Özel eşleştirme kuralları
// ============================================
const getSpecialMapping = (sutTeminat, huvTeminat) => {
  const sutNorm = normalizeTeminatAdi(sutTeminat);
  const huvNorm = normalizeTeminatAdi(huvTeminat);
  
  // LABORATUVAR İŞLEMLERİ → LABORATUVAR İNCELEMELERİ
  if (sutNorm.includes('laboratuvar') && sutNorm.includes('islem') && 
      huvNorm.includes('laboratuvar') && huvNorm.includes('incelem')) {
    return 0.9; // Yüksek skor
  }
  
  // SUT numaralı yapıları (9.D. PATOLOJİ) → HUV harf grupları (B)
  // 9.D'deki D harfi → B harfi eşleştirmesi
  const sutHarfMatch = sutNorm.match(/(\d+)\.([a-z])\./);
  if (sutHarfMatch && huvNorm.length === 1) {
    const sutHarf = sutHarfMatch[2];
    const huvHarf = huvNorm[0];
    
    // Özel eşleştirmeler: 9.D → B, 9.A → A, 9.B → B, 9.C → CÇ, vb.
    const harfMapping = {
      'd': 'b', // 9.D. PATOLOJİ → B
      'a': 'a',
      'b': 'b',
      'c': 'cc', // 9.C → CÇ
      'e': 'e'
    };
    
    if (harfMapping[sutHarf] === huvHarf || harfMapping[sutHarf] === huvNorm) {
      return 0.95; // Çok yüksek skor
    }
  }
  
  // SUT numaralı yapılar (9.1, 9.2) → HUV harf grupları
  const sutNumaraMatch = sutNorm.match(/(\d+)\.(\d+)/);
  if (sutNumaraMatch && huvNorm.length <= 2) {
    // 9.1 → A, 9.2 → B gibi eşleştirmeler (genel kural)
    return 0.7;
  }
  
  // PATOLOJİ kelimesi içeren eşleştirmeler
  if (sutNorm.includes('patoloji') && huvNorm.includes('patoloji')) {
    return 0.85;
  }
  
  return null; // Özel kural yok
};

// ============================================
// String benzerlik skoru hesapla (Geliştirilmiş)
// ============================================
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  // Önce özel kuralları kontrol et
  const specialScore = getSpecialMapping(str1, str2);
  if (specialScore !== null) {
    return specialScore;
  }
  
  const s1 = normalizeTeminatAdi(str1);
  const s2 = normalizeTeminatAdi(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Kelime bazlı benzerlik
  const words1 = s1.split(/\s+/).filter(w => w.length > 0);
  const words2 = s2.split(/\s+/).filter(w => w.length > 0);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Ortak kelimeler
  const commonWords = words1.filter(w => words2.includes(w));
  const totalWords = Math.max(words1.length, words2.length);
  const wordSimilarity = commonWords.length / totalWords;
  
  // Anahtar kelime eşleştirmesi (daha yüksek ağırlık)
  const keywords1 = words1.filter(w => w.length > 3);
  const keywords2 = words2.filter(w => w.length > 3);
  const commonKeywords = keywords1.filter(w => keywords2.includes(w));
  const keywordSimilarity = keywords1.length > 0 && keywords2.length > 0
    ? commonKeywords.length / Math.max(keywords1.length, keywords2.length)
    : 0;
  
  // String benzerliği (Levenshtein benzeri basit versiyon)
  const maxLen = Math.max(s1.length, s2.length);
  let matches = 0;
  const minLen = Math.min(s1.length, s2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) matches++;
  }
  
  const charSimilarity = matches / maxLen;
  
  // Kombine skor (anahtar kelimeler daha önemli)
  return (keywordSimilarity * 0.5) + (wordSimilarity * 0.3) + (charSimilarity * 0.2);
};

// ============================================
// SUT işlemini en uygun HUV teminat grubuna eşleştir
// ============================================
const findBestHuvGroup = (sutUstTeminat, sutAltTeminat, huvGroups) => {
  let bestGroup = null;
  let bestScore = 0;
  
  for (const [key, group] of huvGroups.entries()) {
    // Sadece HUV gruplarını kontrol et
    if (group.huvIslemler.length === 0) continue;
    
    // Üst teminat benzerliği
    const ustSimilarity = calculateSimilarity(sutUstTeminat, group.ustTeminat.adi);
    
    // Alt teminat benzerliği
    const altSimilarity = calculateSimilarity(sutAltTeminat, group.altTeminat.adi);
    
    // Kombine skor (her ikisi de önemli)
    const combinedScore = (ustSimilarity * 0.5) + (altSimilarity * 0.5);
    
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestGroup = group;
    }
  }
  
  // Eşik değeri: En az %30 benzerlik olmalı
  if (bestScore >= 0.3) {
    return { group: bestGroup, score: bestScore };
  }
  
  return null;
};

// ============================================
// GET /api/external/birlesik
// Birleştirilmiş HUV + SUT listesi - Teminat bazlı eşleştirme
// Üst Teminat ve Alt Teminat kombinasyonuna göre gruplanmış
// Her grupta hem HUV hem SUT işlemleri bulunur
// 
// Eşleştirme Stratejisi:
// 1. Teminat adlarını normalize et (Türkçe karakter, boşluk, özel karakter)
// 2. Normalize edilmiş üst teminat + alt teminat kombinasyonuna göre eşleştir
// 3. Eşleşen teminatlar için hem HUV hem SUT işlemlerini birleştir
// 4. Eşleşmeyen teminatlar ayrı gruplar olarak gösterilir
// ============================================
const getBirlesikList = async (req, res, next) => {
  const startTime = Date.now();
  console.log('🔄 Birleşik liste isteği alındı');
  
  try {
    const pool = await getPool();
    console.log('✅ Database bağlantısı kuruldu');

    // 1. HUV listesini al (teminat bazlı)
    // Key: normalize edilmiş üst teminat adı + normalize edilmiş alt teminat adı
    const teminatGruplari = new Map(); // "normalizeKey" -> { ustTeminat, altTeminat, huvIslemler: [], sutIslemler: [] }
    
    const anaDallarResult = await pool.request().query(`
      SELECT 
        AnaDalKodu as UstTeminatKodu,
        BolumAdi as UstTeminatAdi,
        AnaDalKodu as AltTeminatKodu,
        BolumAdi as AltTeminatAdi
      FROM AnaDallar
      ORDER BY AnaDalKodu
    `);

    // HUV işlemlerini al - her işlemin kendi üst ve alt teminatı var
    console.log('📊 HUV işlemleri sorgulanıyor...');
    const huvIslemlerResult = await pool.request().query(`
      SELECT 
        i.IslemID,
        i.HuvKodu,
        i.IslemAdi,
        i.Birim,
        i.SutKodu,
        i.UstBaslik,
        i.HiyerarsiSeviyesi,
        i.[Not] as Notlar,
        i.AnaDalKodu,
        a.BolumAdi as AnaDalAdi
      FROM HuvIslemler i
      INNER JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
      WHERE i.AktifMi = 1
      ORDER BY i.HuvKodu
    `);
    console.log(`✅ ${huvIslemlerResult.recordset.length} HUV işlemi alındı`);

    // Her HUV işlemi için üst ve alt teminat bilgisi oluştur
    console.log('📊 HUV işlemleri gruplanıyor...');
    for (const islem of huvIslemlerResult.recordset) {
      // Üst teminat: AnaDal (GENEL CERRAHİ)
      const ustTeminat = {
        kod: islem.AnaDalKodu,
        adi: islem.AnaDalAdi,
        tip: 'HUV'
      };
      
      // Alt teminat: UstBaslik (FITIKLAR) - eğer yoksa AnaDal kullan
      const altTeminatAdi = islem.UstBaslik && islem.UstBaslik.trim() !== '' 
        ? islem.UstBaslik.trim() 
        : islem.AnaDalAdi;
      
      // Alt teminat adından "→" işaretinden sonrasını al (gösterim için)
      // Örnek: "KADIN HASTALIKLARI VE DOĞUM→ADNEKSLER/OVERLER" → "ADNEKSLER/OVERLER"
      const altTeminatAdiGosterim = altTeminatAdi.includes('→') 
        ? altTeminatAdi.split('→').pop().trim()
        : altTeminatAdi;
      
      const altTeminat = {
        kod: islem.AnaDalKodu, // Alt teminat için kod olarak AnaDalKodu kullanıyoruz
        adi: altTeminatAdi, // Orijinal ad (eşleştirme için)
        adiGosterim: altTeminatAdiGosterim, // Gösterim için temizlenmiş ad
        tip: 'HUV'
      };

      // Eşleştirme key'i: normalize edilmiş üst + alt teminat
      const normalizeUst = normalizeTeminatAdi(ustTeminat.adi);
      const normalizeAlt = normalizeTeminatAdi(altTeminat.adi);
      const teminatKey = `${normalizeUst}|||${normalizeAlt}`;

      // İşlem objesi
      const huvIslem = {
        islemId: islem.IslemID,
        huvKodu: islem.HuvKodu,
        islemAdi: islem.IslemAdi,
        birim: islem.Birim,
        sutKodu: islem.SutKodu ? islem.SutKodu.toString().trim() : null, // SUT kodu eşleştirmesi için
        ustBaslik: islem.UstBaslik,
        hiyerarsiSeviyesi: islem.HiyerarsiSeviyesi,
        notlar: islem.Notlar,
        ustTeminat: ustTeminat,
        altTeminat: altTeminat
      };

      if (teminatGruplari.has(teminatKey)) {
        // Mevcut gruba HUV işlemini ekle
        const mevcutGrup = teminatGruplari.get(teminatKey);
        mevcutGrup.huvIslemler.push(huvIslem);
      } else {
        // Yeni grup oluştur
        teminatGruplari.set(teminatKey, {
          ustTeminat: ustTeminat,
          altTeminat: altTeminat,
          huvIslemler: [huvIslem],
          sutIslemler: []
        });
      }
    }

    // 2. SUT listesini al (teminat bazlı)
    const anaBasliklarResult = await pool.request().query(`
      SELECT 
        ab.AnaBaslikNo,
        ab.AnaBaslikAdi,
        ab.HiyerarsiID
      FROM SutAnaBasliklar ab
      WHERE ab.AktifMi = 1
      ORDER BY ab.AnaBaslikNo
    `);

    // Önce tüm hiyerarşiyi çek (cache için)
    const hiyerarsiMap = new Map();
    const hiyerarsiResult = await pool.request().query(`
      SELECT HiyerarsiID, ParentID, Baslik, SeviyeNo
      FROM SutHiyerarsi
      WHERE AktifMi = 1
    `);
    
    hiyerarsiResult.recordset.forEach(h => {
      hiyerarsiMap.set(h.HiyerarsiID, {
        parentID: h.ParentID,
        baslik: h.Baslik,
        seviyeNo: h.SeviyeNo
      });
    });

    // Seviye 2 parent bulma fonksiyonu
    const findSeviye2Parent = (hiyerarsiID) => {
      if (!hiyerarsiID) return null;
      
      let currentID = hiyerarsiID;
      let visited = new Set();
      
      // Yukarı doğru çık, Seviye 2 olanı bul
      while (currentID && !visited.has(currentID)) {
        visited.add(currentID);
        const node = hiyerarsiMap.get(currentID);
        
        if (!node) break;
        
        // Seviye 2 bulundu
        if (node.seviyeNo === 2) {
          return {
            kod: currentID,
            adi: node.baslik
          };
        }
        
        // Parent'a geç
        currentID = node.parentID;
      }
      
      return null;
    };

    // SUT işlemlerini al
    console.log('📊 SUT işlemleri sorgulanıyor...');
    const sutIslemlerResult = await pool.request().query(`
      SELECT 
        s.SutID,
        s.SutKodu,
        s.IslemAdi,
        s.Puan,
        s.Aciklama,
        s.HiyerarsiID,
        s.AnaBaslikNo,
        ab.AnaBaslikAdi,
        ab.HiyerarsiID as AnaBaslikHiyerarsiID
      FROM SutIslemler s
      INNER JOIN SutAnaBasliklar ab ON s.AnaBaslikNo = ab.AnaBaslikNo
      WHERE s.AktifMi = 1
      ORDER BY s.SutKodu
    `);
    console.log(`✅ ${sutIslemlerResult.recordset.length} SUT işlemi alındı`);

    // Önce HUV işlemlerindeki SUT kodlarını bir Map'e al (hızlı arama için)
    const huvSutKoduMap = new Map(); // SUT kodu -> HUV grup key
    for (const [key, group] of teminatGruplari.entries()) {
      for (const huvIslem of group.huvIslemler) {
        if (huvIslem.sutKodu && huvIslem.sutKodu.trim() !== '') {
          const sutKoduNorm = huvIslem.sutKodu.trim();
          if (!huvSutKoduMap.has(sutKoduNorm)) {
            huvSutKoduMap.set(sutKoduNorm, []);
          }
          huvSutKoduMap.get(sutKoduNorm).push(key);
        }
      }
    }

    // Her SUT işlemini en uygun HUV teminat grubuna eşleştir
    let eslesmeyenSutIslemler = 0;
    let sutKoduEslestirme = 0; // SUT kodu ile eşleştirilen işlem sayısı
    
    const toplamSutIslem = sutIslemlerResult.recordset.length;
    console.log(`📊 ${toplamSutIslem} SUT işlemi eşleştirilecek`);
    let islenenSutIslem = 0;
    const logInterval = Math.max(1, Math.floor(toplamSutIslem / 10)); // Her %10'da bir log
    
    for (const islem of sutIslemlerResult.recordset) {
      islenenSutIslem++;
      if (islenenSutIslem % logInterval === 0 || islenenSutIslem === toplamSutIslem) {
        const progress = ((islenenSutIslem / toplamSutIslem) * 100).toFixed(1);
        console.log(`⏳ SUT eşleştirme: ${islenenSutIslem}/${toplamSutIslem} (${progress}%)`);
      }
      // SUT'in kendi teminat bilgisi (orijinal)
      const sutUstTeminat = islem.AnaBaslikAdi;
      const seviye2Parent = findSeviye2Parent(islem.HiyerarsiID);
      const sutAltTeminat = seviye2Parent ? seviye2Parent.adi : islem.AnaBaslikAdi;

      // ÖNCE: SUT kodu ile direkt eşleştirme yap
      let bestGroup = null;
      let bestScore = 0;
      let eslestirmeTipi = 'benzerlik'; // 'sutKodu' veya 'benzerlik'
      
      const sutKoduNorm = islem.SutKodu.trim();
      if (huvSutKoduMap.has(sutKoduNorm)) {
        // SUT kodu ile eşleşen HUV grupları var
        const eslesenGruplar = huvSutKoduMap.get(sutKoduNorm);
        
        // İlk eşleşen grubu kullan (genellikle tek grup olur)
        if (eslesenGruplar.length > 0) {
          const grupKey = eslesenGruplar[0];
          bestGroup = teminatGruplari.get(grupKey);
          bestScore = 1.0; // SUT kodu eşleştirmesi mükemmel skor
          eslestirmeTipi = 'sutKodu';
          sutKoduEslestirme++;
        }
      }
      
      // Eğer SUT kodu ile eşleştirme yoksa, benzerlik skoru ile eşleştir
      if (!bestGroup) {
        // Performans: Sadece HUV işlemi olan grupları önceden filtrele
        const huvGruplari = Array.from(teminatGruplari.entries()).filter(([_, group]) => group.huvIslemler.length > 0);
        
        for (const [key, group] of huvGruplari) {
        
        // Üst teminat benzerliği
        const ustSimilarity = calculateSimilarity(sutUstTeminat, group.ustTeminat.adi);
        
        // Alt teminat benzerliği (daha önemli - özel kurallar burada devreye girer)
        const altSimilarity = calculateSimilarity(sutAltTeminat, group.altTeminat.adi);
        
        // Özel durum: Tüm SUT üst teminatları için özel eşleştirme kuralları
        let altSimilarityBoost = 0;
        let useSpecialRule = false;
        
        const sutUstNorm = normalizeTeminatAdi(sutUstTeminat);
        const huvUstNorm = normalizeTeminatAdi(group.ustTeminat.adi);
        const sutAltNorm = normalizeTeminatAdi(sutAltTeminat);
        const huvAltGosterim = group.altTeminat.adi.includes('→')
          ? group.altTeminat.adi.split('→').pop().trim()
          : group.altTeminat.adi;
        const huvAltGosterimNorm = normalizeTeminatAdi(huvAltGosterim);
        
        // 1. RADYOLOJİK GÖRÜNTÜLEME VE TEDAVİ → RADYOLOJİ eşleştirmesi
        if ((sutUstNorm.includes('radyolojik') || sutUstNorm.includes('radyoloji')) && 
            huvUstNorm.includes('radyoloji')) {
          
          const sutAltNorm = normalizeTeminatAdi(sutAltTeminat);
          const huvAltNorm = normalizeTeminatAdi(group.altTeminat.adi);
          const huvAltGosterim = group.altTeminat.adi.includes('→')
            ? group.altTeminat.adi.split('→').pop().trim()
            : group.altTeminat.adi;
          const huvAltGosterimNorm = normalizeTeminatAdi(huvAltGosterim);
          
          // SUT: "BT Anjiyografiler" → HUV: "ANJİYOGRAFİK İNCELEMELER"
          if (sutAltNorm.includes('bt') && sutAltNorm.includes('anjiyografi') && 
              huvAltGosterimNorm.includes('anjiyografik')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "BT Artrografiler" → HUV: "BİLGİSAYARLI TOMOGRAFİ (BT)"
          else if (sutAltNorm.includes('bt') && sutAltNorm.includes('artrografi') && 
                   (huvAltGosterimNorm.includes('tomografi') || huvAltGosterimNorm.includes('bt'))) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "BT Ekstremiteler ve İlgili Eklemler" → HUV: "BİLGİSAYARLI TOMOGRAFİ (BT)" veya "MULTİDEDEKTÖR VEYA SPİRAL BT CİHAZI İLE"
          else if (sutAltNorm.includes('bt') && (sutAltNorm.includes('ekstremite') || sutAltNorm.includes('eklem')) && 
                   (huvAltGosterimNorm.includes('tomografi') || huvAltGosterimNorm.includes('bt') || huvAltGosterimNorm.includes('multidedektor') || huvAltGosterimNorm.includes('spiral'))) {
            altSimilarityBoost = 1.4;
            useSpecialRule = true;
          }
          // SUT: "BT Kılavuzluğunda Girişimsel İşlemler" → HUV: "GİRİŞİMSEL RADYOLOJİK İŞLEMLER" veya "NONVASKÜLER GİRİŞİMSEL RADYOLOJİK İŞLEMLER"
          else if (sutAltNorm.includes('bt') && sutAltNorm.includes('girisimsel') && 
                   (huvAltGosterimNorm.includes('girisimsel') || huvAltGosterimNorm.includes('nonvaskuler'))) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "MRG Anjiyografiler" → HUV: "ANJİYOGRAFİK İNCELEMELER" veya "MANYETİK REZONANS GÖRÜNTÜLEME (MR/MRG)"
          else if ((sutAltNorm.includes('mrg') || sutAltNorm.includes('mr')) && sutAltNorm.includes('anjiyografi') && 
                   (huvAltGosterimNorm.includes('anjiyografik') || huvAltGosterimNorm.includes('rezonans'))) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "MRG Artrografiler" → HUV: "MANYETİK REZONANS GÖRÜNTÜLEME (MR/MRG)"
          else if ((sutAltNorm.includes('mrg') || sutAltNorm.includes('mr')) && sutAltNorm.includes('artrografi') && 
                   huvAltGosterimNorm.includes('rezonans')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "MRG Ekstremiteler ve İlgili Eklemler" → HUV: "MANYETİK REZONANS GÖRÜNTÜLEME (MR/MRG)"
          else if ((sutAltNorm.includes('mrg') || sutAltNorm.includes('mr')) && 
                   (sutAltNorm.includes('ekstremite') || sutAltNorm.includes('eklem')) && 
                   huvAltGosterimNorm.includes('rezonans')) {
            altSimilarityBoost = 1.4;
            useSpecialRule = true;
          }
          // SUT: "MRG Kılavuzluğunda Girişimsel İşlemler" → HUV: "GİRİŞİMSEL RADYOLOJİK İŞLEMLER" veya "NONVASKÜLER GİRİŞİMSEL RADYOLOJİK İŞLEMLER"
          else if ((sutAltNorm.includes('mrg') || sutAltNorm.includes('mr')) && sutAltNorm.includes('girisimsel') && 
                   (huvAltGosterimNorm.includes('girisimsel') || huvAltGosterimNorm.includes('nonvaskuler'))) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "RADYOLOJİK GÖRÜNTÜLEME VE TEDAVİ" (genel) → HUV: "RADYOLOJİ" (genel)
          else if (sutAltNorm === normalizeTeminatAdi(sutUstTeminat) && 
                   huvAltGosterimNorm === normalizeTeminatAdi(group.ustTeminat.adi)) {
            altSimilarityBoost = 1.2;
            useSpecialRule = true;
          }
          // Genel BT eşleştirmeleri
          else if (sutAltNorm.includes('bt') && (huvAltGosterimNorm.includes('tomografi') || huvAltGosterimNorm.includes('bt'))) {
            altSimilarityBoost = 1.3;
            useSpecialRule = true;
          }
          // Genel MRG eşleştirmeleri
          else if ((sutAltNorm.includes('mrg') || sutAltNorm.includes('mr')) && huvAltGosterimNorm.includes('rezonans')) {
            altSimilarityBoost = 1.3;
            useSpecialRule = true;
          }
        }
        
        // 2. TIBBİ UYGULAMALAR → TIBBİ PATOLOJİ, TIBBİ GENETİK, İÇ HASTALIKLARI, DERMATOLOJİ, KARDİYOLOJİ, vb.
        if (!useSpecialRule && sutUstNorm.includes('tibbi') && sutUstNorm.includes('uygulama')) {
          // SUT: "7.1. DERMİS VE EPİDERMİS" → HUV: "DERMATOLOJİ"
          if (sutAltNorm.match(/7\.1/) && huvUstNorm.includes('dermatoloji')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.2. KARDİYOVASKÜLER SİSTEM" → HUV: "KARDİYOLOJİ"
          else if (sutAltNorm.match(/7\.2/) && huvUstNorm.includes('kardiyoloji')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.3. SOLUNUM SİSTEMİ" → HUV: "GÖĞÜS HASTALIKLARI"
          else if (sutAltNorm.match(/7\.3/) && huvUstNorm.includes('gogus')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.4. SİNDİRİM SİSTEMİ" → HUV: "İÇ HASTALIKLARI"
          else if (sutAltNorm.match(/7\.4/) && huvUstNorm.includes('ic hastaliklari')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.8. GÖZ VE ADNEKSLERİ" → HUV: "GÖZ HASTALIKLARI"
          else if (sutAltNorm.match(/7\.8/) && huvUstNorm.includes('goz')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.9. SES VE İŞİTME" → HUV: "KULAK-BURUN-BOĞAZ HASTALIKLARI"
          else if (sutAltNorm.match(/7\.9/) && (huvUstNorm.includes('kulak') || huvUstNorm.includes('kbb'))) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.10. ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ" → HUV: "İÇ HASTALIKLARI"
          else if (sutAltNorm.match(/7\.10/) && huvUstNorm.includes('ic hastaliklari')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // SUT: "7.12. HEMATOLOJİ-ONKOLOJİ-KEMOTERAPİ" → HUV: "İÇ HASTALIKLARI" veya "TIBBİ PATOLOJİ"
          else if (sutAltNorm.match(/7\.12/) && (huvUstNorm.includes('ic hastaliklari') || huvUstNorm.includes('tibbi patoloji'))) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // Genel TIBBİ UYGULAMALAR → İÇ HASTALIKLARI veya TIBBİ PATOLOJİ
          else if (sutAltNorm === normalizeTeminatAdi(sutUstTeminat) && 
                   (huvUstNorm.includes('ic hastaliklari') || huvUstNorm.includes('tibbi patoloji') || 
                    huvUstNorm.includes('tibbi genetik') || huvUstNorm.includes('dermatoloji') ||
                    huvUstNorm.includes('kardiyoloji') || huvUstNorm.includes('nöroloji'))) {
            altSimilarityBoost = 1.2;
            useSpecialRule = true;
          }
        }
        
        // 3. LABORATUVAR İŞLEMLERİ → LABORATUVAR İNCELEMELERİ
        if (!useSpecialRule && sutUstNorm.includes('laboratuvar') && huvUstNorm.includes('laboratuvar')) {
          // HUV alt teminatından harf çıkar (LABORATUVAR İNCELEMELERİ→B → B)
          const huvAltHarf = group.altTeminat.adi.match(/→([A-ZÇĞİÖŞÜ]+)$/);
          const huvHarf = huvAltHarf ? normalizeTeminatAdi(huvAltHarf[1]) : null;
          
          // 9.1. BİYOKİMYA → A eşleştirmesi
          if (sutAltNorm.match(/9\.1/) && huvHarf === 'a') {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // 9.2. YASADIŞI → B eşleştirmesi
          else if (sutAltNorm.match(/9\.2/) && huvHarf === 'b') {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // 9.A. MOLEKÜLER MİKROBİYOLOJİ → A eşleştirmesi
          else if (sutAltNorm.match(/9\.a/) && huvHarf === 'a') {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // 9.B. SİTOGENETİK → B eşleştirmesi
          else if (sutAltNorm.match(/9\.b/) && huvHarf === 'b') {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // 9.C. MOLEKÜLER GENETİK → CÇ eşleştirmesi
          else if (sutAltNorm.match(/9\.c/) && (huvHarf === 'cc' || huvHarf === 'c')) {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // 9.D. PATOLOJİ → B eşleştirmesi (özel kural - ÇOK YÜKSEK ÖNCELİK)
          else if (sutAltNorm.match(/9\.d/) && huvHarf === 'b') {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // 9.E. MESLEK HASTALIKLARI → E eşleştirmesi
          else if (sutAltNorm.match(/9\.e/) && huvHarf === 'e') {
            altSimilarityBoost = 1.5;
            useSpecialRule = true;
          }
          // MİKROBİYOLOJİ → A veya genel LABORATUVAR İNCELEMELERİ
          else if (sutAltNorm.includes('mikrobiyoloji') && (huvHarf === 'a' || huvAltGosterimNorm === normalizeTeminatAdi('LABORATUVAR İNCELEMELERİ'))) {
            altSimilarityBoost = 1.4;
            useSpecialRule = true;
          }
          // PATOLOJİ → B (genel kural - PATOLOJİ içeren SUT alt teminatı B grubuna gider)
          else if (sutAltNorm.includes('patoloji') && huvHarf === 'b') {
            altSimilarityBoost = 1.2;
            useSpecialRule = true;
          }
          // Diğer numaralı yapılar (9.A → A, 9.B → B, 9.C → CÇ, vb.)
          else if (sutAltNorm.match(/9\.([a-z])/)) {
            const sutHarf = sutAltNorm.match(/9\.([a-z])/)[1];
            // Özel eşleştirmeler
            const harfMapping = {
              'd': 'b', // 9.D → B
              'a': 'a',
              'b': 'b',
              'c': 'cc', // 9.C → CÇ
              'e': 'e'
            };
            if (harfMapping[sutHarf] === huvHarf) {
              altSimilarityBoost = 1.3;
              useSpecialRule = true;
            }
          }
        }
        
        // 4. ACİL SERVİSTE YAPILAN UYGULAMALAR → ACİL TIP
        if (!useSpecialRule && sutUstNorm.includes('acil') && huvUstNorm.includes('acil')) {
          altSimilarityBoost = 1.3;
          useSpecialRule = true;
        }
        
        // 5. ANESTEZİ VE REANİMASYON → ANESTEZİYOLOJİ VE REANİMASYON
        if (!useSpecialRule && sutUstNorm.includes('anestezi') && huvUstNorm.includes('anestezi')) {
          altSimilarityBoost = 1.4;
          useSpecialRule = true;
        }
        
        // 6. CERRAHİ UYGULAMALAR → GENEL CERRAHİ, ÇOCUK CERRAHİSİ, vb.
        if (!useSpecialRule && sutUstNorm.includes('cerrahi') && huvUstNorm.includes('cerrahi')) {
          altSimilarityBoost = 1.3;
          useSpecialRule = true;
        }
        
        // 7. HEKİM MUAYENELERİ VE RAPORLAR → MUAYENE
        if (!useSpecialRule && sutUstNorm.includes('muayene') && huvUstNorm.includes('muayene')) {
          altSimilarityBoost = 1.3;
          useSpecialRule = true;
        }
        
        // Kombine skor
        // Özel kural varsa: alt teminat çok daha önemli (%80), üst teminat %20
        // Normal durumda: alt teminat %60, üst teminat %40
        const altWeight = useSpecialRule ? 0.8 : 0.6;
        const ustWeight = useSpecialRule ? 0.2 : 0.4;
        const combinedScore = (ustSimilarity * ustWeight) + (altSimilarity * altWeight) + altSimilarityBoost;
        
        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestGroup = group;
        }
        }
      }
      
      // İşlem objesi (SUT'in orijinal teminat bilgisi ile)
      const sutIslem = {
        sutId: islem.SutID,
        sutKodu: islem.SutKodu,
        islemAdi: islem.IslemAdi,
        puan: islem.Puan,
        aciklama: islem.Aciklama,
        sutUstTeminat: {
          kod: islem.AnaBaslikNo,
          adi: sutUstTeminat,
          tip: 'SUT'
        },
        sutAltTeminat: {
          kod: seviye2Parent ? seviye2Parent.kod : (islem.AnaBaslikHiyerarsiID || islem.AnaBaslikNo),
          adi: sutAltTeminat,
          tip: 'SUT'
        },
        eslestirmeSkoru: bestScore,
        eslestirmeTipi: eslestirmeTipi // 'sutKodu' veya 'benzerlik'
      };

      if (bestGroup) {
        // En uygun HUV grubuna ekle
        bestGroup.sutIslemler.push(sutIslem);
      } else {
        // Hiç HUV grubu yoksa (olması gerekmez ama güvenlik için)
        eslesmeyenSutIslemler++;
      }
    }

    // 3. Sonuçları formatla
    const result = Array.from(teminatGruplari.values()).map(grup => {
      // Alt teminat gösterimini düzelt: "→" işaretinden sonrasını al
      const altTeminatGosterim = grup.altTeminat.adi.includes('→')
        ? grup.altTeminat.adi.split('→').pop().trim()
        : grup.altTeminat.adi;
      
      return {
        ustTeminat: grup.ustTeminat,
        altTeminat: {
          ...grup.altTeminat,
          adi: altTeminatGosterim // Gösterim için temizlenmiş ad
        },
        huvIslemler: grup.huvIslemler,
        sutIslemler: grup.sutIslemler,
        toplamHuvIslem: grup.huvIslemler.length,
        toplamSutIslem: grup.sutIslemler.length,
        toplamIslem: grup.huvIslemler.length + grup.sutIslemler.length
      };
    });

    // İstatistikler
    const birlesikGruplar = result.filter(g => g.toplamHuvIslem > 0 && g.toplamSutIslem > 0).length;
    const sadeceHuvGruplar = result.filter(g => g.toplamHuvIslem > 0 && g.toplamSutIslem === 0).length;
    const sadeceSutGruplar = result.filter(g => g.toplamHuvIslem === 0 && g.toplamSutIslem > 0).length;

    const duration = Date.now() - startTime;
    console.log(`✅ Birleşik liste hazırlandı (${duration}ms)`);
    console.log(`📊 İstatistikler: ${result.length} grup, ${result.reduce((sum, item) => sum + item.toplamHuvIslem, 0)} HUV, ${result.reduce((sum, item) => sum + item.toplamSutIslem, 0)} SUT`);

    return success(res, {
      listeTipi: 'BIRLESIK',
      aciklama: 'HUV ve SUT listeleri birleştirilmiş. Her SUT işlemi, teminat bilgisine göre (benzerlik skoru ile) en uygun HUV teminat grubuna eşleştirilir. Tüm SUT işlemleri mutlaka bir HUV grubuna dahil edilir.',
      toplamGrup: result.length,
      birlesikGrup: birlesikGruplar,
      sadeceHuvGrup: sadeceHuvGruplar,
      sadeceSutGrup: sadeceSutGruplar,
      eslesmeyenSutIslem: eslesmeyenSutIslemler,
      sutKoduEslestirme: sutKoduEslestirme, // SUT kodu ile direkt eşleştirilen işlem sayısı
      toplamHuvIslem: result.reduce((sum, item) => sum + item.toplamHuvIslem, 0),
      toplamSutIslem: result.reduce((sum, item) => sum + item.toplamSutIslem, 0),
      toplamIslem: result.reduce((sum, item) => sum + item.toplamIslem, 0),
      data: result
    }, 'Birleştirilmiş HUV + SUT listesi (SUT işlemleri HUV gruplarına eşleştirilmiş)');
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Birleşik liste hatası (${duration}ms):`, err.message);
    console.error(err.stack);
    next(err);
  }
};


module.exports = {
  getHuvList,
  getSutList,
  getHuvChanges,
  getSutChanges,
  getIlKatsayiList,
  getIlKatsayiChanges,
  getBirlesikList
};

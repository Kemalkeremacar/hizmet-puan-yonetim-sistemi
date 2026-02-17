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

module.exports = {
  getHuvList,
  getSutList,
  getHuvChanges,
  getSutChanges,
  getIlKatsayiList,
  getIlKatsayiChanges
};

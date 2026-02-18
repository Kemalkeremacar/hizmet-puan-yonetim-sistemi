// ============================================
// EXTERNAL API CONTROLLER
// ============================================
// Dış servisler için HUV ve SUT listeleri
// Kural: Sadece 2 seviye kırılım (üst teminat, alt teminat, işlem)
// ============================================

const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const cache = require('../utils/cache');

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

    // ============================================
    // OPTİMİZASYON: N+1 Query Problemi Çözüldü
    // ============================================
    // Tüm veriyi tek seferde çek, JS tarafında grupla
    // "DB pahalıdır, JS ucuzdur" prensibi
    // ÖNCE: 100 ana başlık × 3 sorgu = 300 sorgu
    // SONRA: 3 sorgu (tüm veri)
    
    // 1. Tüm hiyerarşi yapısını tek seferde çek
    const hiyerarsiResult = await pool.request().query(`
      SELECT 
        ab.AnaBaslikNo,
        ab.AnaBaslikAdi,
        ab.HiyerarsiID as AnaBaslikID,
        h2.HiyerarsiID as AltSeviyeID,
        h2.Baslik as AltSeviyeAdi,
        h2.SeviyeNo as AltSeviyeSeviye,
        h3.HiyerarsiID as EnUstSeviyeID,
        h3.Baslik as EnUstSeviyeAdi
      FROM SutAnaBasliklar ab
      LEFT JOIN SutHiyerarsi h2 ON h2.ParentID = ab.HiyerarsiID 
        AND h2.SeviyeNo = 2 
        AND h2.AktifMi = 1
        AND h2.HiyerarsiID = (
          SELECT TOP 1 HiyerarsiID
          FROM SutHiyerarsi
          WHERE ParentID = ab.HiyerarsiID AND SeviyeNo = 2 AND AktifMi = 1
          ORDER BY Sira
        )
      LEFT JOIN SutHiyerarsi h3 ON h3.ParentID = COALESCE(h2.HiyerarsiID, ab.HiyerarsiID)
        AND h3.AktifMi = 1
        AND h3.SeviyeNo > COALESCE(h2.SeviyeNo, 1)
        AND h3.HiyerarsiID = (
          SELECT TOP 1 HiyerarsiID
          FROM SutHiyerarsi
          WHERE ParentID = COALESCE(h2.HiyerarsiID, ab.HiyerarsiID)
            AND AktifMi = 1
            AND SeviyeNo > COALESCE(h2.SeviyeNo, 1)
          ORDER BY SeviyeNo, Sira
        )
      WHERE ab.AktifMi = 1
      ORDER BY ab.AnaBaslikNo
    `);

    // 2. Tüm SUT işlemlerini tek seferde çek
    const sutIslemlerResult = await pool.request().query(`
      SELECT 
        s.SutID,
        s.SutKodu,
        s.IslemAdi,
        s.Puan,
        s.Aciklama,
        s.HiyerarsiID
      FROM SutIslemler s
      WHERE s.AktifMi = 1
      ORDER BY s.SutKodu
    `);

    // 3. İşlemleri HiyerarsiID'ye göre Map'e al (hızlı erişim için)
    const islemlerByHiyerarsiID = new Map();
    for (const islem of sutIslemlerResult.recordset) {
      const hiyerarsiID = islem.HiyerarsiID;
      if (!islemlerByHiyerarsiID.has(hiyerarsiID)) {
        islemlerByHiyerarsiID.set(hiyerarsiID, []);
      }
      islemlerByHiyerarsiID.get(hiyerarsiID).push({
        sutId: islem.SutID,
        sutKodu: islem.SutKodu,
        islemAdi: islem.IslemAdi,
        puan: islem.Puan,
        aciklama: islem.Aciklama
      });
    }

    // 4. JS tarafında grupla
    const result = [];
    for (const row of hiyerarsiResult.recordset) {
      // Alt teminat belirleme
      const altTeminat = {
        kod: row.AltSeviyeID || row.AnaBaslikID,
        adi: row.AltSeviyeAdi || row.AnaBaslikAdi
      };

      // İşlem HiyerarsiID: En üst seviye varsa onu kullan, yoksa alt seviye veya ana başlık
      const islemHiyerarsiID = row.EnUstSeviyeID || row.AltSeviyeID || row.AnaBaslikID;

      // İşlemleri Map'ten al
      const islemler = islemlerByHiyerarsiID.get(islemHiyerarsiID) || [];

      result.push({
        ustTeminat: {
          kod: row.AnaBaslikNo,
          adi: row.AnaBaslikAdi
        },
        altTeminat: altTeminat,
        islemler: islemler
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
  
  // Kombine skor (anahtar kelimeler daha önemli, char similarity ağırlığı düşürüldü)
  // ÖNCE: keyword: 0.5, word: 0.3, char: 0.2
  // SONRA: keyword: 0.6, word: 0.3, char: 0.1 (char similarity sadece prefix benzerliği, yanıltıcı)
  return (keywordSimilarity * 0.6) + (wordSimilarity * 0.3) + (charSimilarity * 0.1);
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
  
  // Cache kontrolü
  const cacheKey = 'birlesik_liste';
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log('✅ Cache\'den döndürülüyor');
    return success(res, cachedData, 'Birleştirilmiş HUV + SUT listesi (Cache)');
  }
  
  try {
    const pool = await getPool();
    console.log('✅ Database bağlantısı kuruldu');

    // Düşük güven (0.3-0.5) eşleşmeleri için özet sayaç
    // Tek tek log basmak terminali boğuyor; özetlemek daha faydalı.
    const lowConfidenceAgg = new Map(); // key -> { count, sample }

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
      
      // Alt teminat kodu: Synthetic key (collision önleme)
      // ÖNCE: AnaDalKodu (aynı ana dal altında farklı UstBaslik'ler aynı kodu paylaşıyordu)
      // SONRA: AnaDalKodu + normalize edilmiş alt teminat adı
      const altTeminatKod = `${islem.AnaDalKodu}_${normalizeTeminatAdi(altTeminatAdi)}`;
      
      const altTeminat = {
        kod: altTeminatKod, // Synthetic key: collision önleme
        anaDalKodu: islem.AnaDalKodu, // Orijinal AnaDalKodu (referans için)
        adi: altTeminatAdi, // Orijinal ad (eşleştirme için)
        adiGosterim: altTeminatAdiGosterim, // Gösterim için temizlenmiş ad
        tip: 'HUV'
      };

      // Eşleştirme key'i: normalize edilmiş üst + alt teminat + kod kontrolü (collision önleme)
      // ÖNCE: Sadece normalize edilmiş string (collision riski)
      // SONRA: Normalize string + kod kontrolü
      const normalizeUst = normalizeTeminatAdi(ustTeminat.adi);
      const normalizeAlt = normalizeTeminatAdi(altTeminat.adi);
      const teminatKey = `${normalizeUst}|||${normalizeAlt}|||${ustTeminat.kod}|||${altTeminat.kod}`;

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

    // ============================================
    // Manuel Yerleştirmeler (Doktor) - OVERRIDE
    // ============================================
    // Not: Manuel düzenlemeler birleşik listede ANINDA uygulanmalı.
    console.log('📊 Manuel yerleştirmeler sorgulanıyor...');
    const manuelOverrideBySutId = new Map(); // SutID -> { yeniUstKod, yeniAltKod, not, tarih }
    try {
      const manuelResult = await pool.request().query(`
        WITH ranked AS (
          SELECT
            DuzenlemeID,
            SutID,
            SutKodu,
            YeniHuvUstTeminatKod,
            YeniHuvAltTeminatKod,
            DuzenlemeNotu,
            DuzenlemeTarihi,
            ROW_NUMBER() OVER (PARTITION BY SutID ORDER BY DuzenlemeTarihi DESC, DuzenlemeID DESC) AS rn
          FROM SutEslestirmeManuelDuzenlemeler
          WHERE AktifMi = 1
        )
        SELECT
          SutID,
          SutKodu,
          YeniHuvUstTeminatKod,
          YeniHuvAltTeminatKod,
          DuzenlemeNotu,
          DuzenlemeTarihi
        FROM ranked
        WHERE rn = 1
      `);

      for (const row of manuelResult.recordset) {
        manuelOverrideBySutId.set(row.SutID, {
          yeniUstKod: String(row.YeniHuvUstTeminatKod).trim(),
          yeniAltKod: String(row.YeniHuvAltTeminatKod).trim(),
          not: row.DuzenlemeNotu || null,
          tarih: row.DuzenlemeTarihi || null
        });
      }
      console.log(`✅ ${manuelOverrideBySutId.size} manuel yerleştirme bulundu`);
    } catch (e) {
      console.warn('⚠️ Manuel yerleştirmeler alınamadı (devam ediliyor):', e.message);
    }

    // Grup kodlarına göre hızlı erişim (ustKod|||altKod -> teminatGruplari key)
    const huvGroupKeyByCodes = new Map();
    for (const [key, group] of teminatGruplari.entries()) {
      const codeKey = `${String(group.ustTeminat.kod)}|||${String(group.altTeminat.kod)}`;
      if (!huvGroupKeyByCodes.has(codeKey)) {
        huvGroupKeyByCodes.set(codeKey, key);
      }
    }

    // "GENEL İLKELER" grubunu önceden bul veya oluştur (eşleşmeyen işlemler için)
    let genelIlkelerGrup = null;
    let genelIlkelerKey = null;
    
    // "GENEL İLKELER" grubunu mevcut gruplar arasında ara
    for (const [key, grup] of teminatGruplari.entries()) {
      const ustNorm = normalizeTeminatAdi(grup.ustTeminat.adi);
      if (ustNorm.includes('genel') && ustNorm.includes('ilkeler')) {
        genelIlkelerGrup = grup;
        genelIlkelerKey = key;
        break;
      }
    }
    
    // Eğer "GENEL İLKELER" grubu yoksa, oluştur
    if (!genelIlkelerGrup) {
      const genelIlkelerResult = await pool.request().query(`
        SELECT TOP 1 AnaDalKodu, BolumAdi
        FROM AnaDallar
        WHERE LOWER(BolumAdi) LIKE '%genel%' AND LOWER(BolumAdi) LIKE '%ilkeler%'
        ORDER BY AnaDalKodu
      `);
      
      if (genelIlkelerResult.recordset.length > 0) {
        const genelIlkeler = genelIlkelerResult.recordset[0];
        genelIlkelerKey = `genelilkeler|||genelilkeler|||${genelIlkeler.AnaDalKodu}|||${genelIlkeler.AnaDalKodu}_genelilkeler`;
        
        genelIlkelerGrup = {
          ustTeminat: {
            kod: genelIlkeler.AnaDalKodu,
            adi: genelIlkeler.BolumAdi,
            tip: 'HUV'
          },
          altTeminat: {
            kod: `${genelIlkeler.AnaDalKodu}_genelilkeler`,
            anaDalKodu: genelIlkeler.AnaDalKodu,
            adi: genelIlkeler.BolumAdi,
            adiGosterim: genelIlkeler.BolumAdi,
            tip: 'HUV'
          },
          huvIslemler: [],
          sutIslemler: []
        };
        
        teminatGruplari.set(genelIlkelerKey, genelIlkelerGrup);
        console.log(`📝 "GENEL İLKELER" grubu oluşturuldu (eşleşmeyen işlemler için)`);
      } else {
        console.warn(`⚠️ "GENEL İLKELER" grubu AnaDallar tablosunda bulunamadı`);
      }
    }

    // Her SUT işlemini en uygun HUV teminat grubuna eşleştir
    let eslesmeyenSutIslemler = 0;
    let sutKoduEslestirme = 0; // SUT kodu ile eşleştirilen işlem sayısı
    let manuelEslestirme = 0; // Manuel override ile eşleştirilen işlem sayısı
    
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
      let manuelMeta = null;

      // 0) Manuel yerleştirme varsa her şeyin üstünde (override)
      const manuelOverride = manuelOverrideBySutId.get(islem.SutID);
      if (manuelOverride) {
        const targetKey = huvGroupKeyByCodes.get(`${manuelOverride.yeniUstKod}|||${manuelOverride.yeniAltKod}`);
        if (targetKey) {
          bestGroup = teminatGruplari.get(targetKey);
          bestScore = 1.0;
          eslestirmeTipi = 'manuel';
          manuelMeta = manuelOverride;
          manuelEslestirme++;
        } else {
          console.warn('⚠️ Manuel yerleştirme hedef grubu bulunamadı:', {
            sutId: islem.SutID,
            sutKodu: islem.SutKodu,
            hedefUst: manuelOverride.yeniUstKod,
            hedefAlt: manuelOverride.yeniAltKod
          });
        }
      }
      
      const sutKoduNorm = islem.SutKodu.trim();
      if (!bestGroup && huvSutKoduMap.has(sutKoduNorm)) {
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
        
        // ============================================
        // STRATEJİ 1: Üst ve Alt Teminat Benzerliği
        // ============================================
        // Üst teminat benzerliği
        const ustSimilarity = calculateSimilarity(sutUstTeminat, group.ustTeminat.adi);
        
        // Alt teminat benzerliği (daha önemli - özel kurallar burada devreye girer)
        const altSimilarity = calculateSimilarity(sutAltTeminat, group.altTeminat.adi);
        
        // ============================================
        // STRATEJİ 2: İşlem Adı Bazlı Eşleştirme (YENİ)
        // ============================================
        // SUT işlem adı ile HUV işlem adları arasında benzerlik kontrolü
        // Eğer işlem adları çok benziyorsa, skor artırılabilir
        // PERFORMANS: Sadece ilk 10 HUV işlemini kontrol et (çok fazla işlem varsa)
        let islemAdiBoost = 0;
        const sutIslemAdiNorm = normalizeTeminatAdi(islem.IslemAdi || '');
        
        if (sutIslemAdiNorm) {
          // HUV grubundaki işlem adları ile karşılaştır (performans için sınırla)
          const maxHuvIslemCheck = Math.min(group.huvIslemler.length, 10);
          for (let i = 0; i < maxHuvIslemCheck; i++) {
            const huvIslem = group.huvIslemler[i];
            const huvIslemAdiNorm = normalizeTeminatAdi(huvIslem.islemAdi || '');
            if (huvIslemAdiNorm) {
              // İşlem adları aynı veya çok benzer ise
              if (sutIslemAdiNorm === huvIslemAdiNorm) {
                islemAdiBoost = 0.3; // %30 boost
                break; // En yüksek boost bulundu, döngüden çık
              }
              // İşlem adlarında ortak anahtar kelimeler varsa
              if (islemAdiBoost < 0.3) { // Sadece daha düşük boost varsa kontrol et
                const sutWords = sutIslemAdiNorm.split(/\s+/).filter(w => w.length > 3);
                const huvWords = huvIslemAdiNorm.split(/\s+/).filter(w => w.length > 3);
                const commonWords = sutWords.filter(w => huvWords.includes(w));
                if (commonWords.length >= 2) {
                  islemAdiBoost = Math.max(islemAdiBoost, 0.15); // %15 boost
                }
              }
            }
          }
        }
        
        // Özel durum: Tüm SUT üst teminatları için özel eşleştirme kuralları
        // NOT: altSimilarityBoost başlangıç değeri 1.0 olmalı (1.0 = boost yok)
        // Boost miktarı hesaplanırken: boostAmount = altSimilarityBoost - 1.0
        let altSimilarityBoost = 1.0; // 1.0 = boost yok, 1.1-1.5 = %10-50 boost
        let useSpecialRule = false;
        
        // Normalize edilmiş değerleri önce tanımla (diğer stratejilerde kullanılacak)
        const sutUstNorm = normalizeTeminatAdi(sutUstTeminat);
        const huvUstNorm = normalizeTeminatAdi(group.ustTeminat.adi);
        const sutAltNorm = normalizeTeminatAdi(sutAltTeminat);
        const huvAltGosterim = group.altTeminat.adi.includes('→')
          ? group.altTeminat.adi.split('→').pop().trim()
          : group.altTeminat.adi;
        const huvAltGosterimNorm = normalizeTeminatAdi(huvAltGosterim);
        
        // ============================================
        // STRATEJİ 3: Anahtar Kelime Bazlı Eşleştirme (YENİ)
        // ============================================
        // Önemli tıbbi terimler (BT, MRG, PATOLOJİ, vb.) eşleşirse skor artırılabilir
        let anahtarKelimeBoost = 0;
        const anahtarKelimeler = ['bt', 'mrg', 'mr', 'patoloji', 'mikrobiyoloji', 'biyokimya', 
                                  'hematoloji', 'onkoloji', 'anjiyografi', 'artrografi', 
                                  'girisimsel', 'tomografi', 'rezonans'];
        
        // Anahtar kelime kontrolü için normalize edilmiş metinleri kullan (tutarlılık için)
        const sutText = `${sutUstNorm} ${sutAltNorm} ${sutIslemAdiNorm}`.toLowerCase();
        const huvText = `${huvUstNorm} ${huvAltGosterimNorm}`.toLowerCase();
        
        for (const kelime of anahtarKelimeler) {
          if (sutText.includes(kelime) && huvText.includes(kelime)) {
            anahtarKelimeBoost += 0.05; // Her eşleşen anahtar kelime için %5 boost
          }
        }
        anahtarKelimeBoost = Math.min(anahtarKelimeBoost, 0.2); // Maksimum %20 boost
        
        // 1. RADYOLOJİK GÖRÜNTÜLEME VE TEDAVİ → RADYOLOJİ eşleştirmesi
        if ((sutUstNorm.includes('radyolojik') || sutUstNorm.includes('radyoloji')) && 
            huvUstNorm.includes('radyoloji')) {
          
          // sutAltNorm, huvAltGosterim ve huvAltGosterimNorm zaten yukarıda tanımlı
          // Tekrar tanımlamaya gerek yok (performans ve tutarlılık için)
          
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
        
        // Boost'u altSimilarity'ye uygula (toplama olarak, ama 1.0'ı geçmesin)
        // altSimilarityBoost değerleri: 1.0 = boost yok, 1.1-1.5 = %10-50 boost
        // Boost miktarını hesapla: 1.2 → 0.2, 1.3 → 0.3, 1.4 → 0.4, 1.5 → 0.5
        const boostAmount = Math.max(0, altSimilarityBoost - 1.0);
        
        // Boost'u altSimilarity'ye ekle (ama 1.0'ı geçmesin)
        // Örnek: altSimilarity = 0.6, boostAmount = 0.3 → boostedAltSimilarity = 0.9
        const boostedAltSimilarity = Math.min(altSimilarity + boostAmount, 1.0);
        
        // ============================================
        // STRATEJİ 4: Çoklu Boost Kombinasyonu (YENİ)
        // ============================================
        // İşlem adı ve anahtar kelime boost'larını da ekle
        // Bu boost'lar altSimilarity'ye değil, genel skora eklenir
        const totalBoost = islemAdiBoost + anahtarKelimeBoost;
        
        // Kombine skor hesapla
        // Örnek: ustSimilarity = 0.8, boostedAltSimilarity = 0.9
        // Normal: (0.8 * 0.4) + (0.9 * 0.6) = 0.32 + 0.54 = 0.86
        // Özel kural: (0.8 * 0.2) + (0.9 * 0.8) = 0.16 + 0.72 = 0.88
        let combinedScore = (ustSimilarity * ustWeight) + (boostedAltSimilarity * altWeight);
        
        // İşlem adı ve anahtar kelime boost'larını ekle (ama 1.0'ı geçmesin)
        combinedScore = Math.min(combinedScore + totalBoost, 1.0);
        
        // Skor 1.0'ı geçmemeli (güvenlik kontrolü)
        const finalScore = Math.min(combinedScore, 1.0);
        
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestGroup = group;
        }
        }
      }
      
      // Özel kontrol: "GENEL İLKELER" genel bir kategori olduğu için, sadece gerçekten eşleşen işlemler buraya gitmeli
      // "GENEL İLKELER" için daha sıkı kurallar:
      // 1. SUT üst teminatı "GENEL İLKELER" içermeli VEYA
      // 2. Skor çok yüksek olmalı (>= 0.7) VEYA
      // 3. SUT kodu ile direkt eşleştirme olmalı
      const isGenelIlkeler = bestGroup && (
        normalizeTeminatAdi(bestGroup.ustTeminat.adi).includes('genel') && 
        normalizeTeminatAdi(bestGroup.ustTeminat.adi).includes('ilkeler')
      );
      
      if (isGenelIlkeler && eslestirmeTipi === 'benzerlik') {
        const sutUstNorm = normalizeTeminatAdi(sutUstTeminat);
        const sutAltNorm = normalizeTeminatAdi(sutAltTeminat);
        const isGenelIlkelerRelated = 
          sutUstNorm.includes('genel') || 
          sutUstNorm.includes('ilkeler') ||
          sutAltNorm.includes('genel') ||
          sutAltNorm.includes('ilkeler');
        
        // Eğer SUT "GENEL İLKELER" ile ilgili değilse VE skor düşükse (< 0.7), eşleştirmeyi reddet
        if (!isGenelIlkelerRelated && bestScore < 0.7) {
          bestGroup = null;
          bestScore = 0;
        }
      }
      
      // Düşük skorlu eşleşmeleri özetle (0.3-0.5 arası)
      // Not: Aynı üst/alt teminat altında çok işlem olduğu için tek tek log spam yapar.
      if (bestGroup && eslestirmeTipi === 'benzerlik' && bestScore >= 0.3 && bestScore < 0.5) {
        const k = `${sutUstTeminat}|||${sutAltTeminat} -> ${bestGroup.ustTeminat.adi}|||${bestGroup.altTeminat.adi}`;
        const prev = lowConfidenceAgg.get(k);
        if (prev) {
          prev.count += 1;
        } else {
          lowConfidenceAgg.set(k, {
            count: 1,
            sample: {
              sutKodu: islem.SutKodu,
              islemAdi: islem.IslemAdi,
              skor: Number(bestScore.toFixed(3))
            }
          });
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
        eslestirmeTipi: eslestirmeTipi, // 'sutKodu' | 'benzerlik' | 'manuel'
        lowConfidence: eslestirmeTipi === 'benzerlik' && bestScore >= 0.3 && bestScore < 0.5, // 0.3-0.5 arası düşük skorlu eşleşmeler için flag
        manuel: eslestirmeTipi === 'manuel',
        manuelNotu: manuelMeta?.not || null,
        manuelTarihi: manuelMeta?.tarih || null
      };

      if (bestGroup) {
        // En uygun HUV grubuna ekle
        bestGroup.sutIslemler.push(sutIslem);
      } else {
        // Eşleşmeyen işlemi "GENEL İLKELER" grubuna ekle
        if (genelIlkelerGrup) {
          genelIlkelerGrup.sutIslemler.push(sutIslem);
          eslesmeyenSutIslemler++;
          // Her işlem için log spam yapmamak için sadece özet log
        } else {
          // "GENEL İLKELER" grubu bulunamadı, sadece say
          eslesmeyenSutIslemler++;
          console.error(`❌ Eşleşmeyen SUT işlemi ve "GENEL İLKELER" grubu bulunamadı: ${islem.SutKodu} - ${islem.IslemAdi}`);
        }
      }
    }

    // Düşük güven özetini logla (en çok görülen ilk 20)
    if (lowConfidenceAgg.size > 0) {
      const top = Array.from(lowConfidenceAgg.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20);

      console.log(`⚠️ [LOW_CONFIDENCE_SUMMARY] Toplam farklı eşleşme: ${lowConfidenceAgg.size}`);
      for (const [k, v] of top) {
        console.log(
          `⚠️ [LOW_CONFIDENCE_SUMMARY] ${v.count} adet | ${k} | örnek: ${v.sample.sutKodu ?? '-'} - ${v.sample.islemAdi ?? '-'} (skor: ${v.sample.skor})`
        );
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
        huvIslemler: [], // HUV işlemleri gösterilmiyor, sadece SUT işlemleri gösteriliyor
        sutIslemler: grup.sutIslemler,
        toplamHuvIslem: 0, // HUV işlemleri gösterilmiyor
        toplamSutIslem: grup.sutIslemler.length,
        toplamIslem: grup.sutIslemler.length // Sadece SUT işlemleri
      };
    });

    // İstatistikler
    const birlesikGruplar = result.filter(g => g.toplamHuvIslem > 0 && g.toplamSutIslem > 0).length;
    const sadeceHuvGruplar = result.filter(g => g.toplamHuvIslem > 0 && g.toplamSutIslem === 0).length;
    const sadeceSutGruplar = result.filter(g => g.toplamHuvIslem === 0 && g.toplamSutIslem > 0).length;

    const duration = Date.now() - startTime;
    console.log(`✅ Birleşik liste hazırlandı (${duration}ms)`);
    console.log(`📊 İstatistikler: ${result.length} grup, ${result.reduce((sum, item) => sum + item.toplamHuvIslem, 0)} HUV, ${result.reduce((sum, item) => sum + item.toplamSutIslem, 0)} SUT`);
    if (eslesmeyenSutIslemler > 0) {
      console.log(`⚠️ ${eslesmeyenSutIslemler} SUT işlemi eşleşmedi ve "GENEL İLKELER" grubuna eklendi`);
    }

    const responseData = {
      listeTipi: 'SUT_HUV_GRUPLANDIRMA',
      aciklama: 'SUT işlemleri HUV teminat gruplarına göre kategorize edilmiştir. Her SUT işlemi, teminat bilgisine göre (benzerlik skoru ile) en uygun HUV teminat grubuna eşleştirilir. Tüm SUT işlemleri mutlaka bir HUV grubuna dahil edilir.',
      toplamGrup: result.length,
      birlesikGrup: birlesikGruplar,
      sadeceHuvGrup: sadeceHuvGruplar,
      sadeceSutGrup: sadeceSutGruplar,
      eslesmeyenSutIslem: eslesmeyenSutIslemler,
      sutKoduEslestirme: sutKoduEslestirme, // SUT kodu ile direkt eşleştirilen işlem sayısı
      manuelEslestirme: manuelEslestirme, // Doktor manuel yerleştirmesi ile override edilen işlem sayısı
      toplamHuvIslem: 0, // HUV işlemleri gösterilmiyor
      toplamSutIslem: result.reduce((sum, item) => sum + item.toplamSutIslem, 0),
      toplamIslem: result.reduce((sum, item) => sum + item.toplamSutIslem, 0), // Sadece SUT işlemleri
      data: result
    };

    // Cache'e kaydet (15 dakika TTL - büyük veri seti için)
    cache.set(cacheKey, responseData, 15 * 60 * 1000);
    console.log('💾 Cache\'e kaydedildi (15 dakika TTL)');

    return success(res, responseData, 'SUT işlemleri HUV teminat gruplarına göre kategorize edilmiş liste');
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Birleşik liste hatası (${duration}ms):`, err.message);
    console.error(err.stack);
    next(err);
  }
};

// ============================================
// GET /api/external/birlesik/gruplar
// Birleşik liste - Sadece grup özetleri (Lazy Loading için)
// SUT işlemlerini dahil etmez, sadece grup bilgilerini döner
// Çok daha hızlı yükleme (~1-2 saniye)
// ============================================
const getBirlesikGruplar = async (req, res, next) => {
  const startTime = Date.now();
  console.log('🔄 Birleşik grup özetleri isteği alındı');
  
  // Cache kontrolü - tam liste cache'den alınır, sadece özet çıkarılır
  const cacheKey = 'birlesik_liste';
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && cachedData.data) {
    console.log('✅ Cache\'den grup özetleri çıkarılıyor');
    // Cache'den sadece grup özetlerini çıkar
    const grupOzetleri = cachedData.data.map(grup => ({
      ustTeminat: grup.ustTeminat,
      altTeminat: grup.altTeminat,
      toplamHuvIslem: 0, // HUV işlemleri gösterilmiyor
      toplamSutIslem: grup.toplamSutIslem,
      toplamIslem: grup.toplamSutIslem, // Sadece SUT işlemleri
      // Ortalama skor hesapla (SUT işlemlerinden)
      ortalamaSkor: grup.sutIslemler && grup.sutIslemler.length > 0
        ? grup.sutIslemler.reduce((sum, s) => sum + (s.uyumSkoru || 0), 0) / grup.sutIslemler.length
        : null
    }));
    
    return success(res, {
      listeTipi: 'BIRLESIK_GRUPLAR',
      aciklama: 'HUV gruplarının özet bilgileri. Detaylar için /birlesik/grup endpoint\'ini kullanın.',
      toplamGrup: grupOzetleri.length,
      data: grupOzetleri
    }, 'Birleşik grup özetleri (Cache)');
  }
  
  // Cache yoksa, tam listeyi hesapla ve cache'e kaydet
  // Ama response'da sadece özetleri döndür
  try {
    console.log('⚠️ Cache yok, tam liste hesaplanıyor (ilk yükleme)...');
    
    // getBirlesikList fonksiyonunu çağır ama response'u intercept et
    // Bunun için getBirlesikList'in iç mantığını kullanacağız
    // Ama daha basit: sadece grup sayılarını hesapla, SUT eşleştirmesini yapma
    // Ya da: getBirlesikList'i çağır, cache'e kaydet, sonra özet çıkar
    
    // En basit çözüm: getBirlesikList'i çağır, cache'e kaydet, sonra özet döndür
    // Ama bu recursive olabilir, o yüzden dikkatli olalım
    
    // Alternatif: Sadece HUV gruplarını çek, SUT eşleştirmesini yapma
    const pool = await getPool();
    
    // Sadece HUV gruplarını al (SUT eşleştirmesi yapmadan)
    const anaDallarResult = await pool.request().query(`
      SELECT 
        AnaDalKodu as UstTeminatKodu,
        BolumAdi as UstTeminatAdi,
        AnaDalKodu as AltTeminatKodu,
        BolumAdi as AltTeminatAdi
      FROM AnaDallar
      ORDER BY AnaDalKodu
    `);
    
    // Her grup için HUV işlem sayısını al
    const grupOzetleri = [];
    for (const anaDal of anaDallarResult.recordset) {
      const huvSayisiResult = await pool.request()
        .input('anaDalKodu', sql.Int, anaDal.UstTeminatKodu)
        .query(`
          SELECT COUNT(*) as Toplam
          FROM HuvIslemler
          WHERE AnaDalKodu = @anaDalKodu AND AktifMi = 1
        `);
      
      const toplamHuv = huvSayisiResult.recordset[0].Toplam;
      
      // SUT sayısını hesaplamak için tam eşleştirme gerekir
      // Şimdilik 0 olarak bırak, tam liste yüklendiğinde güncellenir
      grupOzetleri.push({
        ustTeminat: {
          kod: anaDal.UstTeminatKodu,
          adi: anaDal.UstTeminatAdi
        },
        altTeminat: {
          kod: anaDal.AltTeminatKodu,
          adi: anaDal.AltTeminatAdi
        },
        toplamHuvIslem: toplamHuv,
        toplamSutIslem: 0, // Tam eşleştirme yapılmadığı için bilinmiyor
        toplamIslem: toplamHuv,
        ortalamaSkor: null
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Grup özetleri hazırlandı (${duration}ms) - Not: SUT sayıları için tam liste gerekli`);
    
    return success(res, {
      listeTipi: 'BIRLESIK_GRUPLAR',
      aciklama: 'HUV gruplarının özet bilgileri. SUT sayıları için tam liste hesaplanmalı. Detaylar için /birlesik/grup endpoint\'ini kullanın.',
      toplamGrup: grupOzetleri.length,
      data: grupOzetleri,
      uyari: 'SUT sayıları için tam eşleştirme gerekli. İlk grup detayı istendiğinde tam liste hesaplanacak.'
    }, 'Birleşik grup özetleri (Hızlı)');
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Grup özetleri hatası (${duration}ms):`, err.message);
    next(err);
  }
};

// ============================================
// GET /api/external/birlesik/grup?ustKod=X&altKod=Y
// Birleşik liste - Belirli bir grubun detayları (Lazy Loading için)
// Sadece istenen grubun HUV ve SUT işlemlerini döner
// ============================================
const getBirlesikGrup = async (req, res, next) => {
  const startTime = Date.now();
  const { ustKod, altKod } = req.query;
  
  if (!ustKod || !altKod) {
    return error(res, 400, 'ustKod ve altKod parametreleri gereklidir');
  }
  
  console.log(`🔄 Birleşik grup detayı isteği: ${ustKod} / ${altKod}`);
  
  // Cache kontrolü
  const cacheKey = 'birlesik_liste';
  let cachedData = cache.get(cacheKey);
  
  // Cache yoksa, tam listeyi hesapla ve cache'e kaydet
  if (!cachedData || !cachedData.data) {
    console.log('⚠️ Cache yok, tam liste hesaplanıyor (ilk grup detayı - bu biraz zaman alabilir)...');
    
    try {
      // getBirlesikList'in iç mantığını kullanarak tam listeyi hesapla
      // getBirlesikList bir Express handler, o yüzden doğrudan çağıramayız
      // Alternatif: getBirlesikList'in iç mantığını ayrı bir helper'a çıkar
      // Şimdilik: Basit bir çözüm - cache yoksa, kullanıcıya önce /birlesik endpoint'ini çağırmasını söyle
      // Ya da: getBirlesikList'i manuel çağır (ama bu karmaşık)
      
      // Geçici çözüm: Cache yoksa, tam listeyi hesaplamak için getBirlesikList'i çağır
      // getBirlesikList bir Express handler, o yüzden mock req/res objesi oluştur
      let cacheUpdated = false;
      const mockReq = { ...req };
      const mockRes = {
        status: (code) => mockRes,
        json: (data) => {
          // Response'u yakala ve cache'e kaydet
          if (data && data.success && data.data) {
            cache.set(cacheKey, data.data, 15 * 60 * 1000);
            cachedData = data.data;
            cacheUpdated = true;
            console.log('✅ Tam liste hesaplandı ve cache\'e kaydedildi');
          }
        }
      };
      
      // getBirlesikList'i çağır (cache'e kaydeder)
      await new Promise((resolve, reject) => {
        getBirlesikList(mockReq, mockRes, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Cache'den tekrar al (getBirlesikList cache'e kaydetti)
      if (!cacheUpdated) {
        cachedData = cache.get(cacheKey);
      }
      
      if (!cachedData || !cachedData.data) {
        return error(res, 500, 'Tam liste hesaplanamadı. Lütfen önce /birlesik endpoint\'ini çağırarak tam listeyi yükleyin.');
      }
    } catch (err) {
      console.error('❌ Grup detayı hatası (cache yokken):', err.message);
      return error(res, 500, `Tam liste hesaplanamadı: ${err.message}. Lütfen önce /birlesik endpoint'ini çağırarak tam listeyi yükleyin.`);
    }
  }
  
  // Cache'den istenen grubu bul
  const grup = cachedData.data.find(g => 
    g.ustTeminat.kod.toString() === ustKod.toString() && 
    g.altTeminat.kod.toString() === altKod.toString()
  );
  
  if (!grup) {
    return error(res, 404, `Grup bulunamadı: ${ustKod} / ${altKod}`);
  }
  
  const duration = Date.now() - startTime;
  console.log(`✅ Grup detayı hazırlandı (${duration}ms)`);
  
  return success(res, {
    listeTipi: 'BIRLESIK_GRUP',
    aciklama: `HUV grubu detayı: ${grup.ustTeminat.adi} / ${grup.altTeminat.adi}`,
    grup: grup
  }, 'Birleşik grup detayı');
};


// ============================================
// GET /api/external/sut-huv-eslestirme
// SUT listesi - SUT kırılımlarına göre, yanında HUV teminat bilgisi
// Üst Teminat: Ana Başlık (Seviye 1)
// Alt Teminat: İlk alt seviye (Seviye 2) - yoksa Ana Başlık
// İşlem: SutIslem (yanında eşleştirildiği HUV üst ve alt teminat bilgisi)
// ============================================
const getSutHuvEslestirme = async (req, res, next) => {
  try {
    const pool = await getPool();
    console.log('🔄 SUT-HUV eşleştirme listesi isteği alındı');

    // Cache kontrolü
    const cacheKey = 'sut_huv_eslestirme_liste';
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache\'den döndürülüyor');
      return success(res, cachedData, 'SUT listesi HUV eşleştirmeli (Cache)');
    }

    // 1. SUT listesini al (getSutList mantığı ile)
    const hiyerarsiResult = await pool.request().query(`
      SELECT 
        ab.AnaBaslikNo,
        ab.AnaBaslikAdi,
        ab.HiyerarsiID as AnaBaslikID,
        h2.HiyerarsiID as AltSeviyeID,
        h2.Baslik as AltSeviyeAdi,
        h2.SeviyeNo as AltSeviyeSeviye,
        h3.HiyerarsiID as EnUstSeviyeID,
        h3.Baslik as EnUstSeviyeAdi
      FROM SutAnaBasliklar ab
      LEFT JOIN SutHiyerarsi h2 ON h2.ParentID = ab.HiyerarsiID 
        AND h2.SeviyeNo = 2 
        AND h2.AktifMi = 1
        AND h2.HiyerarsiID = (
          SELECT TOP 1 HiyerarsiID
          FROM SutHiyerarsi
          WHERE ParentID = ab.HiyerarsiID AND SeviyeNo = 2 AND AktifMi = 1
          ORDER BY Sira
        )
      LEFT JOIN SutHiyerarsi h3 ON h3.ParentID = COALESCE(h2.HiyerarsiID, ab.HiyerarsiID)
        AND h3.AktifMi = 1
        AND h3.SeviyeNo > COALESCE(h2.SeviyeNo, 1)
        AND h3.HiyerarsiID = (
          SELECT TOP 1 HiyerarsiID
          FROM SutHiyerarsi
          WHERE ParentID = COALESCE(h2.HiyerarsiID, ab.HiyerarsiID)
            AND AktifMi = 1
            AND SeviyeNo > COALESCE(h2.SeviyeNo, 1)
          ORDER BY SeviyeNo, Sira
        )
      WHERE ab.AktifMi = 1
      ORDER BY ab.AnaBaslikNo
    `);

    // 2. Tüm SUT işlemlerini çek
    const sutIslemlerResult = await pool.request().query(`
      SELECT 
        s.SutID,
        s.SutKodu,
        s.IslemAdi,
        s.Puan,
        s.Aciklama,
        s.HiyerarsiID
      FROM SutIslemler s
      WHERE s.AktifMi = 1
      ORDER BY s.SutKodu
    `);

    // 3. Manuel eşleştirmeleri al (aktif olanlar)
    const manuelEslestirmelerResult = await pool.request().query(`
      SELECT 
        SutID,
        YeniHuvUstTeminatKod,
        YeniHuvAltTeminatKod
      FROM SutEslestirmeManuelDuzenlemeler
      WHERE AktifMi = 1
    `);

    // Manuel eşleştirmeleri Map'e al (SutID -> { ustKod, altKod })
    const manuelEslestirmeMap = new Map();
    for (const manuel of manuelEslestirmelerResult.recordset) {
      manuelEslestirmeMap.set(manuel.SutID, {
        ustKod: manuel.YeniHuvUstTeminatKod,
        altKod: manuel.YeniHuvAltTeminatKod
      });
    }

    // 4. Birleşik listeden eşleştirme bilgilerini al (cache'den)
    // getBirlesikList'in cache'inden SUT işlemlerinin HUV eşleştirmelerini çıkar
    const birlesikCacheKey = 'birlesik_liste';
    const birlesikData = cache.get(birlesikCacheKey);
    
    // SUT işlemlerini HiyerarsiID'ye göre Map'e al
    const islemlerByHiyerarsiID = new Map();
    for (const islem of sutIslemlerResult.recordset) {
      const hiyerarsiID = islem.HiyerarsiID;
      if (!islemlerByHiyerarsiID.has(hiyerarsiID)) {
        islemlerByHiyerarsiID.set(hiyerarsiID, []);
      }
      islemlerByHiyerarsiID.get(hiyerarsiID).push({
        sutId: islem.SutID,
        sutKodu: islem.SutKodu,
        islemAdi: islem.IslemAdi,
        puan: islem.Puan,
        aciklama: islem.Aciklama
      });
    }

    // 5. Birleşik listeden SUT işlemlerinin HUV eşleştirmelerini çıkar
    const sutHuvEslestirmeMap = new Map(); // SutID -> { ustTeminat, altTeminat, eslestirmeTipi, eslestirmeSkoru }
    
    if (birlesikData && birlesikData.data) {
      // Birleşik listeden SUT işlemlerinin HUV eşleştirmelerini çıkar
      for (const grup of birlesikData.data) {
        if (grup.sutIslemler && grup.sutIslemler.length > 0) {
          for (const sutIslem of grup.sutIslemler) {
            sutHuvEslestirmeMap.set(sutIslem.sutId, {
              huvUstTeminat: grup.ustTeminat,
              huvAltTeminat: grup.altTeminat,
              eslestirmeTipi: sutIslem.eslestirmeTipi || 'benzerlik',
              eslestirmeSkoru: sutIslem.eslestirmeSkoru || sutIslem.uyumSkoru || 0
            });
          }
        }
      }
    } else {
      console.log('⚠️ Birleşik liste cache\'i yok, eşleştirme bilgileri bulunamadı. Önce /birlesik endpoint\'ini çağırın.');
    }

    // 6. Sonucu oluştur
    const result = [];
    for (const row of hiyerarsiResult.recordset) {
      const altTeminat = {
        kod: row.AltSeviyeID || row.AnaBaslikID,
        adi: row.AltSeviyeAdi || row.AnaBaslikAdi
      };

      const islemHiyerarsiID = row.EnUstSeviyeID || row.AltSeviyeID || row.AnaBaslikID;
      const islemler = islemlerByHiyerarsiID.get(islemHiyerarsiID) || [];

      // Her SUT işleminin yanına HUV eşleştirme bilgisini ekle
      const islemlerHuvEslestirmeli = islemler.map(islem => {
        // Önce manuel eşleştirmeye bak
        const manuelEslestirme = manuelEslestirmeMap.get(islem.sutId);
        if (manuelEslestirme) {
          // Manuel eşleştirme varsa, HUV teminat bilgilerini al
          // AnaDallar tablosundan teminat adlarını al
          return {
            ...islem,
            huvEslestirme: {
              ustTeminat: {
                kod: manuelEslestirme.ustKod,
                adi: null // Sonra doldurulacak
              },
              altTeminat: {
                kod: manuelEslestirme.altKod,
                adi: null // Sonra doldurulacak
              },
              eslestirmeTipi: 'manuel',
              eslestirmeSkoru: 1.0
            }
          };
        }

        // Manuel eşleştirme yoksa, birleşik listeden al
        const eslestirme = sutHuvEslestirmeMap.get(islem.sutId);
        if (eslestirme) {
          return {
            ...islem,
            huvEslestirme: {
              ustTeminat: eslestirme.huvUstTeminat,
              altTeminat: eslestirme.huvAltTeminat,
              eslestirmeTipi: eslestirme.eslestirmeTipi,
              eslestirmeSkoru: eslestirme.eslestirmeSkoru
            }
          };
        }

        // Eşleştirme bulunamadı
        return {
          ...islem,
          huvEslestirme: null
        };
      });

      result.push({
        ustTeminat: {
          kod: row.AnaBaslikNo,
          adi: row.AnaBaslikAdi
        },
        altTeminat: altTeminat,
        islemler: islemlerHuvEslestirmeli
      });
    }

    // 7. HUV teminat adlarını doldur (manuel eşleştirmeler için)
    const huvTeminatKodlari = new Set();
    for (const grup of result) {
      for (const islem of grup.islemler) {
        if (islem.huvEslestirme) {
          if (islem.huvEslestirme.ustTeminat.kod) {
            huvTeminatKodlari.add(islem.huvEslestirme.ustTeminat.kod);
          }
        }
      }
    }

    if (huvTeminatKodlari.size > 0) {
      // SQL injection önleme için parametreli sorgu kullan
      const kodlar = Array.from(huvTeminatKodlari);
      const placeholders = kodlar.map((_, i) => `@kod${i}`).join(',');
      const request = pool.request();
      
      // Kodları integer'a çevir (AnaDalKodu INT)
      kodlar.forEach((kod, i) => {
        const kodInt = parseInt(kod);
        if (!isNaN(kodInt)) {
          request.input(`kod${i}`, sql.Int, kodInt);
        }
      });
      
      const huvTeminatlarResult = await request.query(`
        SELECT AnaDalKodu, BolumAdi
        FROM AnaDallar
        WHERE AnaDalKodu IN (${placeholders})
      `);

      const huvTeminatMap = new Map();
      for (const teminat of huvTeminatlarResult.recordset) {
        huvTeminatMap.set(teminat.AnaDalKodu, teminat.BolumAdi);
      }

      // Teminat adlarını doldur
      for (const grup of result) {
        for (const islem of grup.islemler) {
          if (islem.huvEslestirme && islem.huvEslestirme.ustTeminat.kod) {
            const kodInt = parseInt(islem.huvEslestirme.ustTeminat.kod);
            const teminatAdi = huvTeminatMap.get(kodInt);
            if (teminatAdi) {
              islem.huvEslestirme.ustTeminat.adi = teminatAdi;
              // Alt teminat da aynı (HUV'de üst ve alt teminat aynı)
              islem.huvEslestirme.altTeminat.adi = teminatAdi;
            }
          }
        }
      }
    }

    const responseData = {
      listeTipi: 'SUT_HUV_ESLESTIRME',
      aciklama: 'SUT işlemleri SUT kırılımlarına göre listelenmiş, yanında eşleştirildiği HUV teminat bilgisi var',
      toplamUstTeminat: result.length,
      toplamIslem: result.reduce((sum, item) => sum + item.islemler.length, 0),
      data: result
    };

    // Cache'e kaydet (15 dakika TTL)
    cache.set(cacheKey, responseData, 15 * 60 * 1000);
    console.log('💾 Cache\'e kaydedildi (15 dakika TTL)');

    return success(res, responseData, 'SUT listesi HUV eşleştirmeli');
  } catch (err) {
    console.error('❌ SUT-HUV eşleştirme listesi hatası:', err.message);
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
  getBirlesikList,
  getBirlesikGruplar,
  getBirlesikGrup,
  getSutHuvEslestirme
};

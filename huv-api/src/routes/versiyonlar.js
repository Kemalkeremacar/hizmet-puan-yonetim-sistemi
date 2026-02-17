// ============================================
// VERSİYONLAR ROUTES
// ============================================
// Endpoint: /api/admin/versiyonlar
// ============================================

const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');

// ============================================
// GET /api/admin/versiyonlar
// Liste versiyonlarını getir
// Query: listeTipi (HUV/SUT)
// ============================================
router.get('/', async (req, res, next) => {
  try {
    const { listeTipi = 'HUV' } = req.query;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('listeTipi', sql.NVarChar(50), listeTipi)
      .query(`
        SELECT 
          VersionID,
          ListeTipi,
          YuklemeTarihi,
          DosyaAdi,
          KayitSayisi,
          Aciklama,
          YukleyenKullanici,
          OlusturmaTarihi,
          EklenenSayisi,
          GuncellenenSayisi,
          SilinenSayisi
        FROM ListeVersiyon
        WHERE ListeTipi = @listeTipi
        ORDER BY VersionID DESC
      `);
    
    return success(res, result.recordset, 'Versiyonlar başarıyla getirildi');
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /api/admin/versiyonlar/:id
// Versiyon detayını getir (HUV ve SUT destekli)
// ============================================
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    
    // Versiyon bilgisi
    const versionResult = await pool.request()
      .input('versionId', sql.Int, parseInt(id))
      .query('SELECT * FROM ListeVersiyon WHERE VersionID = @versionId');
    
    if (versionResult.recordset.length === 0) {
      return error(res, 'Versiyon bulunamadı', 404);
    }
    
    const version = versionResult.recordset[0];
    const listeTipi = version.ListeTipi;
    
    // Değişmeyen sayısını hesapla
    const toplamKayit = version.KayitSayisi || 0;
    const eklenen = version.EklenenSayisi || 0;
    const guncellenen = version.GuncellenenSayisi || 0;
    const silinen = version.SilinenSayisi || 0;
    const degismeyen = Math.max(0, toplamKayit - eklenen - guncellenen - silinen);
    
    if (listeTipi === 'SUT') {
      // SUT için özel sorgular
      // Bu versiyonda eklenen SUT işlemleri
      const addedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
        .query(`
          SELECT TOP 100
            v.SutID, v.SutKodu, v.IslemAdi, v.Puan, ab.AnaBaslikAdi
          FROM SutIslemVersionlar v
          LEFT JOIN SutIslemler i ON v.SutID = i.SutID
          LEFT JOIN SutAnaBasliklar ab ON i.AnaBaslikNo = ab.AnaBaslikNo
          WHERE v.ListeVersiyonID = @versionId
          AND v.DegisiklikSebebi IN ('Yeni işlem eklendi', 'Pasif işlem tekrar aktif edildi', 'Silinmiş işlem tekrar eklendi')
          ORDER BY v.SutKodu
        `);
      
      // Bu versiyonda güncellenen SUT işlemleri
      const updatedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
        .query(`
          SELECT TOP 100
            i.SutID, i.SutKodu, i.IslemAdi,
            v_curr.Puan as YeniPuan,
            v_prev.Puan as EskiPuan,
            v_prev.IslemAdi as EskiIslemAdi,
            v_prev.Aciklama as EskiAciklama,
            ab.AnaBaslikAdi,
            -- Hangi alanlar değişmiş
            CASE WHEN ABS(ISNULL(v_curr.Puan, 0) - ISNULL(v_prev.Puan, 0)) > 0.01 THEN 1 ELSE 0 END as PuanDegisti,
            CASE WHEN v_curr.IslemAdi != v_prev.IslemAdi THEN 1 ELSE 0 END as IslemAdiDegisti,
            CASE WHEN ISNULL(v_curr.Aciklama, '') != ISNULL(v_prev.Aciklama, '') THEN 1 ELSE 0 END as AciklamaDegisti
          FROM SutIslemVersionlar v_curr
          INNER JOIN SutIslemler i ON v_curr.SutID = i.SutID
          LEFT JOIN SutAnaBasliklar ab ON i.AnaBaslikNo = ab.AnaBaslikNo
          INNER JOIN SutIslemVersionlar v_prev ON v_curr.SutID = v_prev.SutID 
            AND v_prev.SutVersionID = (
              SELECT MAX(SutVersionID) 
              FROM SutIslemVersionlar 
              WHERE SutID = v_curr.SutID AND ListeVersiyonID < @versionId
            )
          WHERE v_curr.ListeVersiyonID = @versionId
          AND v_curr.DegisiklikSebebi LIKE 'SUT listesi güncellendi%'
          ORDER BY i.SutKodu
        `);
      
      // Bu versiyonda silinen SUT işlemleri
      const deletedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
        .query(`
          SELECT TOP 100
            i.SutID, i.SutKodu, i.IslemAdi, i.Puan,
            ab.AnaBaslikAdi
          FROM SutIslemVersionlar v
          INNER JOIN SutIslemler i ON v.SutID = i.SutID
          LEFT JOIN SutAnaBasliklar ab ON i.AnaBaslikNo = ab.AnaBaslikNo
          WHERE v.GecerlilikBitis IS NOT NULL
          AND v.GecerlilikBitis >= (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId)
          AND v.GecerlilikBitis < DATEADD(DAY, 1, (SELECT YuklemeTarihi FROM ListeVersiyon WHERE VersionID = @versionId))
          AND NOT EXISTS (
            SELECT 1 FROM SutIslemVersionlar v2
            WHERE v2.SutID = v.SutID
            AND v2.ListeVersiyonID = @versionId
            AND v2.AktifMi = 1
          )
          ORDER BY i.SutKodu
        `);
      
      return success(res, {
        version,
        summary: {
          eklenen: eklenen,
          guncellenen: guncellenen,
          silinen: silinen,
          degismeyen: degismeyen,
          toplam: toplamKayit
        },
        eklenenler: addedResult.recordset,
        guncellenenler: updatedResult.recordset,
        silinenler: deletedResult.recordset
      }, 'Versiyon detayı başarıyla getirildi');
      
    } else if (listeTipi === 'ILKATSAYI') {
      // İl Katsayıları için özel sorgular
      // Bu versiyonda eklenen il katsayıları
      const addedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
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
      
      // Bu versiyonda güncellenen il katsayıları
      const updatedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
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
      
      // Bu versiyonda silinen il katsayıları
      const deletedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
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
        version,
        summary: {
          eklenen: eklenen,
          guncellenen: guncellenen,
          silinen: silinen,
          degismeyen: degismeyen,
          toplam: toplamKayit
        },
        eklenenler: addedResult.recordset,
        guncellenenler: updatedResult.recordset,
        silinenler: deletedResult.recordset
      }, 'Versiyon detayı başarıyla getirildi');
      
    } else {
      // HUV için mevcut sorgular
      const addedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
        .query(`
          SELECT TOP 100
            v.IslemID, v.HuvKodu, v.IslemAdi, v.Birim, a.BolumAdi
          FROM IslemVersionlar v
          LEFT JOIN HuvIslemler i ON v.IslemID = i.IslemID
          LEFT JOIN AnaDallar a ON i.AnaDalKodu = a.AnaDalKodu
          WHERE v.ListeVersiyonID = @versionId
          AND v.DegisiklikSebebi IN ('Yeni işlem eklendi', 'Pasif işlem tekrar aktif edildi', 'Silinmiş işlem tekrar eklendi')
          ORDER BY v.HuvKodu
        `);
      
      const updatedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
        .query(`
          SELECT TOP 100
            i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim,
            v_curr.Birim as YeniBirim,
            v_prev.Birim as EskiBirim,
            v_prev.IslemAdi as EskiIslemAdi,
            v_prev.SutKodu as EskiSutKodu,
            v_prev.[Not] as EskiNot,
            a.BolumAdi,
            CASE WHEN ABS(ISNULL(v_curr.Birim, 0) - ISNULL(v_prev.Birim, 0)) > 0.01 THEN 1 ELSE 0 END as BirimDegisti,
            CASE WHEN v_curr.IslemAdi != v_prev.IslemAdi THEN 1 ELSE 0 END as IslemAdiDegisti,
            CASE WHEN ISNULL(v_curr.SutKodu, '') != ISNULL(v_prev.SutKodu, '') THEN 1 ELSE 0 END as SutKoduDegisti,
            CASE WHEN ISNULL(v_curr.[Not], '') != ISNULL(v_prev.[Not], '') THEN 1 ELSE 0 END as NotDegisti
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
      
      const deletedResult = await pool.request()
        .input('versionId', sql.Int, parseInt(id))
        .query(`
          SELECT TOP 100
            i.IslemID, i.HuvKodu, i.IslemAdi, i.Birim,
            a.BolumAdi
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
        version,
        summary: {
          eklenen: eklenen,
          guncellenen: guncellenen,
          silinen: silinen,
          degismeyen: degismeyen,
          toplam: toplamKayit
        },
        eklenenler: addedResult.recordset,
        guncellenenler: updatedResult.recordset,
        silinenler: deletedResult.recordset
      }, 'Versiyon detayı başarıyla getirildi');
    }
    
  } catch (err) {
    next(err);
  }
});

module.exports = router;

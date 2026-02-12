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
// Versiyon detayını getir
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
    
    // Bu versiyonda eklenen işlemler (HUV)
    // IslemVersionlar tablosunda DegisiklikSebebi'ne göre yeni eklenen işlemleri bul
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
    
    // Bu versiyonda güncellenen işlemler
    // IslemVersionlar tablosunda DegisiklikSebebi'ne göre güncellenen işlemleri bul
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
          -- Hangi alanlar değişmiş
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
    
    // Bu versiyonda silinen işlemler
    // IslemVersionlar'da GecerlilikBitis set edilen kayıtlar
    const deletedResult = await pool.request()
      .input('versionId', sql.Int, parseInt(id))
      .query(`
        -- Bu versiyonda kapatılan (GecerlilikBitis set edilen) kayıtları bul
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
          -- Bu versiyonda tekrar aktif edilmemiş olmalı
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
        eklenen: version.EklenenSayisi || 0,
        guncellenen: version.GuncellenenSayisi || 0,
        silinen: version.SilinenSayisi || 0
      },
      eklenenler: addedResult.recordset,
      guncellenenler: updatedResult.recordset,
      silinenler: deletedResult.recordset
    }, 'Versiyon detayı başarıyla getirildi');
    
  } catch (err) {
    next(err);
  }
});

module.exports = router;

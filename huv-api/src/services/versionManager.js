// ============================================
// VERSION MANAGER SERVICE
// ============================================
// Liste versiyonlarını ve SCD Type 2'yi yönetme
// ============================================

const { getPool, sql } = require('../config/database');

// ============================================
// Yeni liste versiyonu oluştur
// ============================================
const createListeVersiyon = async (dosyaAdi, kayitSayisi, aciklama, kullaniciAdi = null, yuklemeTarihi = null, listeTipi = 'HUV') => {
  try {
    const pool = await getPool();
    
    // Kullanıcı adını belirle
    const yukleyenKullanici = kullaniciAdi || 
                              process.env.DEFAULT_USER || 
                              'system';
    
    // Yükleme tarihini belirle (parametre verilmemişse şimdi)
    const tarih = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    const result = await pool.request()
      .input('ListeTipi', sql.NVarChar, listeTipi)
      .input('YuklemeTarihi', sql.DateTime, tarih)
      .input('DosyaAdi', sql.NVarChar, dosyaAdi)
      .input('KayitSayisi', sql.Int, kayitSayisi)
      .input('Aciklama', sql.NVarChar, aciklama)
      .input('YukleyenKullanici', sql.NVarChar, yukleyenKullanici)
      .query(`
        INSERT INTO ListeVersiyon (
          ListeTipi, YuklemeTarihi, DosyaAdi, 
          KayitSayisi, Aciklama, YukleyenKullanici
        )
        OUTPUT INSERTED.VersionID
        VALUES (
          @ListeTipi, @YuklemeTarihi, @DosyaAdi,
          @KayitSayisi, @Aciklama, @YukleyenKullanici
        )
      `);
    
    return result.recordset[0].VersionID;
  } catch (error) {
    throw new Error(`Versiyon oluşturulamadı: ${error.message}`);
  }
};

// ============================================
// Mevcut HUV verilerini al
// Sadece Islemler tablosundaki aktif kayıtlar (AktifMi = 1)
// ============================================
const getMevcutHuvData = async () => {
  try {
    const pool = await getPool();
    
    const result = await pool.request()
      .query(`
        SELECT 
          IslemID,
          HuvKodu,
          IslemAdi,
          Birim,
          SutKodu,
          AnaDalKodu,
          UstBaslik,
          HiyerarsiSeviyesi,
          [Not]
        FROM HuvIslemler
        WHERE ListeTipi = 'HUV' AND AktifMi = 1
      `);
    
    return result.recordset;
  } catch (error) {
    throw new Error(`Mevcut veriler alınamadı: ${error.message}`);
  }
};

// ============================================
// İşlem güncelle (SCD Type 2 ile)
// ============================================
const updateIslemWithVersion = async (islemID, yeniData, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    // Transaction başlat (DEADLOCK PROTECTION)
    const transaction = pool.transaction();
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    
    try {
      // 1. Eski aktif versiyonu kapat (IslemVersionlar)
      await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .input('BitisTarihi', sql.Date, new Date(baslangicTarihi.getTime() - 86400000)) // 1 gün öncesi
        .query(`
          UPDATE IslemVersionlar
          SET 
            GecerlilikBitis = @BitisTarihi,
            AktifMi = 0
          WHERE IslemID = @IslemID AND AktifMi = 1
        `);
      
      // 2. Yeni versiyon ekle (IslemVersionlar)
      await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .input('HuvKodu', sql.Float, yeniData.HuvKodu)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Birim', sql.Float, yeniData.Birim)
        .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
        .input('Not', sql.NVarChar, yeniData.Not)
        .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
        .input('ListeVersiyonID', sql.Int, versionID)
        .input('DegisiklikSebebi', sql.NVarChar, 'HUV listesi güncellendi')
        .query(`
          INSERT INTO IslemVersionlar (
            IslemID, HuvKodu, IslemAdi, Birim, SutKodu, [Not],
            GecerlilikBaslangic, GecerlilikBitis, AktifMi, ListeVersiyonID, DegisiklikSebebi
          )
          VALUES (
            @IslemID, @HuvKodu, @IslemAdi, @Birim, @SutKodu, @Not,
            @GecerlilikBaslangic, NULL, 1, @ListeVersiyonID, @DegisiklikSebebi
          )
        `);
      
      // 3. Ana tablodaki kaydı güncelle (Islemler)
      await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Birim', sql.Float, yeniData.Birim)
        .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
        .input('Not', sql.NVarChar, yeniData.Not)
        .input('ListeVersiyonID', sql.Int, versionID)
        .query(`
          UPDATE HuvIslemler
          SET 
            IslemAdi = @IslemAdi,
            Birim = @Birim,
            SutKodu = @SutKodu,
            [Not] = @Not,
            ListeVersiyonID = @ListeVersiyonID,
            GuncellemeTarihiDate = GETDATE()
          WHERE IslemID = @IslemID
        `);
      
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    throw new Error(`İşlem güncellenemedi: ${error.message}`);
  }
};

// ============================================
// Yeni işlem ekle
// Eğer HUV kodu daha önce kullanılmışsa (silinmiş), eski IslemID'yi kullan
// ============================================
const addNewIslem = async (yeniData, versionID, yuklemeTarihi) => {
  const pool = await getPool();
  const transaction = pool.transaction();
  
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    
    // HUV kodu daha önce kullanılmış mı kontrol et (aktif veya pasif)
    const mevcutIslemResult = await transaction.request()
      .input('HuvKodu', sql.Float, yeniData.HuvKodu)
      .query(`
        SELECT TOP 1 IslemID, AktifMi
        FROM HuvIslemler 
        WHERE HuvKodu = @HuvKodu
        ORDER BY IslemID DESC
      `);
    
    let nextId;
    let yeniKayit = false;
    let reaktive = false;
    
    if (mevcutIslemResult.recordset.length > 0) {
      // Daha önce kullanılmış
      nextId = mevcutIslemResult.recordset[0].IslemID;
      const aktifMi = mevcutIslemResult.recordset[0].AktifMi;
      
      if (aktifMi === 0) {
        reaktive = true;
        
        await transaction.request()
          .input('IslemID', sql.Int, nextId)
          .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
          .input('Birim', sql.Float, yeniData.Birim)
          .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
          .input('Not', sql.NVarChar, yeniData.Not)
          .input('ListeVersiyonID', sql.Int, versionID)
          .query(`
            UPDATE HuvIslemler
            SET IslemAdi = @IslemAdi,
                Birim = @Birim,
                SutKodu = @SutKodu,
                [Not] = @Not,
                ListeVersiyonID = @ListeVersiyonID,
                AktifMi = 1,
                GuncellemeTarihiDate = GETDATE()
            WHERE IslemID = @IslemID
          `);
      } else {
        // Mevcut aktif kayıt kullanılıyor
      }
    } else {
      const maxIdResult = await transaction.request().query('SELECT ISNULL(MAX(IslemID), 0) + 1 as NextID FROM HuvIslemler WITH (TABLOCKX)');
      nextId = maxIdResult.recordset[0].NextID;
      yeniKayit = true;
    }
    
    // Tarihleri hazırla
    const eklemeTarihi = yeniData.EklemeTarihi ? new Date(yeniData.EklemeTarihi) : new Date();
    const guncellemeTarihi = yeniData.GuncellemeTarihi ? new Date(yeniData.GuncellemeTarihi) : new Date();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    // 1. Islemler tablosuna ekle (sadece yeni kayıt ise)
    if (yeniKayit) {
      await transaction.request()
        .input('IslemID', sql.Int, nextId)
        .input('HuvKodu', sql.Float, yeniData.HuvKodu)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Birim', sql.Float, yeniData.Birim)
        .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
        .input('AnaDalKodu', sql.Int, yeniData.AnaDalKodu)
        .input('UstBaslik', sql.NVarChar, yeniData.UstBaslik)
        .input('HiyerarsiSeviyesi', sql.Int, yeniData.HiyerarsiSeviyesi)
        .input('Not', sql.NVarChar, yeniData.Not)
        .input('ListeVersiyonID', sql.Int, versionID)
        .input('ListeTipi', sql.NVarChar, 'HUV')
        .input('EklemeTarihi', sql.Date, eklemeTarihi)
        .input('GuncellemeTarihi', sql.Date, guncellemeTarihi)
        .query(`
          INSERT INTO HuvIslemler (
            IslemID, HuvKodu, IslemAdi, Birim, SutKodu, AnaDalKodu,
            UstBaslik, HiyerarsiSeviyesi, [Not],
            ListeVersiyonID, ListeTipi, EklemeTarihiDate, GuncellemeTarihiDate, AktifMi
          )
          VALUES (
            @IslemID, @HuvKodu, @IslemAdi, @Birim, @SutKodu, @AnaDalKodu,
            @UstBaslik, @HiyerarsiSeviyesi, @Not,
            @ListeVersiyonID, @ListeTipi, @EklemeTarihi, @GuncellemeTarihi, 1
          )
        `);
    }
    
    // 2. IslemVersionlar tablosuna yeni versiyon kaydı ekle
    await transaction.request()
      .input('IslemID', sql.Int, nextId)
      .input('HuvKodu', sql.Float, yeniData.HuvKodu)
      .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
      .input('Birim', sql.Float, yeniData.Birim)
      .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
      .input('Not', sql.NVarChar, yeniData.Not)
      .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
      .input('ListeVersiyonID', sql.Int, versionID)
      .input('DegisiklikSebebi', sql.NVarChar, yeniKayit ? 'Yeni işlem eklendi' : (reaktive ? 'Pasif işlem tekrar aktif edildi' : 'Silinmiş işlem tekrar eklendi'))
      .query(`
        INSERT INTO IslemVersionlar (
          IslemID, HuvKodu, IslemAdi, Birim, SutKodu, [Not],
          GecerlilikBaslangic, GecerlilikBitis, AktifMi, ListeVersiyonID, DegisiklikSebebi
        )
        VALUES (
          @IslemID, @HuvKodu, @IslemAdi, @Birim, @SutKodu, @Not,
          @GecerlilikBaslangic, NULL, 1, @ListeVersiyonID, @DegisiklikSebebi
        )
      `);
    
    // 3. Audit kaydı ekle
    await transaction.request()
      .input('IslemID', sql.Int, nextId)
      .input('IslemTipi', sql.NVarChar, 'INSERT')
      .input('EskiBirim', sql.Float, null)
      .input('YeniBirim', sql.Float, yeniData.Birim)
      .input('DegistirenKullanici', sql.NVarChar, 'system')
      .input('Aciklama', sql.NVarChar, yeniKayit 
        ? `Yeni işlem eklendi: ${yeniData.IslemAdi} (HUV: ${yeniData.HuvKodu})`
        : (reaktive 
          ? `Pasif işlem tekrar aktif edildi: ${yeniData.IslemAdi} (HUV: ${yeniData.HuvKodu})`
          : `Silinmiş işlem tekrar eklendi: ${yeniData.IslemAdi} (HUV: ${yeniData.HuvKodu})`))
      .query(`
        INSERT INTO IslemAudit (IslemID, IslemTipi, EskiBirim, YeniBirim, DegisiklikTarihi, DegistirenKullanici, Aciklama)
        VALUES (@IslemID, @IslemTipi, @EskiBirim, @YeniBirim, GETDATE(), @DegistirenKullanici, @Aciklama)
      `);
    
    
    await transaction.commit();
    return nextId;
  } catch (error) {
    await transaction.rollback();
    throw new Error(`Yeni işlem eklenemedi: ${error.message}`);
  }
};

// ============================================
// İşlemi pasif yap (Excel'den silinenleri işaretlemek için)
// Fiziksel silme yerine AktifMi = 0 yapıyoruz
// ============================================
const deactivateIslem = async (islemID, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const transaction = pool.transaction();
    await transaction.begin();

    const silinmeTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    const bitisTarihi = new Date(silinmeTarihi.getTime() - 86400000); // 1 gün öncesi

    try {
      // Önce işlem bilgisini al (audit için)
      const islemResult = await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .query('SELECT HuvKodu, IslemAdi, Birim, SutKodu, [Not] FROM HuvIslemler WHERE IslemID = @IslemID');

      if (islemResult.recordset.length > 0) {
        const islem = islemResult.recordset[0];

        // 1. IslemVersionlar'daki aktif versiyonu kapat
        await transaction.request()
          .input('IslemID', sql.Int, islemID)
          .input('BitisTarihi', sql.Date, bitisTarihi)
          .query(`
            UPDATE IslemVersionlar
            SET GecerlilikBitis = @BitisTarihi, AktifMi = 0
            WHERE IslemID = @IslemID AND AktifMi = 1
          `);

        // 2. Silinen işlem için IslemVersionlar'a kayıt ekle
        await transaction.request()
          .input('IslemID', sql.Int, islemID)
          .input('ListeVersiyonID', sql.Int, versionID)
          .input('HuvKodu', sql.Float, islem.HuvKodu)
          .input('IslemAdi', sql.NVarChar, islem.IslemAdi)
          .input('Birim', sql.Float, islem.Birim)
          .input('SutKodu', sql.NVarChar, islem.SutKodu)
          .input('Not', sql.NVarChar, islem.Not)
          .input('GecerlilikBaslangic', sql.Date, silinmeTarihi)
          .input('GecerlilikBitis', sql.Date, bitisTarihi)
          .input('DegisiklikSebebi', sql.NVarChar, 'İşlem Excel\'den kaldırıldı')
          .query(`
            INSERT INTO IslemVersionlar (
              IslemID, ListeVersiyonID, HuvKodu, IslemAdi, Birim, SutKodu, [Not],
              GecerlilikBaslangic, GecerlilikBitis, AktifMi, DegisiklikSebebi,
              OlusturanKullanici, OlusturmaTarihi
            ) VALUES (
              @IslemID, @ListeVersiyonID, @HuvKodu, @IslemAdi, @Birim, @SutKodu, @Not,
              @GecerlilikBaslangic, @GecerlilikBitis, 0, @DegisiklikSebebi,
              'system', GETDATE()
            )
          `);

        // 3. Islemler'de AktifMi = 0 yap
        await transaction.request()
          .input('IslemID', sql.Int, islemID)
          .query(`UPDATE HuvIslemler SET AktifMi = 0 WHERE IslemID = @IslemID`);

        // 4. Audit kaydı ekle
        await transaction.request()
          .input('IslemID', sql.Int, islemID)
          .input('IslemTipi', sql.NVarChar, 'DELETE')
          .input('EskiBirim', sql.Float, islem.Birim)
          .input('YeniBirim', sql.Float, null)
          .input('DegistirenKullanici', sql.NVarChar, 'system')
          .input('Aciklama', sql.NVarChar, `İşlem Excel'den kaldırıldı: ${islem.IslemAdi} (HUV: ${islem.HuvKodu})`)
          .query(`
            INSERT INTO IslemAudit (IslemID, IslemTipi, EskiBirim, YeniBirim, DegisiklikTarihi, DegistirenKullanici, Aciklama)
            VALUES (@IslemID, @IslemTipi, @EskiBirim, @YeniBirim, GETDATE(), @DegistirenKullanici, @Aciklama)
          `);
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    throw new Error(`İşlem pasif yapılamadı: ${error.message}`);
  }
}

// ============================================
// Değişmeyen işlem için versiyon kaydı oluştur
// ============================================
const copyUnchangedIslemToVersion = async (islemID, mevcutData, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // 1. Eski aktif versiyonu kapat (IslemVersionlar)
      await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .input('BitisTarihi', sql.Date, new Date(baslangicTarihi.getTime() - 86400000)) // 1 gün öncesi
        .query(`
          UPDATE IslemVersionlar
          SET 
            GecerlilikBitis = @BitisTarihi,
            AktifMi = 0
          WHERE IslemID = @IslemID AND AktifMi = 1
        `);
      
      // 2. Aynı veriyle yeni versiyon ekle (IslemVersionlar)
      await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .input('HuvKodu', sql.Float, mevcutData.HuvKodu)
        .input('IslemAdi', sql.NVarChar, mevcutData.IslemAdi)
        .input('Birim', sql.Float, mevcutData.Birim)
        .input('SutKodu', sql.NVarChar, mevcutData.SutKodu)
        .input('Not', sql.NVarChar, mevcutData.Not)
        .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
        .input('ListeVersiyonID', sql.Int, versionID)
        .input('DegisiklikSebebi', sql.NVarChar, 'Değişiklik yok')
        .query(`
          INSERT INTO IslemVersionlar (
            IslemID, HuvKodu, IslemAdi, Birim, SutKodu, [Not],
            GecerlilikBaslangic, GecerlilikBitis, AktifMi, ListeVersiyonID, DegisiklikSebebi
          )
          VALUES (
            @IslemID, @HuvKodu, @IslemAdi, @Birim, @SutKodu, @Not,
            @GecerlilikBaslangic, NULL, 1, @ListeVersiyonID, @DegisiklikSebebi
          )
        `);
      
      // 3. Ana tabloda sadece ListeVersiyonID güncelle
      await transaction.request()
        .input('IslemID', sql.Int, islemID)
        .input('ListeVersiyonID', sql.Int, versionID)
        .query(`
          UPDATE HuvIslemler
          SET ListeVersiyonID = @ListeVersiyonID
          WHERE IslemID = @IslemID
        `);
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    throw new Error(`Değişmeyen işlem kopyalanamadı: ${error.message}`);
  }
};

module.exports = {
  createListeVersiyon,
  getMevcutHuvData,
  updateIslemWithVersion,
  addNewIslem,
  deactivateIslem,
  copyUnchangedIslemToVersion
};

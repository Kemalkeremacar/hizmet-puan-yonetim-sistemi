// ============================================
// SUT VERSION MANAGER SERVICE
// ============================================
// SUT liste versiyonlarını ve SCD Type 2'yi yönetme
// ============================================

const { getPool, sql } = require('../config/database');

// ============================================
// Mevcut SUT verilerini al (aktif kayıtlar)
// ============================================
const getMevcutSutData = async () => {
  try {
    const pool = await getPool();
    
    const result = await pool.request()
      .query(`
        SELECT 
          SutID,
          SutKodu,
          IslemAdi,
          Puan,
          Aciklama,
          AnaBaslikNo,
          HiyerarsiID
        FROM SutIslemler
        WHERE AktifMi = 1
      `);
    
    return result.recordset;
  } catch (error) {
    throw new Error(`Mevcut SUT verileri alınamadı: ${error.message}`);
  }
};

// ============================================
// SUT işlemi güncelle (SCD Type 2 ile)
// ============================================
const updateSutIslemWithVersion = async (sutID, yeniData, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    const bitisTarihi = new Date(baslangicTarihi);
    bitisTarihi.setDate(bitisTarihi.getDate() - 1);
    
    // Transaction başlat (DEADLOCK PROTECTION)
    const transaction = pool.transaction();
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    
    try {
      // 1. Eski versiyonları kapat (GecerlilikBitis set et)
      await transaction.request()
        .input('SutID', sql.Int, sutID)
        .input('BitisTarihi', sql.Date, bitisTarihi)
        .query(`
          UPDATE SutIslemVersionlar
          SET 
            GecerlilikBitis = @BitisTarihi,
            AktifMi = 0
          WHERE SutID = @SutID 
            AND AktifMi = 1
            AND GecerlilikBitis IS NULL
        `);
      
      // 2. Yeni versiyon kaydı oluştur
      const degisiklikSebebi = [];
      
      // Mevcut veriyi al
      const mevcutResult = await transaction.request()
        .input('SutID', sql.Int, sutID)
        .query(`
          SELECT IslemAdi, Puan, Aciklama, AnaBaslikNo, HiyerarsiID
          FROM SutIslemler
          WHERE SutID = @SutID
        `);
      
      if (mevcutResult.recordset.length > 0) {
        const mevcut = mevcutResult.recordset[0];
        
        if (mevcut.Puan !== yeniData.Puan) {
          degisiklikSebebi.push(`Puan: ${mevcut.Puan} → ${yeniData.Puan}`);
        }
        if (mevcut.IslemAdi !== yeniData.IslemAdi) {
          degisiklikSebebi.push('İşlem Adı değişti');
        }
        if (mevcut.Aciklama !== yeniData.Aciklama) {
          degisiklikSebebi.push('Açıklama değişti');
        }
        if (mevcut.AnaBaslikNo !== yeniData.AnaBaslikNo) {
          degisiklikSebebi.push('Ana Başlık değişti');
        }
        if (mevcut.HiyerarsiID !== yeniData.HiyerarsiID) {
          degisiklikSebebi.push('Hiyerarşi değişti');
        }
      }
      
      // DegisiklikSebebi: Eğer detaylı değişiklik varsa onu kullan, yoksa "SUT listesi güncellendi"
      const degisiklikSebebiText = degisiklikSebebi.length > 0 
        ? `SUT listesi güncellendi: ${degisiklikSebebi.join(', ')}`
        : 'SUT listesi güncellendi';
      
      await transaction.request()
        .input('SutID', sql.Int, sutID)
        .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Puan', sql.Float, yeniData.Puan)
        .input('Aciklama', sql.NVarChar, yeniData.Aciklama)
        .input('AnaBaslikNo', sql.Int, yeniData.AnaBaslikNo)
        .input('HiyerarsiID', sql.Int, yeniData.HiyerarsiID)
        .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
        .input('ListeVersiyonID', sql.Int, versionID)
        .input('DegisiklikSebebi', sql.NVarChar, degisiklikSebebiText)
        .query(`
          INSERT INTO SutIslemVersionlar (
            SutID, SutKodu, IslemAdi, Puan, Aciklama,
            AnaBaslikNo, HiyerarsiID,
            GecerlilikBaslangic, GecerlilikBitis,
            AktifMi, ListeVersiyonID, DegisiklikSebebi,
            OlusturanKullanici, OlusturmaTarihi
          )
          VALUES (
            @SutID, @SutKodu, @IslemAdi, @Puan, @Aciklama,
            @AnaBaslikNo, @HiyerarsiID,
            @GecerlilikBaslangic, NULL,
            1, @ListeVersiyonID, @DegisiklikSebebi,
            SYSTEM_USER, GETDATE()
          )
        `);
      
      // 3. Ana tablodaki kaydı güncelle
      await transaction.request()
        .input('SutID', sql.Int, sutID)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Puan', sql.Float, yeniData.Puan)
        .input('Aciklama', sql.NVarChar, yeniData.Aciklama)
        .input('AnaBaslikNo', sql.Int, yeniData.AnaBaslikNo)
        .input('HiyerarsiID', sql.Int, yeniData.HiyerarsiID)
        .input('ListeVersiyonID', sql.Int, versionID)
        .query(`
          UPDATE SutIslemler
          SET 
            IslemAdi = @IslemAdi,
            Puan = @Puan,
            Aciklama = @Aciklama,
            AnaBaslikNo = @AnaBaslikNo,
            HiyerarsiID = @HiyerarsiID,
            ListeVersiyonID = @ListeVersiyonID,
            GuncellemeTarihi = GETDATE()
          WHERE SutID = @SutID
        `);
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    throw new Error(`SUT işlem güncellenemedi: ${error.message}`);
  }
};

// ============================================
// Yeni SUT işlem ekle
// ============================================
const addNewSutIslem = async (yeniData, versionID, yuklemeTarihi) => {
  const pool = await getPool();
  const transaction = pool.transaction();
  const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
  
  try {
    await transaction.begin();
    
    // SUT kodu daha önce kullanılmış mı kontrol et
    const mevcutIslemResult = await transaction.request()
      .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
      .query(`
        SELECT TOP 1 SutID, AktifMi
        FROM SutIslemler 
        WHERE SutKodu = @SutKodu
        ORDER BY SutID DESC
      `);
    
    let sutID;
    let yeniKayit = false;
    let reaktive = false;
    
    if (mevcutIslemResult.recordset.length > 0) {
      // Daha önce kullanılmış
      sutID = mevcutIslemResult.recordset[0].SutID;
      const aktifMi = mevcutIslemResult.recordset[0].AktifMi;
      
      if (aktifMi === 0) {
        reaktive = true;
        
        // Pasif kaydı aktif yap ve güncelle
        await transaction.request()
          .input('SutID', sql.Int, sutID)
          .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
          .input('Puan', sql.Float, yeniData.Puan)
          .input('Aciklama', sql.NVarChar, yeniData.Aciklama)
          .input('AnaBaslikNo', sql.Int, yeniData.AnaBaslikNo)
          .input('HiyerarsiID', sql.Int, yeniData.HiyerarsiID)
          .input('ListeVersiyonID', sql.Int, versionID)
          .query(`
            UPDATE SutIslemler
            SET IslemAdi = @IslemAdi,
                Puan = @Puan,
                Aciklama = @Aciklama,
                AnaBaslikNo = @AnaBaslikNo,
                HiyerarsiID = @HiyerarsiID,
                ListeVersiyonID = @ListeVersiyonID,
                AktifMi = 1,
                GuncellemeTarihi = GETDATE()
            WHERE SutID = @SutID
          `);
        
        // Versiyon kaydı oluştur (reaktivasyon)
        await transaction.request()
          .input('SutID', sql.Int, sutID)
          .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
          .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
          .input('Puan', sql.Float, yeniData.Puan)
          .input('Aciklama', sql.NVarChar, yeniData.Aciklama)
          .input('AnaBaslikNo', sql.Int, yeniData.AnaBaslikNo)
          .input('HiyerarsiID', sql.Int, yeniData.HiyerarsiID)
          .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
          .input('ListeVersiyonID', sql.Int, versionID)
          .query(`
            INSERT INTO SutIslemVersionlar (
              SutID, SutKodu, IslemAdi, Puan, Aciklama,
              AnaBaslikNo, HiyerarsiID,
              GecerlilikBaslangic, GecerlilikBitis,
              AktifMi, ListeVersiyonID, DegisiklikSebebi,
              OlusturanKullanici, OlusturmaTarihi
            )
            VALUES (
              @SutID, @SutKodu, @IslemAdi, @Puan, @Aciklama,
              @AnaBaslikNo, @HiyerarsiID,
              @GecerlilikBaslangic, NULL,
              1, @ListeVersiyonID, 'Reaktivasyon',
              SYSTEM_USER, GETDATE()
            )
          `);
      } else {
        // Mevcut aktif kayıt var - güncelle
        await updateSutIslemWithVersion(sutID, yeniData, versionID, yuklemeTarihi);
      }
    } else {
      // Yeni kayıt
      const insertResult = await transaction.request()
        .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Puan', sql.Float, yeniData.Puan)
        .input('Aciklama', sql.NVarChar, yeniData.Aciklama)
        .input('AnaBaslikNo', sql.Int, yeniData.AnaBaslikNo)
        .input('HiyerarsiID', sql.Int, yeniData.HiyerarsiID)
        .input('ListeVersiyonID', sql.Int, versionID)
        .query(`
          INSERT INTO SutIslemler (
            SutKodu, IslemAdi, Puan, Aciklama,
            AnaBaslikNo, HiyerarsiID,
            ListeVersiyonID, AktifMi, OlusturmaTarihi
          )
          OUTPUT INSERTED.SutID
          VALUES (
            @SutKodu, @IslemAdi, @Puan, @Aciklama,
            @AnaBaslikNo, @HiyerarsiID,
            @ListeVersiyonID, 1, GETDATE()
          )
        `);
      
      sutID = insertResult.recordset[0].SutID;
      yeniKayit = true;
      
      // Versiyon kaydı oluştur (ilk kayıt)
      await transaction.request()
        .input('SutID', sql.Int, sutID)
        .input('SutKodu', sql.NVarChar, yeniData.SutKodu)
        .input('IslemAdi', sql.NVarChar, yeniData.IslemAdi)
        .input('Puan', sql.Float, yeniData.Puan)
        .input('Aciklama', sql.NVarChar, yeniData.Aciklama)
        .input('AnaBaslikNo', sql.Int, yeniData.AnaBaslikNo)
        .input('HiyerarsiID', sql.Int, yeniData.HiyerarsiID)
        .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
        .input('ListeVersiyonID', sql.Int, versionID)
        .query(`
          INSERT INTO SutIslemVersionlar (
            SutID, SutKodu, IslemAdi, Puan, Aciklama,
            AnaBaslikNo, HiyerarsiID,
            GecerlilikBaslangic, GecerlilikBitis,
            AktifMi, ListeVersiyonID, DegisiklikSebebi,
            OlusturanKullanici, OlusturmaTarihi
          )
          VALUES (
            @SutID, @SutKodu, @IslemAdi, @Puan, @Aciklama,
            @AnaBaslikNo, @HiyerarsiID,
            @GecerlilikBaslangic, NULL,
            1, @ListeVersiyonID, 'Yeni işlem eklendi',
            SYSTEM_USER, GETDATE()
          )
        `);
    }
    
    await transaction.commit();
    return sutID;
  } catch (error) {
    await transaction.rollback();
    throw new Error(`Yeni SUT işlem eklenemedi: ${error.message}`);
  }
};

// ============================================
// SUT işlemi pasif yap (SCD Type 2 ile)
// ============================================
const deactivateSutIslem = async (sutID, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const transaction = pool.transaction();
    const bitisTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    bitisTarihi.setDate(bitisTarihi.getDate() - 1);
    
    await transaction.begin();

    try {
      // 1. Eski versiyonu kapat
      await transaction.request()
        .input('SutID', sql.Int, sutID)
        .input('BitisTarihi', sql.Date, bitisTarihi)
        .query(`
          UPDATE SutIslemVersionlar
          SET 
            GecerlilikBitis = @BitisTarihi,
            AktifMi = 0
          WHERE SutID = @SutID 
            AND AktifMi = 1
            AND GecerlilikBitis IS NULL
        `);
      
      // 2. Ana tabloda işlemi pasif yap
      await transaction.request()
        .input('SutID', sql.Int, sutID)
        .query(`
          UPDATE SutIslemler
          SET AktifMi = 0, GuncellemeTarihi = GETDATE()
          WHERE SutID = @SutID
        `);

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    throw new Error(`SUT işlem pasif yapılamadı: ${error.message}`);
  }
};

module.exports = {
  getMevcutSutData,
  updateSutIslemWithVersion,
  addNewSutIslem,
  deactivateSutIslem
};

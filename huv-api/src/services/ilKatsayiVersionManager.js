// ============================================
// İL KATSAYILARI VERSION MANAGER SERVICE
// ============================================
// İl katsayıları versiyon yönetimi (SCD Type 2)
// ============================================

const { getPool, sql } = require('../config/database');

// ============================================
// Mevcut il katsayı verilerini al
// Sadece aktif kayıtlar (AktifMi = 1)
// ============================================
const getMevcutIlKatsayiData = async () => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        IlKatsayiID,
        IlAdi,
        PlakaKodu,
        Katsayi,
        DonemBaslangic,
        DonemBitis,
        AktifMi
      FROM IlKatsayilari
      WHERE AktifMi = 1
      ORDER BY IlAdi
    `);
    
    return result.recordset;
  } catch (error) {
    throw new Error(`Mevcut il katsayı verileri alınamadı: ${error.message}`);
  }
};

// ============================================
// Yeni il katsayısı ekle
// ============================================
const addNewIlKatsayi = async (data, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    // 1. Ana tabloya ekle
    const insertResult = await pool.request()
      .input('IlAdi', sql.NVarChar, data.IlAdi)
      .input('PlakaKodu', sql.Int, data.PlakaKodu)
      .input('Katsayi', sql.Decimal(18, 2), data.Katsayi)
      .input('DonemBaslangic', sql.Date, data.DonemBaslangic ? new Date(data.DonemBaslangic) : null)
      .input('DonemBitis', sql.Date, data.DonemBitis ? new Date(data.DonemBitis) : null)
      .input('AktifMi', sql.Bit, 1)
      .query(`
        INSERT INTO IlKatsayilari (
          IlAdi, PlakaKodu, Katsayi, 
          DonemBaslangic, DonemBitis, AktifMi
        )
        OUTPUT INSERTED.IlKatsayiID
        VALUES (
          @IlAdi, @PlakaKodu, @Katsayi,
          @DonemBaslangic, @DonemBitis, @AktifMi
        )
      `);
    
    const ilKatsayiID = insertResult.recordset[0].IlKatsayiID;
    
    // 2. Versiyon tablosuna ekle
    await pool.request()
      .input('IlKatsayiID', sql.Int, ilKatsayiID)
      .input('IlAdi', sql.NVarChar, data.IlAdi)
      .input('PlakaKodu', sql.Int, data.PlakaKodu)
      .input('Katsayi', sql.Decimal(18, 2), data.Katsayi)
      .input('DonemBaslangic', sql.Date, data.DonemBaslangic ? new Date(data.DonemBaslangic) : null)
      .input('DonemBitis', sql.Date, data.DonemBitis ? new Date(data.DonemBitis) : null)
      .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
      .input('GecerlilikBitis', sql.Date, null)
      .input('AktifMi', sql.Bit, 1)
      .input('ListeVersiyonID', sql.Int, versionID)
      .input('DegisiklikSebebi', sql.NVarChar, 'Yeni il katsayısı eklendi')
      .input('OlusturanKullanici', sql.NVarChar, 'system')
      .query(`
        INSERT INTO IlKatsayiVersionlar (
          IlKatsayiID, IlAdi, PlakaKodu, Katsayi,
          DonemBaslangic, DonemBitis,
          GecerlilikBaslangic, GecerlilikBitis, AktifMi,
          ListeVersiyonID, DegisiklikSebebi, OlusturanKullanici
        )
        VALUES (
          @IlKatsayiID, @IlAdi, @PlakaKodu, @Katsayi,
          @DonemBaslangic, @DonemBitis,
          @GecerlilikBaslangic, @GecerlilikBitis, @AktifMi,
          @ListeVersiyonID, @DegisiklikSebebi, @OlusturanKullanici
        )
      `);
    
    return ilKatsayiID;
  } catch (error) {
    throw new Error(`İl katsayısı eklenemedi: ${error.message}`);
  }
};

// ============================================
// İl katsayısını güncelle (SCD Type 2)
// ============================================
const updateIlKatsayiWithVersion = async (ilKatsayiID, yeniData, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    const bitisTarihi = new Date(baslangicTarihi);
    bitisTarihi.setDate(bitisTarihi.getDate() - 1);
    
    // Transaction başlat
    const transaction = pool.transaction();
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    
    try {
      // 1. Eski versiyonları kapat
      await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .input('BitisTarihi', sql.Date, bitisTarihi)
        .query(`
          UPDATE IlKatsayiVersionlar
          SET 
            GecerlilikBitis = @BitisTarihi,
            AktifMi = 0
          WHERE IlKatsayiID = @IlKatsayiID 
            AND AktifMi = 1
            AND GecerlilikBitis IS NULL
        `);
      
      // 2. Ana tabloyu güncelle
      await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .input('IlAdi', sql.NVarChar, yeniData.IlAdi)
        .input('PlakaKodu', sql.Int, yeniData.PlakaKodu)
        .input('Katsayi', sql.Decimal(18, 2), yeniData.Katsayi)
        .input('DonemBaslangic', sql.Date, yeniData.DonemBaslangic ? new Date(yeniData.DonemBaslangic) : null)
        .input('DonemBitis', sql.Date, yeniData.DonemBitis ? new Date(yeniData.DonemBitis) : null)
        .input('GuncellemeTarihi', sql.DateTime, new Date())
        .query(`
          UPDATE IlKatsayilari
          SET 
            IlAdi = @IlAdi,
            PlakaKodu = @PlakaKodu,
            Katsayi = @Katsayi,
            DonemBaslangic = @DonemBaslangic,
            DonemBitis = @DonemBitis,
            GuncellemeTarihi = @GuncellemeTarihi
          WHERE IlKatsayiID = @IlKatsayiID
        `);
      
      // 3. Yeni versiyon kaydı oluştur
      // Değişiklik sebebini belirle
      const mevcutResult = await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .query(`
          SELECT TOP 1 Katsayi, DonemBaslangic, DonemBitis
          FROM IlKatsayiVersionlar
          WHERE IlKatsayiID = @IlKatsayiID
            AND AktifMi = 0
          ORDER BY GecerlilikBitis DESC
        `);
      
      let degisiklikSebebi = 'İl katsayısı güncellendi';
      if (mevcutResult.recordset.length > 0) {
        const mevcut = mevcutResult.recordset[0];
        const degisenler = [];
        if (Math.abs(mevcut.Katsayi - yeniData.Katsayi) > 0.01) {
          degisenler.push('Katsayı');
        }
        if (mevcut.DonemBaslangic !== yeniData.DonemBaslangic || mevcut.DonemBitis !== yeniData.DonemBitis) {
          degisenler.push('Dönem');
        }
        if (degisenler.length > 0) {
          degisiklikSebebi = `İl katsayısı güncellendi (${degisenler.join(', ')} değişti)`;
        }
      }
      
      await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .input('IlAdi', sql.NVarChar, yeniData.IlAdi)
        .input('PlakaKodu', sql.Int, yeniData.PlakaKodu)
        .input('Katsayi', sql.Decimal(18, 2), yeniData.Katsayi)
        .input('DonemBaslangic', sql.Date, yeniData.DonemBaslangic ? new Date(yeniData.DonemBaslangic) : null)
        .input('DonemBitis', sql.Date, yeniData.DonemBitis ? new Date(yeniData.DonemBitis) : null)
        .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
        .input('GecerlilikBitis', sql.Date, null)
        .input('AktifMi', sql.Bit, 1)
        .input('ListeVersiyonID', sql.Int, versionID)
        .input('DegisiklikSebebi', sql.NVarChar, degisiklikSebebi)
        .input('OlusturanKullanici', sql.NVarChar, 'system')
        .query(`
          INSERT INTO IlKatsayiVersionlar (
            IlKatsayiID, IlAdi, PlakaKodu, Katsayi,
            DonemBaslangic, DonemBitis,
            GecerlilikBaslangic, GecerlilikBitis, AktifMi,
            ListeVersiyonID, DegisiklikSebebi, OlusturanKullanici
          )
          VALUES (
            @IlKatsayiID, @IlAdi, @PlakaKodu, @Katsayi,
            @DonemBaslangic, @DonemBitis,
            @GecerlilikBaslangic, @GecerlilikBitis, @AktifMi,
            @ListeVersiyonID, @DegisiklikSebebi, @OlusturanKullanici
          )
        `);
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    throw new Error(`İl katsayısı güncellenemedi: ${error.message}`);
  }
};

// ============================================
// İl katsayısını pasif yap (sil)
// ============================================
const deactivateIlKatsayi = async (ilKatsayiID, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const bitisTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    // Transaction başlat
    const transaction = pool.transaction();
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    
    try {
      // 1. Ana tabloda pasif yap
      await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .query(`
          UPDATE IlKatsayilari
          SET AktifMi = 0
          WHERE IlKatsayiID = @IlKatsayiID
        `);
      
      // 2. Versiyon tablosunda kapat
      await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .input('BitisTarihi', sql.Date, bitisTarihi)
        .query(`
          UPDATE IlKatsayiVersionlar
          SET 
            GecerlilikBitis = @BitisTarihi,
            AktifMi = 0
          WHERE IlKatsayiID = @IlKatsayiID 
            AND AktifMi = 1
            AND GecerlilikBitis IS NULL
        `);
      
      // 3. Yeni versiyon kaydı oluştur (silme kaydı)
      await transaction.request()
        .input('IlKatsayiID', sql.Int, ilKatsayiID)
        .input('ListeVersiyonID', sql.Int, versionID)
        .input('BitisTarihi', sql.Date, bitisTarihi)
        .query(`
          INSERT INTO IlKatsayiVersionlar (
            IlKatsayiID, IlAdi, PlakaKodu, Katsayi,
            DonemBaslangic, DonemBitis,
            GecerlilikBaslangic, GecerlilikBitis, AktifMi,
            ListeVersiyonID, DegisiklikSebebi, OlusturanKullanici
          )
          SELECT 
            IlKatsayiID, IlAdi, PlakaKodu, Katsayi,
            DonemBaslangic, DonemBitis,
            @BitisTarihi, @BitisTarihi, 0,
            @ListeVersiyonID, 'İl katsayısı silindi', 'system'
          FROM IlKatsayilari
          WHERE IlKatsayiID = @IlKatsayiID
        `);
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    throw new Error(`İl katsayısı pasif yapılamadı: ${error.message}`);
  }
};

// ============================================
// Değişmeyen il katsayısını yeni versiyona kopyala
// ============================================
const copyUnchangedIlKatsayiToVersion = async (ilKatsayiID, mevcutData, versionID, yuklemeTarihi) => {
  try {
    const pool = await getPool();
    const baslangicTarihi = yuklemeTarihi ? new Date(yuklemeTarihi) : new Date();
    
    await pool.request()
      .input('IlKatsayiID', sql.Int, ilKatsayiID)
      .input('IlAdi', sql.NVarChar, mevcutData.IlAdi)
      .input('PlakaKodu', sql.Int, mevcutData.PlakaKodu)
      .input('Katsayi', sql.Decimal(18, 2), mevcutData.Katsayi)
      .input('DonemBaslangic', sql.Date, mevcutData.DonemBaslangic ? new Date(mevcutData.DonemBaslangic) : null)
      .input('DonemBitis', sql.Date, mevcutData.DonemBitis ? new Date(mevcutData.DonemBitis) : null)
      .input('GecerlilikBaslangic', sql.Date, baslangicTarihi)
      .input('GecerlilikBitis', sql.Date, null)
      .input('AktifMi', sql.Bit, 1)
      .input('ListeVersiyonID', sql.Int, versionID)
      .input('DegisiklikSebebi', sql.NVarChar, 'Değişiklik yok')
      .input('OlusturanKullanici', sql.NVarChar, 'system')
      .query(`
        INSERT INTO IlKatsayiVersionlar (
          IlKatsayiID, IlAdi, PlakaKodu, Katsayi,
          DonemBaslangic, DonemBitis,
          GecerlilikBaslangic, GecerlilikBitis, AktifMi,
          ListeVersiyonID, DegisiklikSebebi, OlusturanKullanici
        )
        VALUES (
          @IlKatsayiID, @IlAdi, @PlakaKodu, @Katsayi,
          @DonemBaslangic, @DonemBitis,
          @GecerlilikBaslangic, @GecerlilikBitis, @AktifMi,
          @ListeVersiyonID, @DegisiklikSebebi, @OlusturanKullanici
        )
      `);
  } catch (error) {
    throw new Error(`İl katsayısı kopyalanamadı: ${error.message}`);
  }
};

module.exports = {
  getMevcutIlKatsayiData,
  addNewIlKatsayi,
  updateIlKatsayiWithVersion,
  deactivateIlKatsayi,
  copyUnchangedIlKatsayiToVersion
};

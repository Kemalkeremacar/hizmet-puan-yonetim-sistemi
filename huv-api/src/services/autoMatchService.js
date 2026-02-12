// ============================================
// AUTO MATCH SERVICE
// ============================================
// HUV import sırasında SutKodu'nu otomatik eşleştirme
// ============================================

const { getPool, sql } = require('../config/database');

// ============================================
// HUV işleminin SutKodu'nu otomatik eşleştir
// Excel'den gelen SutKodu'nu HuvSutEslestirme tablosuna ekle
// ============================================
const autoMatchSutKodu = async (islemID, sutKodu, transaction = null) => {
  try {
    if (!sutKodu || sutKodu.trim() === '') {
      return { matched: false, reason: 'SutKodu boş' };
    }

    const pool = transaction || await getPool();
    const request = transaction ? transaction.request() : pool.request();

    // 1. SUT kodunu bul
    const sutResult = await request
      .input('sutKodu', sql.NVarChar, sutKodu.trim())
      .query(`
        SELECT SutID, SutKodu, IslemAdi, Puan
        FROM SutIslemler
        WHERE SutKodu = @sutKodu AND AktifMi = 1
      `);

    if (sutResult.recordset.length === 0) {
      return { 
        matched: false, 
        reason: `SUT kodu bulunamadı: ${sutKodu}`,
        sutKodu: sutKodu
      };
    }

    const sut = sutResult.recordset[0];

    // 2. Eşleştirme zaten var mı kontrol et
    const existingRequest = transaction ? transaction.request() : pool.request();
    const existingResult = await existingRequest
      .input('islemID', sql.Int, islemID)
      .input('sutID', sql.Int, sut.SutID)
      .query(`
        SELECT EslestirmeID, AktifMi
        FROM HuvSutEslestirme
        WHERE IslemID = @islemID AND SutID = @sutID
      `);

    if (existingResult.recordset.length > 0) {
      const existing = existingResult.recordset[0];
      
      // Eğer pasif ise aktif yap
      if (!existing.AktifMi) {
        const updateRequest = transaction ? transaction.request() : pool.request();
        await updateRequest
          .input('eslestirmeID', sql.Int, existing.EslestirmeID)
          .query(`
            UPDATE HuvSutEslestirme
            SET AktifMi = 1,
                EslestirmeTipi = 'OTOMATIK',
                GuvenilirlikSkoru = 100
            WHERE EslestirmeID = @eslestirmeID
          `);
        
        return { 
          matched: true, 
          action: 'reactivated',
          eslestirmeID: existing.EslestirmeID,
          sutKodu: sut.SutKodu,
          sutIslemAdi: sut.IslemAdi
        };
      }
      
      return { 
        matched: true, 
        action: 'already_exists',
        eslestirmeID: existing.EslestirmeID,
        sutKodu: sut.SutKodu,
        sutIslemAdi: sut.IslemAdi
      };
    }

    // 3. Yeni eşleştirme oluştur
    const insertRequest = transaction ? transaction.request() : pool.request();
    const insertResult = await insertRequest
      .input('islemID', sql.Int, islemID)
      .input('sutID', sql.Int, sut.SutID)
      .input('eslestirmeTipi', sql.NVarChar, 'OTOMATIK')
      .input('guvenilirlikSkoru', sql.Decimal(5, 2), 100)
      .input('aciklama', sql.NVarChar, `Excel'den otomatik eşleştirildi (SUT: ${sut.SutKodu})`)
      .query(`
        INSERT INTO HuvSutEslestirme (
          IslemID, SutID, EslestirmeTipi, GuvenilirlikSkoru, Aciklama, AktifMi
        )
        OUTPUT INSERTED.EslestirmeID
        VALUES (
          @islemID, @sutID, @eslestirmeTipi, @guvenilirlikSkoru, @aciklama, 1
        )
      `);

    const eslestirmeID = insertResult.recordset[0].EslestirmeID;

    return { 
      matched: true, 
      action: 'created',
      eslestirmeID: eslestirmeID,
      sutKodu: sut.SutKodu,
      sutIslemAdi: sut.IslemAdi,
      puan: sut.Puan
    };

  } catch (error) {
    console.error('❌ Auto match hatası:', error.message);
    return { 
      matched: false, 
      reason: error.message,
      sutKodu: sutKodu
    };
  }
};

// ============================================
// Toplu otomatik eşleştirme
// Import sonrası tüm işlemleri eşleştir
// ============================================
const autoMatchBatch = async (islemList) => {
  const results = {
    total: islemList.length,
    matched: 0,
    alreadyExists: 0,
    reactivated: 0,
    notFound: 0,
    errors: []
  };

  for (const islem of islemList) {
    if (!islem.SutKodu) continue;

    const result = await autoMatchSutKodu(islem.IslemID, islem.SutKodu);
    
    if (result.matched) {
      if (result.action === 'created') {
        results.matched++;
      } else if (result.action === 'already_exists') {
        results.alreadyExists++;
      } else if (result.action === 'reactivated') {
        results.reactivated++;
      }
    } else {
      results.notFound++;
      results.errors.push({
        islemID: islem.IslemID,
        huvKodu: islem.HuvKodu,
        sutKodu: islem.SutKodu,
        reason: result.reason
      });
    }
  }

  return results;
};

// ============================================
// Mevcut tüm HUV işlemlerini eşleştir
// Tek seferlik migration için
// ============================================
const autoMatchAllExisting = async () => {
  try {
    const pool = await getPool();
    
    // SutKodu'su olan ama eşleştirilmemiş işlemleri bul
    const result = await pool.request().query(`
      SELECT 
        i.IslemID,
        i.HuvKodu,
        i.IslemAdi,
        i.SutKodu
      FROM HuvIslemler i
      WHERE i.AktifMi = 1 
        AND i.SutKodu IS NOT NULL 
        AND i.SutKodu != ''
        AND NOT EXISTS (
          SELECT 1 
          FROM HuvSutEslestirme e 
          WHERE e.IslemID = i.IslemID 
            AND e.AktifMi = 1
        )
    `);

    const islemList = result.recordset;
    console.log(`📊 Eşleştirilecek işlem sayısı: ${islemList.length}`);

    const matchResults = await autoMatchBatch(islemList);

    return {
      success: true,
      ...matchResults
    };

  } catch (error) {
    console.error('❌ Toplu eşleştirme hatası:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  autoMatchSutKodu,
  autoMatchBatch,
  autoMatchAllExisting
};

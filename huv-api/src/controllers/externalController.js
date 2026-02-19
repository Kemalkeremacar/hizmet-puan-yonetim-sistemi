// ============================================
// EXTERNAL API CONTROLLER
// ============================================
// Dış servisler için HUV ve SUT listeleri
// ============================================

const { getPool, sql } = require('../config/database');
const { success } = require('../utils/response');

// ============================================
// GET /api/external/huv
// HUV listesi - 2 seviye kırılım
// ============================================
const getHuvList = async (req, res, next) => {
  try {
    const pool = await getPool();

    // Tüm işlemleri tek seferde çek
    const islemlerResult = await pool.request().query(`
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
      ORDER BY i.AnaDalKodu, i.HuvKodu
    `);

    // İşlemleri grupla
    const grouped = new Map();

    for (const islem of islemlerResult.recordset) {
      const anaDalKodu = islem.AnaDalKodu;
      const anaDalAdi = islem.AnaDalAdi;

      // Üst ve Alt Teminat belirleme:
      // UstBaslik formatı: "KALP VE DAMAR CERRAHİSİ → ERİŞKİN KALP CERRAHİSİ → ..."
      // Üst Teminat: 1. kısım (parts[0])
      // Alt Teminat: 2. kısım (parts[1])
      
      let ustTeminatAdi = anaDalAdi; // Varsayılan: Ana dal
      let altTeminatAdi = anaDalAdi; // Varsayılan: Ana dal
      
      if (islem.UstBaslik && islem.UstBaslik.trim() !== '') {
        const parts = islem.UstBaslik.split('→').map(p => p.trim()).filter(p => p !== '');
        
        if (parts.length >= 2) {
          // En az 2 seviye var: "A → B" veya "A → B → C"
          ustTeminatAdi = parts[0]; // 1. kısım
          altTeminatAdi = parts[1]; // 2. kısım
        } else if (parts.length === 1) {
          // Tek seviye: "A"
          ustTeminatAdi = parts[0];
          altTeminatAdi = parts[0]; // Aynı
        }
      }

      // Grup key: AnaDalKodu + UstTeminat + AltTeminat
      const groupKey = `${anaDalKodu}|${ustTeminatAdi}|${altTeminatAdi}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          ustTeminat: {
            kod: `${anaDalKodu}|${ustTeminatAdi}`,
            adi: ustTeminatAdi
          },
          altTeminat: {
            kod: groupKey,
            adi: altTeminatAdi
          },
          islemler: []
        });
      }

      grouped.get(groupKey).islemler.push({
        islemId: islem.IslemID,
        huvKodu: islem.HuvKodu,
        islemAdi: islem.IslemAdi,
        birim: islem.Birim,
        sutKodu: islem.SutKodu,
        ustBaslik: islem.UstBaslik,
        hiyerarsiSeviyesi: islem.HiyerarsiSeviyesi,
        notlar: islem.Notlar
      });
    }

    const result = Array.from(grouped.values());

    return success(res, {
      listeTipi: 'HUV',
      toplamUstTeminat: new Set(result.map(r => r.ustTeminat.kod)).size,
      toplamAltTeminat: result.length,
      toplamIslem: result.reduce((sum, item) => sum + item.islemler.length, 0),
      data: result
    }, 'HUV listesi');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/external/sut
// SUT listesi - 2 seviye kırılım
// ============================================
const getSutList = async (req, res, next) => {
  try {
    const pool = await getPool();

    // Hiyerarşi yapısını çek
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

    // SUT işlemlerini çek
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

    // İşlemleri HiyerarsiID'ye göre grupla
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

    // Sonucu oluştur
    const result = [];
    for (const row of hiyerarsiResult.recordset) {
      const altTeminat = {
        kod: row.AltSeviyeID || row.AnaBaslikID,
        adi: row.AltSeviyeAdi || row.AnaBaslikAdi
      };

      const islemHiyerarsiID = row.EnUstSeviyeID || row.AltSeviyeID || row.AnaBaslikID;
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
    }, 'SUT listesi');
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

module.exports = {
  getHuvList,
  getSutList,
  getIlKatsayiList
};

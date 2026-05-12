// ============================================
// SUT COMPARISON SERVICE
// ============================================
// Eski ve yeni SUT listelerini karşılaştırma
// ============================================

const he = require('he');

// ============================================
// İki SUT listesini karşılaştır
// ============================================
const compareSutLists = (oldData, newData) => {
  const added = [];
  const updated = [];
  const unchanged = [];
  const deleted = [];
  
  // Map oluştur (performans için)
  const oldMap = new Map();
  oldData.forEach(item => {
    oldMap.set(item.SutKodu, item);
  });
  
  const newMap = new Map();
  newData.forEach(item => {
    newMap.set(item.SutKodu, item);
  });
  
  // Yeni listede olanları kontrol et
  newData.forEach(newItem => {
    const oldItem = oldMap.get(newItem.SutKodu);
    
    if (!oldItem) {
      // Yeni eklenen - TÜM alanları ekle
      added.push({
        SutKodu: newItem.SutKodu,
        IslemAdi: newItem.IslemAdi,
        Puan: newItem.Puan,
        Aciklama: newItem.Aciklama,
        AnaBaslikNo: newItem.AnaBaslikNo,
        HiyerarsiID: newItem.HiyerarsiID,
        YeniPuan: newItem.Puan, // Geriye dönük uyumluluk için
        changeType: 'ADDED'
      });
    } else {
      // Mevcut kayıttan eksik alanları tamamla
      if (!newItem.AnaBaslikNo && oldItem.AnaBaslikNo) {
        newItem.AnaBaslikNo = oldItem.AnaBaslikNo;
      }
      if (!newItem.HiyerarsiID && oldItem.HiyerarsiID) {
        newItem.HiyerarsiID = oldItem.HiyerarsiID;
      }
      // NOT: KategoriID kaldırıldı (Migration V2)
      
      // Mevcut - değişmiş mi kontrol et
      const changes = detectChanges(oldItem, newItem);
      
      if (changes.length > 0) {
        updated.push({
          SutID: oldItem.SutID,              // DB'den gelen ID
          SutKodu: newItem.SutKodu,
          IslemAdi: newItem.IslemAdi,
          Aciklama: newItem.Aciklama,
          Puan: newItem.Puan,
          AnaBaslikNo: newItem.AnaBaslikNo,
          HiyerarsiID: newItem.HiyerarsiID,
          EskiPuan: oldItem.Puan,
          YeniPuan: newItem.Puan,
          changes: changes,
          changeType: 'UPDATED'
        });
      } else {
        unchanged.push({
          SutID: oldItem.SutID,              // DB'den gelen ID
          SutKodu: newItem.SutKodu,
          IslemAdi: newItem.IslemAdi,
          Puan: newItem.Puan,
          changeType: 'UNCHANGED'
        });
      }
    }
  });
  
  // Eski listede olup yeni listede olmayanlar (silinecek)
  oldData.forEach(oldItem => {
    if (!newMap.has(oldItem.SutKodu)) {
      deleted.push({
        SutID: oldItem.SutID,              // DB'den gelen ID
        SutKodu: oldItem.SutKodu,
        IslemAdi: oldItem.IslemAdi,
        EskiPuan: oldItem.Puan,
        changeType: 'DELETED'
      });
    }
  });
  
  return {
    added,
    updated,
    unchanged,
    deleted,
    summary: {
      total: newData.length,
      added: added.length,
      updated: updated.length,
      unchanged: unchanged.length,
      deleted: deleted.length
    }
  };
};

// ============================================
// İki kayıt arasındaki değişiklikleri tespit et
// ============================================
const detectChanges = (oldItem, newItem) => {
  const changes = [];
  
  // Puan değişimi
  const oldPuan = oldItem.Puan || 0;
  const newPuan = newItem.Puan || 0;
  if (Math.abs(oldPuan - newPuan) > 0.01) {
    changes.push({
      field: 'Puan',
      oldValue: oldPuan,
      newValue: newPuan,
      change: newPuan - oldPuan,
      changePercent: oldPuan ? 
        ((newPuan - oldPuan) / oldPuan * 100).toFixed(2) : 
        null
    });
  }
  
  const normalizeText = (text) => {
    if (!text) return '';
    let s = text.toString();
    if (s.includes('&') && /&[a-zA-Z]+;|&#\d+;/.test(s)) {
      s = he.decode(s);
    }
    return s
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/[\u00A0\u2007\u202F]/g, ' ')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/[\u2018\u2019\u201A\u0060]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim();
  };
  
  const oldIslemAdi = normalizeText(oldItem.IslemAdi);
  const newIslemAdi = normalizeText(newItem.IslemAdi);
  
  if (oldIslemAdi !== newIslemAdi) {
    changes.push({
      field: 'IslemAdi',
      oldValue: oldItem.IslemAdi,
      newValue: newItem.IslemAdi
    });
  }
  
  // Açıklama değişimi (newline farklarını normalize et)
  const oldAciklama = normalizeText(oldItem.Aciklama);
  const newAciklama = normalizeText(newItem.Aciklama);
  
  if (oldAciklama !== newAciklama) {
    changes.push({
      field: 'Aciklama',
      oldValue: oldItem.Aciklama,
      newValue: newItem.Aciklama
    });
  }
  
  // Ana başlık değişimi — type-safe karşılaştırma
  const oldAnaBaslikNo = oldItem.AnaBaslikNo != null ? Number(oldItem.AnaBaslikNo) : null;
  const newAnaBaslikNo = newItem.AnaBaslikNo != null ? Number(newItem.AnaBaslikNo) : null;
  if (oldAnaBaslikNo !== newAnaBaslikNo) {
    changes.push({
      field: 'AnaBaslikNo',
      oldValue: oldItem.AnaBaslikNo,
      newValue: newItem.AnaBaslikNo
    });
  }
  
  // NOT: HiyerarsiID karşılaştırılmaz çünkü Excel'den gelmiyor,
  // DB'de controller tarafından ilişkisel olarak atanıyor
  
  return changes;
};

// ============================================
// Karşılaştırma raporunu oluştur
// ============================================
const generateComparisonReport = (comparison) => {
  const { added, updated, unchanged, deleted, summary } = comparison;
  
  // Puan değişim istatistikleri
  const puanChanges = updated
    .filter(item => item.changes.some(c => c.field === 'Puan'))
    .map(item => {
      const puanChange = item.changes.find(c => c.field === 'Puan');
      return {
        SutKodu: item.SutKodu,
        IslemAdi: item.IslemAdi,
        EskiPuan: puanChange.oldValue,
        YeniPuan: puanChange.newValue,
        Degisim: puanChange.change,
        DegisimYuzde: puanChange.changePercent
      };
    });
  
  // Ortalama puan değişimi
  const avgPuanChange = puanChanges.length > 0 ?
    puanChanges.reduce((sum, item) => sum + parseFloat(item.Degisim), 0) / puanChanges.length :
    0;
  
  // En çok artan/azalan
  const sortedByChange = [...puanChanges].sort((a, b) => b.Degisim - a.Degisim);
  const topIncreased = sortedByChange.slice(0, 10);
  const topDecreased = sortedByChange.slice(-10).reverse();
  
  return {
    summary,
    puanChanges: {
      count: puanChanges.length,
      avgChange: avgPuanChange.toFixed(2),
      topIncreased,
      topDecreased
    },
    added: added.slice(0, 100),
    deleted: deleted.slice(0, 100),
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  compareSutLists,
  detectChanges,
  generateComparisonReport
};

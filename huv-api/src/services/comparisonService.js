// ============================================
// COMPARISON SERVICE
// ============================================
// Eski ve yeni HUV listelerini karşılaştırma
// ============================================

const he = require('he');

// ============================================
// İki HUV listesini karşılaştır
// oldData: Şu anda Islemler tablosunda olan kayıtlar (aktif)
// newData: Excel'den gelen yeni kayıtlar
// ============================================
const compareHuvLists = (oldData, newData) => {
  const added = [];
  const updated = [];
  const unchanged = [];
  const deleted = [];
  
  // Map oluştur (performans için)
  const oldMap = new Map();
  oldData.forEach(item => {
    oldMap.set(item.HuvKodu, item);
  });
  
  const newMap = new Map();
  newData.forEach(item => {
    newMap.set(item.HuvKodu, item);
  });
  
  // Yeni listede olanları kontrol et
  newData.forEach(newItem => {
    const oldItem = oldMap.get(newItem.HuvKodu);
    
    if (!oldItem) {
      // Yeni eklenen (veya silinmiş olan tekrar ekleniyor)
      added.push({
        HuvKodu: newItem.HuvKodu,
        IslemAdi: newItem.IslemAdi,
        YeniBirim: newItem.Birim,
        changeType: 'ADDED'
      });
    } else {
      // Mevcut - değişmiş mi kontrol et
      const changes = detectChanges(oldItem, newItem);
      
      if (changes.length > 0) {
        updated.push({
          HuvKodu: newItem.HuvKodu,
          IslemAdi: newItem.IslemAdi,
          EskiBirim: oldItem.Birim,
          YeniBirim: newItem.Birim,
          changes: changes,
          changeType: 'UPDATED'
        });
      } else {
        unchanged.push({
          HuvKodu: newItem.HuvKodu,
          IslemAdi: newItem.IslemAdi,
          Birim: newItem.Birim,
          changeType: 'UNCHANGED'
        });
      }
    }
  });
  
  // Eski listede olup yeni listede olmayanlar (silinecek)
  oldData.forEach(oldItem => {
    if (!newMap.has(oldItem.HuvKodu)) {
      deleted.push({
        HuvKodu: oldItem.HuvKodu,
        IslemAdi: oldItem.IslemAdi,
        EskiBirim: oldItem.Birim,
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
  
  const normalizeText = (text) => {
    if (!text) return '';
    let s = text.toString();
    // HTML entity decode (DB'de &ouml; &uuml; &ccedil; vb. kalabilir)
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
  
  const normalizeNullable = (val) => {
    if (val === null || val === undefined) return '';
    return normalizeText(val);
  };
  
  // Birim (fiyat) değişimi — float toleransı ile
  const oldBirim = oldItem.Birim || 0;
  const newBirim = newItem.Birim || 0;
  if (Math.abs(oldBirim - newBirim) > 0.01) {
    changes.push({
      field: 'Birim',
      oldValue: oldItem.Birim,
      newValue: newItem.Birim,
      change: newBirim - oldBirim,
      changePercent: oldBirim ? 
        ((newBirim - oldBirim) / oldBirim * 100).toFixed(2) : 
        null
    });
  }
  
  // İşlem adı değişimi — newline normalize + trim
  const oldIslemAdi = normalizeText(oldItem.IslemAdi);
  const newIslemAdi = normalizeText(newItem.IslemAdi);
  if (oldIslemAdi !== newIslemAdi) {
    changes.push({
      field: 'IslemAdi',
      oldValue: oldItem.IslemAdi,
      newValue: newItem.IslemAdi
    });
  }
  
  // SUT kodu değişimi — null/empty normalizasyonu
  const oldSutKodu = normalizeNullable(oldItem.SutKodu);
  const newSutKodu = normalizeNullable(newItem.SutKodu);
  if (oldSutKodu !== newSutKodu) {
    changes.push({
      field: 'SutKodu',
      oldValue: oldItem.SutKodu,
      newValue: newItem.SutKodu
    });
  }

  // Not değişimi — newline normalize + null/empty normalizasyonu
  const oldNot = normalizeText(oldItem.Not);
  const newNot = normalizeText(newItem.Not);
  if (oldNot !== newNot) {
    changes.push({
      field: 'Not',
      oldValue: oldItem.Not,
      newValue: newItem.Not
    });
  }
  
  return changes;
};

// ============================================
// Karşılaştırma raporunu oluştur
// ============================================
const generateComparisonReport = (comparison) => {
  const { added, updated, unchanged, deleted, summary } = comparison;
  
  // Fiyat değişim istatistikleri
  const priceChanges = updated
    .filter(item => item.changes.some(c => c.field === 'Birim'))
    .map(item => {
      const birimChange = item.changes.find(c => c.field === 'Birim');
      return {
        HuvKodu: item.HuvKodu,
        IslemAdi: item.IslemAdi,
        EskiBirim: birimChange.oldValue,
        YeniBirim: birimChange.newValue,
        Degisim: birimChange.change,
        DegisimYuzde: birimChange.changePercent
      };
    });
  
  // Ortalama fiyat değişimi
  const avgPriceChange = priceChanges.length > 0 ?
    priceChanges.reduce((sum, item) => sum + parseFloat(item.Degisim), 0) / priceChanges.length :
    0;
  
  // En çok artan/azalan
  const sortedByChange = [...priceChanges].sort((a, b) => b.Degisim - a.Degisim);
  const topIncreased = sortedByChange.slice(0, 10);
  const topDecreased = sortedByChange.slice(-10).reverse();
  
  return {
    summary,
    priceChanges: {
      count: priceChanges.length,
      avgChange: avgPriceChange.toFixed(2),
      topIncreased,
      topDecreased
    },
    added: added.slice(0, 100), // İlk 100
    deleted: deleted.slice(0, 100), // İlk 100
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  compareHuvLists,
  detectChanges,
  generateComparisonReport
};

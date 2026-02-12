// ============================================
// COMPARISON SERVICE
// ============================================
// Eski ve yeni HUV listelerini karşılaştırma
// ============================================

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
  
  // Birim (fiyat) değişimi
  if (oldItem.Birim !== newItem.Birim) {
    changes.push({
      field: 'Birim',
      oldValue: oldItem.Birim,
      newValue: newItem.Birim,
      change: newItem.Birim - oldItem.Birim,
      changePercent: oldItem.Birim ? 
        ((newItem.Birim - oldItem.Birim) / oldItem.Birim * 100).toFixed(2) : 
        null
    });
  }
  
  // İşlem adı değişimi
  if (oldItem.IslemAdi !== newItem.IslemAdi) {
    changes.push({
      field: 'IslemAdi',
      oldValue: oldItem.IslemAdi,
      newValue: newItem.IslemAdi
    });
  }
  
  // SUT kodu değişimi
  if (oldItem.SutKodu !== newItem.SutKodu) {
    changes.push({
      field: 'SutKodu',
      oldValue: oldItem.SutKodu,
      newValue: newItem.SutKodu
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

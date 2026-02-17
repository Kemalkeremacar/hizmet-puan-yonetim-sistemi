// ============================================
// İL KATSAYILARI COMPARISON SERVICE
// ============================================
// Eski ve yeni il katsayı listelerini karşılaştırma
// ============================================

// ============================================
// İki il katsayı listesini karşılaştır
// oldData: Şu anda IlKatsayilari tablosunda olan kayıtlar (aktif)
// newData: Excel'den gelen yeni kayıtlar
// ============================================
const compareIlKatsayiLists = (oldData, newData) => {
  const added = [];
  const updated = [];
  const unchanged = [];
  const deleted = [];
  
  // Map oluştur (performans için) - İl adına göre
  const oldMap = new Map();
  oldData.forEach(item => {
    oldMap.set(item.IlAdi.toLowerCase().trim(), item);
  });
  
  const newMap = new Map();
  newData.forEach(item => {
    newMap.set(item.IlAdi.toLowerCase().trim(), item);
  });
  
  // Yeni listede olanları kontrol et
  newData.forEach(newItem => {
    const ilAdiKey = newItem.IlAdi.toLowerCase().trim();
    const oldItem = oldMap.get(ilAdiKey);
    
    if (!oldItem) {
      // Yeni eklenen
      added.push({
        IlAdi: newItem.IlAdi,
        Katsayi: newItem.Katsayi,
        DonemBaslangic: newItem.DonemBaslangic,
        DonemBitis: newItem.DonemBitis,
        changeType: 'ADDED'
      });
    } else {
      // Mevcut - değişmiş mi kontrol et
      const changes = detectIlKatsayiChanges(oldItem, newItem);
      
      if (changes.length > 0) {
        updated.push({
          IlAdi: newItem.IlAdi,
          IlKatsayiID: oldItem.IlKatsayiID,
          EskiKatsayi: oldItem.Katsayi,
          YeniKatsayi: newItem.Katsayi,
          EskiDonemBaslangic: oldItem.DonemBaslangic,
          YeniDonemBaslangic: newItem.DonemBaslangic,
          EskiDonemBitis: oldItem.DonemBitis,
          YeniDonemBitis: newItem.DonemBitis,
          changes: changes,
          changeType: 'UPDATED'
        });
      } else {
        unchanged.push({
          IlAdi: newItem.IlAdi,
          IlKatsayiID: oldItem.IlKatsayiID,
          Katsayi: newItem.Katsayi,
          DonemBaslangic: newItem.DonemBaslangic,
          DonemBitis: newItem.DonemBitis,
          changeType: 'UNCHANGED'
        });
      }
    }
  });
  
  // Eski listede olup yeni listede olmayanlar (silinecek)
  oldData.forEach(oldItem => {
    const ilAdiKey = oldItem.IlAdi.toLowerCase().trim();
    if (!newMap.has(ilAdiKey)) {
      deleted.push({
        IlAdi: oldItem.IlAdi,
        IlKatsayiID: oldItem.IlKatsayiID,
        EskiKatsayi: oldItem.Katsayi,
        DonemBaslangic: oldItem.DonemBaslangic,
        DonemBitis: oldItem.DonemBitis,
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
const detectIlKatsayiChanges = (oldItem, newItem) => {
  const changes = [];
  
  // Katsayı değişimi
  if (Math.abs((oldItem.Katsayi || 0) - (newItem.Katsayi || 0)) > 0.01) {
    changes.push({
      field: 'Katsayi',
      oldValue: oldItem.Katsayi,
      newValue: newItem.Katsayi,
      change: newItem.Katsayi - oldItem.Katsayi,
      changePercent: oldItem.Katsayi ? 
        ((newItem.Katsayi - oldItem.Katsayi) / oldItem.Katsayi * 100).toFixed(2) : 
        null
    });
  }
  
  // Dönem başlangıç değişimi
  const oldDonemBaslangic = oldItem.DonemBaslangic ? 
    new Date(oldItem.DonemBaslangic).toISOString().split('T')[0] : null;
  const newDonemBaslangic = newItem.DonemBaslangic ? 
    new Date(newItem.DonemBaslangic).toISOString().split('T')[0] : null;
  
  if (oldDonemBaslangic !== newDonemBaslangic) {
    changes.push({
      field: 'DonemBaslangic',
      oldValue: oldDonemBaslangic,
      newValue: newDonemBaslangic
    });
  }
  
  // Dönem bitiş değişimi
  const oldDonemBitis = oldItem.DonemBitis ? 
    new Date(oldItem.DonemBitis).toISOString().split('T')[0] : null;
  const newDonemBitis = newItem.DonemBitis ? 
    new Date(newItem.DonemBitis).toISOString().split('T')[0] : null;
  
  if (oldDonemBitis !== newDonemBitis) {
    changes.push({
      field: 'DonemBitis',
      oldValue: oldDonemBitis,
      newValue: newDonemBitis
    });
  }
  
  return changes;
};

// ============================================
// Karşılaştırma raporunu oluştur
// ============================================
const generateIlKatsayiComparisonReport = (comparison) => {
  const { added, updated, unchanged, deleted, summary } = comparison;
  
  // Katsayı değişim istatistikleri
  const katsayiChanges = updated
    .filter(item => item.changes.some(c => c.field === 'Katsayi'))
    .map(item => {
      const katsayiChange = item.changes.find(c => c.field === 'Katsayi');
      return {
        IlAdi: item.IlAdi,
        EskiKatsayi: katsayiChange.oldValue,
        YeniKatsayi: katsayiChange.newValue,
        Degisim: katsayiChange.change,
        DegisimYuzde: katsayiChange.changePercent
      };
    });
  
  // Ortalama katsayı değişimi
  const avgKatsayiChange = katsayiChanges.length > 0 ?
    katsayiChanges.reduce((sum, item) => sum + parseFloat(item.Degisim), 0) / katsayiChanges.length :
    0;
  
  // En çok artan/azalan
  const sortedByChange = [...katsayiChanges].sort((a, b) => b.Degisim - a.Degisim);
  const topIncreased = sortedByChange.slice(0, 10);
  const topDecreased = sortedByChange.slice(-10).reverse();
  
  return {
    summary,
    katsayiChanges: {
      count: katsayiChanges.length,
      avgChange: avgKatsayiChange.toFixed(2),
      topIncreased,
      topDecreased
    },
    added: added.slice(0, 100), // İlk 100
    deleted: deleted.slice(0, 100), // İlk 100
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  compareIlKatsayiLists,
  detectIlKatsayiChanges,
  generateIlKatsayiComparisonReport
};

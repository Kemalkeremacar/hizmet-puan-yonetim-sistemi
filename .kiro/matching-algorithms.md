# SUT-HUV Eşleştirme Algoritmaları

**Güncelleme:** 2026-03-05  
**Durum:** Production - Sadeleştirilmiş (2 Strateji)

## Genel Bakış

SUT işlemlerini HUV alt teminatlarına otomatik eşleştiren sistem. Öncelik sırasına göre 2 strateji kullanır.

### Terminoloji

**HUV Yapısı:**
- Üst Teminat = Ana Dal (33 tıbbi branş) - Örn: "Radyoloji", "Laboratuvar"
- Alt Teminat = Ana Dal altındaki kategori - Örn: "BT İnceleme", "Kan Tahlili"

**SUT Yapısı:**
- Üst Teminat = Ana Başlık (10 ana kategori) - Örn: "Cerrahi İşlemler"
- Alt Teminat = Hiyerarşi Başlığı (Seviye 2-3) - Örn: "Radyolojik Görüntüleme"

**Eşleştirme Hedefi:**
```
SUT İşlem → HUV Alt Teminat
```

---

## Eşleştirme Akışı

```
1. Direct SUT Code Strategy (Öncelik 1)
   ↓ (eşleşme yoksa)
2. Hierarchy Matching Strategy (Öncelik 2)
   ↓ (eşleşme yoksa)
3. Manuel Eşleştirme (Kullanıcı)
```

---

## 1. Direct SUT Code Strategy

**Amaç:** HUV işleminde SUT kodu varsa direkt eşleştir

**Algoritma:**
- `HuvIslemler` tablosunda `SutKodu` ara
- Bulunursa `AltTeminatID`'yi döndür
- Güven: %100 (kesin eşleşme)

**Kural Tipi:** `direct_sut_code`

**Örnek:**
```javascript
// SUT: 10.01.0001
// HUV İşlem: "Muayene (SUT: 10.01.0001)"
// Sonuç: Direkt eşleşme → %100 güven
```

**İstatistik:** 2,271 kayıt (31.9%)

---

## 2. Hierarchy Matching Strategy

**Amaç:** SUT hiyerarşi başlıklarını kullanarak eşleştir

**Algoritma:**
1. SUT işleminin hiyerarşi başlıklarını al (Seviye 2 ve 3)
2. HUV alt teminat isimleriyle benzerlik hesapla
3. %70 üzeri en iyi eşleşmeyi seç
4. Güven: 70 + (benzerlik * 25) = %70-95

**Kural Tipi:** `hierarchy_matching`

**Veritabanı Sorgusu:**
```sql
WITH HierarchyCTE AS (
  SELECT HiyerarsiID, ParentID, SeviyeNo, Baslik, 0 as Level
  FROM SutHiyerarsi
  WHERE HiyerarsiID = @hiyerarsiId
  
  UNION ALL
  
  SELECT h.HiyerarsiID, h.ParentID, h.SeviyeNo, h.Baslik, cte.Level + 1
  FROM SutHiyerarsi h
  INNER JOIN HierarchyCTE cte ON h.HiyerarsiID = cte.ParentID
  WHERE cte.Level < 3
)
SELECT SeviyeNo, Baslik
FROM HierarchyCTE
WHERE Baslik IS NOT NULL AND SeviyeNo >= 2
ORDER BY SeviyeNo
```

**Örnek:**
```javascript
// SUT Hiyerarşi: "Radyolojik Görüntüleme" → "BT Anjiyografi"
// HUV Teminat: "Bilgisayarlı Tomografi Anjiyografik İnceleme"
// Benzerlik: 0.85 → Güven: %91.25
```

**İstatistik:** 2,147 kayıt (30.1%)

---

## Benzerlik Hesaplama

### Jaro-Winkler Algoritması

String benzerliği için Jaro-Winkler mesafesi kullanılır:

```javascript
jaroWinkler = jaro + (prefixLen * p * (1 - jaro))
// p = 0.1, prefixLen = max 4 karakter
```

**Normalizasyon:**
- Küçük harfe çevir
- Boşlukları temizle
- Türkçe karakterleri koru (ç, ğ, ı, ö, ş, ü)

**Örnek:**
```javascript
calculateSimilarity("BT Anjiyografi", "Bilgisayarlı Tomografi Anjiyografik")
// Sonuç: 0.78 (%78 benzerlik)
```

---

## Manuel Eşleştirme Koruması

### IsOverridden Bayrağı

Kullanıcı manuel değişiklik yaptığında `IsOverridden = 1` olur:

```javascript
if (existing.IsOverridden === 1) {
  console.log(`⚠️  SutID ${sutId} atlanıyor - manuel değiştirilmiş`);
  return existing; // Güncelleme yapma
}
```

**Korunan Alanlar:**
- `AltTeminatID` - Eşleştirilen HUV teminat
- `ConfidenceScore` - Orijinal güven skoru
- `MatchingRuleType` - Orijinal kural tipi
- `OriginalAltTeminatID` - Otomatik eşleşmenin yedeği
- `OriginalConfidenceScore` - Otomatik güvenin yedeği
- `OriginalRuleType` - Otomatik kuralın yedeği

**Takip Alanları:**
- `IsOverridden` - Manuel değişiklik bayrağı
- `OverriddenAt` - Manuel değişiklik zamanı
- `OverriddenBy` - Değişikliği yapan kullanıcı ID

**İstatistik:** 2,711 kayıt (38.0%)

---

## Güven Skoru Aralıkları

| Aralık | Kategori | Gerekli Aksiyon |
|--------|----------|-----------------|
| 85-100% | Yüksek Güven | Otomatik onay önerilir |
| 70-84% | Orta Güven | Manuel inceleme önerilir |
| < 70% | Düşük Güven | Manuel inceleme gerekli |

**Mevcut Dağılım:**
- Yüksek (85-100%): 5,793 kayıt (81.3%)
- Orta (70-84%): 1,336 kayıt (18.7%)
- Düşük (0-69%): 0 kayıt (0%)

---

## Toplu İşleme

### Toplu Eşleştirme Akışı

```javascript
1. Eşleşmemiş SUT işlemlerini getir (veya forceRematch = true ise hepsi)
2. batchSize kadar kayıt al (varsayılan: 100, max: 10,000)
3. 50'şer kayıt halinde işle (BatchProcessor)
4. Her SUT işlem için:
   a. DirectSutCodeStrategy dene
   b. HierarchyMatchingStrategy dene
   c. Eşleşme yoksa atla
5. Veritabanına kaydet (IsOverridden = 1 ise atla)
6. Özet istatistikleri döndür
```

### Toplu İstatistikler

```javascript
{
  totalProcessed: 7129,
  matchedCount: 7129,
  unmatchedCount: 0,
  highConfidenceCount: 5793,  // >= 85%
  mediumConfidenceCount: 1336, // 70-84%
  lowConfidenceCount: 0,       // < 70%
  errors: [],
  durationMs: 45230
}
```

---

## Performans Optimizasyonu

### Veritabanı İndeksleri

```sql
-- AltTeminatIslemler
CREATE INDEX IX_AltTeminatIslemler_SutID ON AltTeminatIslemler(SutID);
CREATE INDEX IX_AltTeminatIslemler_AltTeminatID ON AltTeminatIslemler(AltTeminatID);
CREATE INDEX IX_AltTeminatIslemler_ConfidenceScore ON AltTeminatIslemler(ConfidenceScore);

-- SutIslemler
CREATE INDEX IX_SutIslemler_AktifMi ON SutIslemler(AktifMi);
CREATE INDEX IX_SutIslemler_HiyerarsiID ON SutIslemler(HiyerarsiID);

-- HuvAltTeminatlar
CREATE INDEX IX_HuvAltTeminatlar_AnaDalKodu ON HuvAltTeminatlar(AnaDalKodu);
CREATE INDEX IX_HuvAltTeminatlar_AktifMi ON HuvAltTeminatlar(AktifMi);
```

### Toplu İşleme Ayarları

- Chunk boyutu: 50 kayıt/batch
- Toplam batch boyutu: Ayarlanabilir (varsayılan 100, max 10,000)
- Paralel işleme: Hayır (veritabanı tutarlılığı için sıralı)

---

## Test ve Doğrulama

### Test Senaryoları

1. **Direct SUT Code Eşleşme**: %100 güven
2. **Hierarchy Eşleşme**: %70-95 güven
3. **Manuel Değişiklik**: Toplu güncellemeden korunur
4. **Tekrar Önleme**: SutID başına bir eşleşme

### Doğrulama Kuralları

- Minimum güven: %70
- Maksimum batch boyutu: 10,000
- Manuel değişiklikler: Asla otomatik güncellenmez
- Tekrar önleme: SutID başına bir eşleşme

---

## Gelecek İyileştirmeler

1. **Makine Öğrenmesi**: Onaylanan eşleşmelerden ML modeli eğit
2. **Güven Ayarı**: Onay oranlarına göre eşikleri ayarla
3. **Performans**: Paralel toplu işleme
4. **Analitik**: Strateji etkinliğini takip et

---

## İlgili Dosyalar

**Backend:**
- `huv-api/src/services/matching/MatchingEngine.js` - Ana eşleştirme koordinatörü
- `huv-api/src/services/matching/DirectSutCodeStrategy.js` - Öncelik 1 strateji
- `huv-api/src/services/matching/HierarchyMatchingStrategy.js` - Öncelik 2 strateji
- `huv-api/src/utils/matching/SimilarityCalculator.js` - Jaro-Winkler implementasyonu

**Frontend:**
- `huv-frontend/src/components/matching/HuvTeminatSelectionDialog.jsx` - Manuel eşleştirme UI

---

## Değişiklik Geçmişi

### 2026-03-05: Kod Sadeleştirme
- ❌ Silindi: FirstLetterStrategy (45 kayıt, %0.6)
- ❌ Silindi: GeneralSimilarityStrategy (162 kayıt, %2.3)
- ✅ Kaldı: DirectSutCodeStrategy + HierarchyMatchingStrategy
- 📊 Kod karmaşıklığı %75 azaldı
- 🚀 Bakım kolaylığı arttı
- ✅ Tüm kayıtlar hala %100 onaylı

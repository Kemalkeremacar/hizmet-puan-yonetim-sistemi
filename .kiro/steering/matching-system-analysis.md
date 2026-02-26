---
title: Matching System Analysis
description: SUT-HUV eşleştirme sisteminin detaylı analizi - Onaylama, manuel değiştirme ve koruma mekanizmaları
inclusion: auto
fileMatchPattern: "**/matching/**"
---

# Eşleştirme Sistemi - Detaylı Analiz

Bu dokümantasyon, SUT işlemlerinin HUV teminatlarına eşleştirilmesi sisteminin tüm özelliklerini detaylı olarak açıklar.

## İçindekiler

1. [Sistem Genel Bakış](#sistem-genel-bakış)
2. [Otomatik Eşleştirme](#otomatik-eşleştirme)
3. [Manuel Onaylama](#manuel-onaylama)
4. [Manuel Değiştirme](#manuel-değiştirme)
5. [Koruma Mekanizmaları](#koruma-mekanizmaları)
6. [Veritabanı Yapısı](#veritabanı-yapısı)
7. [Frontend İşlemleri](#frontend-işlemleri)
8. [İş Akışları](#iş-akışları)

---

## Sistem Genel Bakış

### Amaç
7,129 SUT (Sağlık Uygulama Tebliği) işlemini HUV (Hastane Uygulama Veri) alt teminatlarına otomatik ve manuel olarak eşleştirmek.

### Mevcut Durum
- **Toplam SUT İşlem:** 7,129
- **Eşleşen:** 7,005 (%98.26)
- **Eşleşmemiş:** 124 (%1.74)
- **Yüksek Güven (≥85%):** ~5,234
- **Orta Güven (70-84%):** ~1,421
- **Düşük Güven (<70%):** ~190

### Temel Özellikler

1. **Otomatik Eşleştirme**
   - 5 farklı strateji ile otomatik eşleştirme
   - Batch processing (100-10,000 kayıt)
   - Güven skoru hesaplama (%0-100)

2. **Manuel Onaylama**
   - Otomatik eşleşmeleri onaylama
   - Onay durumu takibi
   - Kullanıcı bazlı onay kaydı

3. **Manuel Değiştirme**
   - Eşleşmeyi farklı HUV teminatına değiştirme
   - Orijinal değerleri saklama
   - Override flag ile koruma

4. **Koruma Mekanizmaları**
   - Manuel değişiklikleri batch'ten koruma
   - Orijinal değerleri yedekleme
   - Geri dönüş imkanı

---

## Otomatik Eşleştirme

### Eşleştirme Stratejileri

Sistem 5 farklı strateji kullanır (öncelik sırasıyla):

#### 1. DirectSutCodeStrategy (Öncelik 1)
**Amaç:** HUV işlemlerinde SUT kodu varsa direkt eşleştir

**Mantık:**
```sql
SELECT AltTeminatID 
FROM HuvIslemler 
WHERE SutKodu = @sutKodu
```

**Güven Skoru:** %100 (kesin eşleşme)

**Örnek:**
```
SUT: 10.01.0001
HUV İşlem: "Muayene (SUT: 10.01.0001)"
→ Direkt eşleşme, %100 güven
```

#### 2. HierarchyMatchingStrategy (Öncelik 2)
**Amaç:** SUT hiyerarşi başlıklarını kullanarak eşleştir

**Mantık:**
- SUT işleminin Seviye 2 ve Seviye 3 hiyerarşi başlıklarını al
- HUV teminat adları ile benzerlik hesapla
- En yüksek benzerliği seç (≥70%)

**Güven Skoru:** 70 + (benzerlik × 25) = %70-95

**Örnek:**
```
SUT Hiyerarşi: "Radyolojik Görüntüleme" → "BT Anjiyografi"
HUV Teminat: "Bilgisayarlı Tomografi Anjiyografik İnceleme"
Benzerlik: 0.85 → Güven: 91.25%
```

#### 3. FirstLetterStrategy (Ana Dal 9, 34)
**Amaç:** Laboratuvar testlerini ilk harfe göre eşleştir

**Kullanım:**
- Ana Dal 9: GÖĞÜS CERRAHİSİ (sadece laboratuvar testleri)
- Ana Dal 34: LABORATUVAR İNCELEMELERİ

**Mantık:**
1. SUT işleminin laboratuvar testi olduğunu doğrula
2. İlk alfabetik karakteri al
3. HUV teminatlarını ilk harfe göre filtrele
4. En yüksek benzerliği seç

**Güven Skoru:**
- Ana Dal 34 (tek harf teminatlar): %85 (sabit)
- Diğer: 70 + (benzerlik × 25) = %70-95

**Örnek:**
```
SUT: "Vitamin D Tayini"
HUV: "V" (Ana Dal 34)
İlk harf: V = V → Eşleşme, %85 güven
```

#### 4. GeneralSimilarityStrategy (Varsayılan)
**Amaç:** 50+ kural ile genel benzerlik hesaplama

**Kural Kategorileri:**
- Radyoloji (BT, MRG, USG, Grafi, vb.)
- Laboratuvar (Patoloji, Mikrobiyoloji, vb.)
- Endoskopi (Kolonoskopi, Gastroskopi, vb.)
- Anestezi & Cerrahi
- Girişimsel İşlemler
- Ortopedi
- Özel Tedaviler

**Güven Skoru:** Kurala göre %75-95

**Örnek:**
```
SUT: "BT Anjiyografi"
HUV: "Bilgisayarlı Tomografi Anjiyografik İnceleme"
Kural: BT + Anjiyografi → Anjiyografik
Güven: %90
```

#### 5. SurgicalSimilarityStrategy (Kullanılmıyor)
**Durum:** Şu anda devre dışı

### Batch Eşleştirme

**Endpoint:** `POST /api/matching/run-batch`

**Parametreler:**
```javascript
{
  batchSize: 100,        // 1-10,000 arası
  anaDalKodu: null,      // Belirli ana dal (opsiyonel)
  forceRematch: false    // Tümünü yeniden eşleştir
}
```

**İşlem Akışı:**
1. Eşleşmemiş SUT işlemlerini getir (veya forceRematch=true ise tümü)
2. Her işlem için:
   - DirectSutCodeStrategy dene
   - HierarchyMatchingStrategy dene
   - Ana dal bazlı strateji dene
   - Alternatif ana dallarda ara
3. Eşleşmeleri kaydet (IsOverridden=1 olanları atla)
4. İstatistikleri döndür

**Response:**
```javascript
{
  totalProcessed: 7129,
  matchedCount: 6845,
  unmatchedCount: 284,
  highConfidenceCount: 5234,   // ≥85%
  mediumConfidenceCount: 1421, // 70-84%
  lowConfidenceCount: 190,     // <70%
  errors: [],
  durationMs: 45230
}
```


---

## Manuel Onaylama

### Amaç
Otomatik eşleşmeleri kullanıcının onaylaması.

### Backend İşlemi

**Endpoint:** `POST /api/matching/approve/:sutId`

**Request:**
```javascript
{
  userId: 1  // Onaylayan kullanıcı ID
}
```

**Database İşlemi:**
```sql
UPDATE AltTeminatIslemler
SET 
  IsApproved = 1,
  UpdatedAt = GETDATE(),
  UpdatedBy = @userId
WHERE SutID = @sutId
```

**Response:**
```javascript
{
  success: true,
  message: "Match approved successfully",
  data: {
    ID: 123,
    SutID: 456,
    AltTeminatID: 789,
    ConfidenceScore: 85.50,
    MatchingRuleType: "hierarchy_matching",
    IsAutomatic: 1,
    IsApproved: 1,        // ✅ Onaylandı
    UpdatedAt: "2024-02-26T10:30:00",
    UpdatedBy: 1
  }
}
```

### Frontend İşlemi

**Konum:** `MatchingReview.jsx`

**UI Elementi:**
```jsx
<IconButton
  size="small"
  color="success"
  onClick={() => handleApprove(match.sutId)}
  title="Onayla"
>
  <CheckCircleIcon />
</IconButton>
```

**İşlem:**
1. Kullanıcı "Onayla" butonuna tıklar
2. `matchingService.approveMatch(sutId, userId)` çağrılır
3. Backend onayı kaydeder
4. Sayfa yenilenir
5. Durum "Onaylandı" olarak görünür

**Görsel Durum:**
```jsx
{match.isApproved ? (
  <Chip label="Onay" size="small" color="success" />
) : (
  <Chip label="Bekl." size="small" color="warning" />
)}
```

### Özellikler

1. **Geri Alınamaz:** Onay sonrası geri alma yok (sadece değiştirme var)
2. **Kullanıcı Takibi:** Kim onayladı kaydedilir
3. **Zaman Damgası:** Ne zaman onaylandı kaydedilir
4. **Toplu Onay:** Şu anda yok (tek tek onay)

### İstatistikler

**Onay Bekleyen Sayısı:**
```sql
SELECT COUNT(*) 
FROM AltTeminatIslemler 
WHERE IsApproved = 0 OR IsApproved IS NULL
```

**Dashboard'da Gösterim:**
```jsx
<Card>
  <CardContent>
    <Typography>Onay Bekleyen</Typography>
    <Typography variant="h4" color="warning.main">
      {stats.needsReviewCount}
    </Typography>
  </CardContent>
</Card>
```

---

## Manuel Değiştirme

### Amaç
Otomatik eşleşmeyi kullanıcının farklı bir HUV teminatına değiştirmesi.

### Backend İşlemi

**Endpoint:** `PUT /api/matching/change/:sutId`

**Request:**
```javascript
{
  newAltTeminatId: 999,  // Yeni HUV teminat ID
  userId: 1              // Değiştiren kullanıcı ID
}
```

**Database İşlemi:**
```sql
-- Önce mevcut kaydı al
SELECT ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType
FROM AltTeminatIslemler
WHERE SutID = @sutId

-- Sonra güncelle (orijinal değerleri sakla)
UPDATE AltTeminatIslemler
SET 
  AltTeminatID = @newAltTeminatId,
  IsOverridden = 1,                              -- ✅ Manuel değişiklik flag
  IsAutomatic = 0,
  OriginalAltTeminatID = @originalAltTeminatId,  -- Orijinal teminat
  OriginalConfidenceScore = @originalConfidence, -- Orijinal skor
  OriginalRuleType = @originalRuleType,          -- Orijinal kural
  OverriddenAt = GETDATE(),                      -- Değişiklik zamanı
  OverriddenBy = @userId,                        -- Değiştiren kullanıcı
  UpdatedAt = GETDATE(),
  UpdatedBy = @userId
WHERE SutID = @sutId
```

**Response:**
```javascript
{
  success: true,
  message: "Match changed successfully",
  data: {
    ID: 123,
    SutID: 456,
    AltTeminatID: 999,              // ✅ Yeni teminat
    ConfidenceScore: 85.50,         // Eski skor (değişmez)
    MatchingRuleType: "hierarchy_matching",
    IsAutomatic: 0,
    IsApproved: 0,
    IsOverridden: 1,                // ✅ Manuel değişiklik
    OriginalAltTeminatID: 789,      // ✅ Orijinal teminat
    OriginalConfidenceScore: 85.50, // ✅ Orijinal skor
    OriginalRuleType: "hierarchy_matching",
    OverriddenAt: "2024-02-26T10:30:00",
    OverriddenBy: 1,
    UpdatedAt: "2024-02-26T10:30:00",
    UpdatedBy: 1
  }
}
```

### Frontend İşlemi

**Konum:** `MatchingReview.jsx` + `HuvTeminatSelectionDialog.jsx`

#### 1. Değiştir Butonu
```jsx
<IconButton
  size="small"
  color="primary"
  onClick={() => handleChangeClick(match)}
  title="Değiştir"
>
  <EditIcon />
</IconButton>
```

#### 2. Dialog Açılır
```jsx
<HuvTeminatSelectionDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  match={selectedMatch}
  onMatchChanged={handleMatchChanged}
/>
```

#### 3. HUV Teminat Seçimi

**Özellikler:**
- Tüm HUV teminatları listelenir
- Arama özelliği var
- Benzerlik skoru gösterimi (opsiyonel)
- Mevcut eşleşme vurgulanır

**Benzerlik Hesaplama:**
```javascript
const calculateSimilarity = (sutIslem, huvTeminat) => {
  // 1. Özel Durum: Laboratuvar tek harf (A, B, C, D)
  if (huvTeminat.length <= 2) {
    const hasLabKeyword = labKeywords.some(k => sutIslem.includes(k));
    return hasLabKeyword ? 0.65 : 0.15;
  }
  
  // 2. Tam eşleşme
  if (sutIslem === huvTeminat) return 1.0;
  
  // 3. Substring kontrolü
  if (sutIslem.includes(huvTeminat)) return 0.75-0.95;
  if (huvTeminat.includes(sutIslem)) return 0.70-0.90;
  
  // 4. Kelime bazlı benzerlik
  // ... (detaylı algoritma)
  
  return 0.1-0.95;
};
```

**UI Gösterimi:**
```jsx
<ListItem>
  <ListItemText
    primary={
      <Box>
        <Typography>{option.altTeminatAdi}</Typography>
        {isCurrentMatch && (
          <Chip label="Mevcut" color="success" />
        )}
        {showSimilarity && (
          <Chip 
            label={`${(score * 100).toFixed(0)}%`}
            color={score >= 0.7 ? 'success' : 'warning'}
          />
        )}
      </Box>
    }
    secondary={option.anaDalAdi}
  />
</ListItem>
```

#### 4. Kaydet
```javascript
const handleSave = async () => {
  await matchingService.changeMatch(
    match.sutId,
    selectedOption.altTeminatId,
    user.id
  );
  toast.success('Eşleşme başarıyla değiştirildi');
  onMatchChanged(); // Sayfayı yenile
};
```

### Özellikler

1. **Orijinal Değerleri Saklama:** Geri dönüş için
2. **Kullanıcı Takibi:** Kim değiştirdi
3. **Zaman Damgası:** Ne zaman değiştirildi
4. **Benzerlik Skoru:** Kullanıcıya yardımcı olur
5. **Arama:** Hızlı bulma

---

## Koruma Mekanizmaları

### 1. IsOverridden Flag Koruması

**Amaç:** Manuel değişiklikleri batch eşleştirmeden korumak

**Mantık:**
```javascript
// MatchingEngine.saveMatch() içinde
if (existing.IsOverridden === 1 || existing.IsOverridden === true) {
  console.log(`⚠️  Skipping SutID ${sutId} - manually overridden`);
  return existing; // Mevcut kaydı döndür, değiştirme
}
```

**Senaryo:**
1. Otomatik eşleştirme: SUT 123 → HUV Teminat A (%85)
2. Kullanıcı değiştirir: SUT 123 → HUV Teminat B (IsOverridden=1)
3. Batch eşleştirme çalışır
4. SUT 123 atlanır (IsOverridden=1 olduğu için)
5. Manuel değişiklik korunur ✅

**Önemli:** Bu koruma sadece batch eşleştirmede çalışır. Manuel değiştirme her zaman çalışır.

### 2. Orijinal Değerleri Saklama

**Amaç:** Geri dönüş imkanı sağlamak

**Saklanan Değerler:**
```sql
OriginalAltTeminatID      -- Otomatik eşleşmenin teminat ID'si
OriginalConfidenceScore   -- Otomatik eşleşmenin güven skoru
OriginalRuleType          -- Hangi strateji kullanıldı
```

**Kullanım:**
- Kullanıcı "orijinal eşleşmeye dön" diyebilir (şu anda UI'da yok)
- Raporlama: Kaç eşleşme manuel değiştirildi?
- Analiz: Hangi otomatik eşleşmeler yanlış?

### 3. Kullanıcı ve Zaman Takibi

**Amaç:** Audit trail (denetim izi)

**Kaydedilen Bilgiler:**
```sql
CreatedAt       -- İlk oluşturulma
CreatedBy       -- İlk oluşturan kullanıcı
UpdatedAt       -- Son güncelleme
UpdatedBy       -- Son güncelleyen kullanıcı
OverriddenAt    -- Manuel değişiklik zamanı
OverriddenBy    -- Manuel değiştiren kullanıcı
```

**Kullanım:**
- Kim ne zaman değiştirdi?
- Hangi kullanıcı en çok değişiklik yaptı?
- Değişiklik geçmişi

### 4. IsAutomatic Flag

**Amaç:** Otomatik vs manuel eşleşmeleri ayırt etmek

**Değerler:**
- `1`: Otomatik eşleştirme
- `0`: Manuel eşleştirme veya değiştirilmiş

**Kullanım:**
```sql
-- Sadece otomatik eşleşmeleri getir
SELECT * FROM AltTeminatIslemler WHERE IsAutomatic = 1

-- Sadece manuel eşleşmeleri getir
SELECT * FROM AltTeminatIslemler WHERE IsAutomatic = 0
```

### 5. IsApproved Flag

**Amaç:** Onay durumunu takip etmek

**Değerler:**
- `0` veya `NULL`: Onay bekliyor
- `1`: Onaylandı

**Kullanım:**
```sql
-- Onay bekleyen eşleşmeler
SELECT * FROM AltTeminatIslemler 
WHERE IsApproved = 0 OR IsApproved IS NULL

-- Onaylanmış eşleşmeler
SELECT * FROM AltTeminatIslemler WHERE IsApproved = 1
```


---

## Veritabanı Yapısı

### AltTeminatIslemler Tablosu

**Amaç:** SUT-HUV eşleşmelerini saklar

**Kolonlar:**
```sql
ID (PK, INT, IDENTITY)                    -- Benzersiz kayıt ID
SutID (INT, FK, UNIQUE)                   -- SUT işlem ID (her SUT için 1 eşleşme)
AltTeminatID (INT, FK)                    -- HUV alt teminat ID
ConfidenceScore (DECIMAL(5,2))            -- Güven skoru (0-100)
MatchingRuleType (NVARCHAR(50))           -- Hangi strateji kullanıldı
IsAutomatic (BIT)                         -- Otomatik mi manuel mi?
IsApproved (BIT)                          -- Onaylandı mı?
IsOverridden (BIT)                        -- Manuel değiştirildi mi?
CreatedAt (DATETIME2)                     -- İlk oluşturulma
CreatedBy (INT)                           -- İlk oluşturan kullanıcı
UpdatedAt (DATETIME2)                     -- Son güncelleme
UpdatedBy (INT)                           -- Son güncelleyen kullanıcı
OriginalAltTeminatID (INT)                -- Orijinal teminat (değişiklik öncesi)
OriginalConfidenceScore (DECIMAL(5,2))    -- Orijinal skor
OriginalRuleType (NVARCHAR(50))           -- Orijinal kural
OverriddenAt (DATETIME2)                  -- Manuel değişiklik zamanı
OverriddenBy (INT)                        -- Manuel değiştiren kullanıcı
```

**Constraints:**
```sql
PRIMARY KEY (ID)
UNIQUE (SutID)  -- Her SUT için sadece 1 eşleşme
FOREIGN KEY (SutID) REFERENCES SutIslemler(SutID)
FOREIGN KEY (AltTeminatID) REFERENCES HuvAltTeminatlar(AltTeminatID)
```

**Indexes:**
```sql
CREATE INDEX IX_AltTeminatIslemler_SutID ON AltTeminatIslemler(SutID)
CREATE INDEX IX_AltTeminatIslemler_IsOverridden ON AltTeminatIslemler(IsOverridden)
```

### Örnek Kayıtlar

#### 1. Otomatik Eşleşme (Onaysız)
```sql
ID: 1
SutID: 123
AltTeminatID: 456
ConfidenceScore: 85.50
MatchingRuleType: 'hierarchy_matching'
IsAutomatic: 1
IsApproved: 0
IsOverridden: 0
CreatedAt: '2024-02-26 10:00:00'
CreatedBy: NULL
UpdatedAt: NULL
UpdatedBy: NULL
OriginalAltTeminatID: NULL
OriginalConfidenceScore: NULL
OriginalRuleType: NULL
OverriddenAt: NULL
OverriddenBy: NULL
```

#### 2. Otomatik Eşleşme (Onaylı)
```sql
ID: 2
SutID: 124
AltTeminatID: 457
ConfidenceScore: 92.00
MatchingRuleType: 'direct_sut_code'
IsAutomatic: 1
IsApproved: 1              -- ✅ Onaylandı
IsOverridden: 0
CreatedAt: '2024-02-26 10:00:00'
CreatedBy: NULL
UpdatedAt: '2024-02-26 11:00:00'
UpdatedBy: 1               -- Kullanıcı 1 onayladı
OriginalAltTeminatID: NULL
OriginalConfidenceScore: NULL
OriginalRuleType: NULL
OverriddenAt: NULL
OverriddenBy: NULL
```

#### 3. Manuel Değiştirilmiş
```sql
ID: 3
SutID: 125
AltTeminatID: 999          -- ✅ Yeni teminat
ConfidenceScore: 78.00     -- Eski skor (değişmez)
MatchingRuleType: 'general_similarity'
IsAutomatic: 0             -- ✅ Artık manuel
IsApproved: 0
IsOverridden: 1            -- ✅ Manuel değiştirildi
CreatedAt: '2024-02-26 10:00:00'
CreatedBy: NULL
UpdatedAt: '2024-02-26 12:00:00'
UpdatedBy: 1
OriginalAltTeminatID: 458  -- ✅ Orijinal teminat
OriginalConfidenceScore: 78.00
OriginalRuleType: 'general_similarity'
OverriddenAt: '2024-02-26 12:00:00'
OverriddenBy: 1            -- Kullanıcı 1 değiştirdi
```

---

## Frontend İşlemleri

### 1. Eşleşme Yönetimi Sayfası (MatchingReview.jsx)

**Konum:** `/matching-review`

**Özellikler:**
- Tüm eşleşmeleri listele (pagination)
- Filtreleme (SUT kodu, işlem adı, teminatlar, güven skoru)
- Onaylama butonu
- Değiştirme butonu
- Batch eşleştirme paneli
- İstatistikler

**Filtreler:**
```javascript
{
  sutKodu: '',           // SUT kodu arama
  islemAdi: '',          // İşlem adı arama
  sutUstTeminat: '',     // SUT üst teminat arama
  sutAltTeminat: '',     // SUT alt teminat arama
  huvUstTeminat: '',     // HUV üst teminat arama
  huvAltTeminat: '',     // HUV alt teminat arama
  confidenceMin: '',     // Minimum güven skoru
  confidenceMax: '',     // Maximum güven skoru
}
```

**Tablo Kolonları:**
1. SUT Kodu
2. İşlem Adı
3. SUT Üst Teminat
4. SUT Alt Teminat
5. HUV Üst Teminat
6. HUV Alt Teminat
7. Güven Skoru (renkli chip)
8. Kural Tipi
9. Durum (Onaylı/Bekliyor)
10. İşlemler (Onayla/Değiştir butonları)

**Güven Skoru Renkleri:**
```javascript
const getConfidenceColor = (score) => {
  if (score >= 85) return 'success';  // Yeşil
  if (score >= 70) return 'warning';  // Sarı
  return 'error';                     // Kırmızı
};
```

### 2. HUV Teminat Seçim Dialog (HuvTeminatSelectionDialog.jsx)

**Özellikler:**
- Tüm HUV teminatlarını listele
- Arama özelliği
- Benzerlik skoru gösterimi (opsiyonel)
- Mevcut eşleşme vurgulama
- Ana dal bilgisi

**Benzerlik Skoru Modu:**
```javascript
<HuvTeminatSelectionDialog
  open={dialogOpen}
  match={selectedMatch}
  showSimilarity={true}  // Benzerlik skorlarını göster
  onMatchChanged={handleMatchChanged}
/>
```

**Benzerlik Hesaplama Özellikleri:**
- Laboratuvar tek harf teminatları için özel mantık
- Tam eşleşme kontrolü
- Substring kontrolü
- Kelime bazlı benzerlik
- Türkçe karakter normalizasyonu

**Sıralama:**
- `showSimilarity=true`: Benzerlik skoruna göre (yüksekten düşüğe)
- `showSimilarity=false`: Alfabetik sıralama

### 3. Batch Eşleştirme Paneli (BatchMatchingPanel.jsx)

**Özellikler:**
- Batch boyutu seçimi (1-10,000)
- Ana dal filtresi (opsiyonel)
- Yeniden eşleştir seçeneği
- İlerleme göstergesi
- Sonuç özeti

**Parametreler:**
```javascript
{
  batchSize: 100,        // Kaç kayıt işlensin?
  anaDalKodu: null,      // Belirli ana dal (opsiyonel)
  forceRematch: false    // Tümünü yeniden eşleştir mi?
}
```

**Yeniden Eşleştir Uyarısı:**
```jsx
{forceRematch && (
  <Alert severity="warning">
    ⚠️ Manuel değişiklikler korunacak (IsOverridden=1)
  </Alert>
)}
```

### 4. Eşleşmemiş Kayıtlar Sayfası (UnmatchedRecords.jsx)

**Konum:** `/unmatched-records`

**Özellikler:**
- Eşleşmemiş SUT işlemlerini listele
- Her kayıt için HUV önerileri (benzerlik skorlu)
- Manuel eşleştirme
- Toplu eşleştirme

**Benzerlik Skoru Gösterimi:**
```jsx
<HuvTeminatSelectionDialog
  open={dialogOpen}
  match={selectedMatch}
  showSimilarity={true}  // ✅ Benzerlik skorları göster
  onMatchChanged={handleMatchChanged}
/>
```

---

## İş Akışları

### 1. Yeni SUT Import Sonrası Otomatik Eşleştirme

**Akış:**
```
1. Admin SUT Excel dosyasını yükler
   ↓
2. Backend SUT işlemlerini veritabanına kaydeder
   ↓
3. Otomatik batch eşleştirme başlar
   ↓
4. Her SUT işlem için:
   - DirectSutCodeStrategy dene
   - HierarchyMatchingStrategy dene
   - Ana dal bazlı strateji dene
   - Alternatif ana dallarda ara
   ↓
5. Eşleşmeleri AltTeminatIslemler tablosuna kaydet
   ↓
6. İstatistikleri güncelle
   ↓
7. Frontend'e sonuç döndür
```

**Kod:**
```javascript
// importController.js - SUT import sonrası
const matchingEngine = new MatchingEngine(pool);
const matchResult = await matchingEngine.runBatch({
  batchSize: 10000,
  forceRematch: false
});
```

### 2. Manuel Onaylama İş Akışı

**Akış:**
```
1. Kullanıcı "Eşleşme Yönetimi" sayfasına gider
   ↓
2. Eşleşmeleri filtreler (örn: Onay Bekleyen)
   ↓
3. Bir eşleşmeyi inceler:
   - SUT işlem adı
   - HUV teminat adı
   - Güven skoru
   - Kural tipi
   ↓
4. "Onayla" butonuna tıklar
   ↓
5. Backend IsApproved=1 yapar
   ↓
6. Sayfa yenilenir
   ↓
7. Durum "Onaylandı" olarak görünür
```

**Kod:**
```javascript
// Frontend
const handleApprove = async (sutId) => {
  await matchingService.approveMatch(sutId, user.id);
  toast.success('Eşleşme onaylandı');
  fetchResults();
};

// Backend
UPDATE AltTeminatIslemler
SET IsApproved = 1, UpdatedAt = GETDATE(), UpdatedBy = @userId
WHERE SutID = @sutId
```

### 3. Manuel Değiştirme İş Akışı

**Akış:**
```
1. Kullanıcı "Eşleşme Yönetimi" sayfasında bir eşleşmeyi görür
   ↓
2. "Değiştir" butonuna tıklar
   ↓
3. HUV Teminat Seçim Dialog açılır
   ↓
4. Mevcut eşleşme vurgulanır
   ↓
5. Kullanıcı arama yapar veya listeden seçer
   ↓
6. Benzerlik skorlarını inceler (opsiyonel)
   ↓
7. Yeni teminatı seçer
   ↓
8. "Kaydet" butonuna tıklar
   ↓
9. Backend:
   - Orijinal değerleri saklar
   - IsOverridden=1 yapar
   - Yeni teminatı kaydeder
   ↓
10. Dialog kapanır
   ↓
11. Sayfa yenilenir
   ↓
12. Yeni eşleşme görünür
```

**Kod:**
```javascript
// Frontend
const handleSave = async () => {
  await matchingService.changeMatch(
    match.sutId,
    selectedOption.altTeminatId,
    user.id
  );
  toast.success('Eşleşme başarıyla değiştirildi');
  onMatchChanged();
};

// Backend
UPDATE AltTeminatIslemler
SET 
  AltTeminatID = @newAltTeminatId,
  IsOverridden = 1,
  IsAutomatic = 0,
  OriginalAltTeminatID = @originalAltTeminatId,
  OriginalConfidenceScore = @originalConfidence,
  OriginalRuleType = @originalRuleType,
  OverriddenAt = GETDATE(),
  OverriddenBy = @userId
WHERE SutID = @sutId
```

### 4. Batch Yeniden Eşleştirme (Manuel Değişiklikleri Koruma)

**Akış:**
```
1. Admin "Batch Eşleştirme" panelini açar
   ↓
2. Parametreleri ayarlar:
   - Batch boyutu: 1000
   - Yeniden eşleştir: ✅ Evet
   ↓
3. "Başlat" butonuna tıklar
   ↓
4. Backend her SUT işlem için:
   - IsOverridden=1 mi kontrol et
   - Evet ise → ATLA (manuel değişiklik korunur)
   - Hayır ise → Yeniden eşleştir
   ↓
5. Sonuçları döndür:
   - Eşleşen: 950
   - Atlanan (manuel): 50
   ↓
6. İstatistikler güncellenir
```

**Kod:**
```javascript
// MatchingEngine.saveMatch()
if (existing.IsOverridden === 1) {
  console.log(`⚠️  Skipping SutID ${sutId} - manually overridden`);
  return existing; // Değiştirme, koru
}

// Normal güncelleme
UPDATE AltTeminatIslemler
SET AltTeminatID = @newAltTeminatId, ...
WHERE SutID = @sutId
```

### 5. Eşleşmemiş Kayıtları Manuel Eşleştirme

**Akış:**
```
1. Kullanıcı "Eşleşmemiş Kayıtlar" sayfasına gider
   ↓
2. 124 eşleşmemiş kayıt listelenir
   ↓
3. Her kayıt için HUV önerileri gösterilir (benzerlik skorlu)
   ↓
4. Kullanıcı bir kayıt seçer
   ↓
5. "Eşleştir" butonuna tıklar
   ↓
6. HUV Teminat Seçim Dialog açılır (showSimilarity=true)
   ↓
7. Öneriler benzerlik skoruna göre sıralanır
   ↓
8. Kullanıcı en uygun teminatı seçer
   ↓
9. "Kaydet" butonuna tıklar
   ↓
10. Backend yeni eşleşmeyi kaydeder (IsAutomatic=0)
   ↓
11. Eşleşmemiş sayısı 123'e düşer
```


---

## Önemli Senaryolar ve Edge Case'ler

### Senaryo 1: Otomatik Eşleşme → Onaylama → Değiştirme

**Adımlar:**
1. Otomatik eşleşme: SUT 123 → HUV Teminat A (%85)
2. Kullanıcı onaylar: IsApproved=1
3. Kullanıcı değiştirmeye karar verir
4. Yeni teminat seçer: HUV Teminat B
5. Sonuç:
   - AltTeminatID: B
   - IsApproved: 0 (sıfırlanır)
   - IsOverridden: 1
   - OriginalAltTeminatID: A

**Not:** Onay durumu değişiklik sonrası sıfırlanır.

### Senaryo 2: Manuel Değiştirme → Batch Eşleştirme

**Adımlar:**
1. Otomatik eşleşme: SUT 123 → HUV Teminat A (%85)
2. Kullanıcı değiştirir: SUT 123 → HUV Teminat B (IsOverridden=1)
3. Batch eşleştirme çalışır (forceRematch=true)
4. SUT 123 için yeni eşleşme bulunur: HUV Teminat C (%92)
5. Sonuç: SUT 123 → HUV Teminat B (değişmez, korunur)

**Neden?** IsOverridden=1 olduğu için batch atlıyor.

### Senaryo 3: Aynı SUT'u İki Kez Değiştirme

**Adımlar:**
1. Otomatik eşleşme: SUT 123 → HUV Teminat A (%85)
2. İlk değişiklik: SUT 123 → HUV Teminat B
   - OriginalAltTeminatID: A
3. İkinci değişiklik: SUT 123 → HUV Teminat C
   - OriginalAltTeminatID: A (değişmez, ilk orijinal korunur)

**Not:** Orijinal değerler her zaman ilk otomatik eşleşmeyi gösterir.

### Senaryo 4: Eşleşmemiş Kayıt → Manuel Eşleştirme

**Adımlar:**
1. SUT 999 eşleşmemiş (AltTeminatIslemler'de yok)
2. Kullanıcı manuel eşleştirir: SUT 999 → HUV Teminat X
3. Sonuç:
   - IsAutomatic: 0 (manuel)
   - IsOverridden: 0 (ilk eşleşme, değişiklik yok)
   - OriginalAltTeminatID: NULL

**Not:** İlk eşleşme manuel ise IsOverridden=0 olur.

### Senaryo 5: Yüksek Güven Skoru ama Yanlış Eşleşme

**Adımlar:**
1. Otomatik eşleşme: SUT 456 → HUV Teminat A (%95)
2. Kullanıcı kontrol eder, yanlış olduğunu görür
3. Değiştirir: SUT 456 → HUV Teminat B
4. Sonuç:
   - ConfidenceScore: 95 (eski skor korunur)
   - IsOverridden: 1
   - OriginalConfidenceScore: 95

**Not:** Güven skoru değişmez, sadece referans için kalır.

### Senaryo 6: Batch Eşleştirme Sırasında Hata

**Adımlar:**
1. Batch 1000 kayıt işliyor
2. 500. kayıtta hata oluşur
3. Sonuç:
   - İlk 499 kayıt işlendi
   - 500. kayıt errors array'ine eklendi
   - Kalan 500 kayıt işlenmeye devam eder

**Kod:**
```javascript
try {
  await this.saveMatch(...);
  matchedCount++;
} catch (error) {
  errors.push({
    sutId: sutIslem.sutId,
    error: error.message
  });
  unmatchedCount++;
}
```

---

## API Endpoint'leri Özeti

### 1. Batch Eşleştirme
```
POST /api/matching/run-batch

Request:
{
  batchSize: 100,
  anaDalKodu: null,
  forceRematch: false
}

Response:
{
  success: true,
  data: {
    totalProcessed: 100,
    matchedCount: 95,
    unmatchedCount: 5,
    highConfidenceCount: 70,
    mediumConfidenceCount: 20,
    lowConfidenceCount: 5,
    errors: [],
    durationMs: 5230
  }
}
```

### 2. Eşleşmeleri Listele
```
GET /api/matching/results?page=1&limit=50&sutKodu=10.01

Response:
{
  success: true,
  data: [...],
  pagination: {
    page: 1,
    limit: 50,
    total: 7005,
    totalPages: 141
  }
}
```

### 3. Eşleşmeyi Onayla
```
POST /api/matching/approve/:sutId

Request:
{
  userId: 1
}

Response:
{
  success: true,
  message: "Match approved successfully",
  data: { ... }
}
```

### 4. Eşleşmeyi Değiştir
```
PUT /api/matching/change/:sutId

Request:
{
  newAltTeminatId: 999,
  userId: 1
}

Response:
{
  success: true,
  message: "Match changed successfully",
  data: { ... }
}
```

### 5. HUV Seçeneklerini Getir
```
GET /api/matching/huv-options/:sutId

Response:
{
  success: true,
  data: [
    {
      altTeminatId: 1,
      altTeminatAdi: "LABORATUVAR",
      anaDalKodu: 34,
      anaDalAdi: "LABORATUVAR İNCELEMELERİ"
    },
    ...
  ]
}
```

### 6. İstatistikleri Getir
```
GET /api/matching/stats

Response:
{
  success: true,
  data: {
    totalIslemler: 7129,
    matchedCount: 7005,
    unmatchedCount: 124,
    matchedPercentage: 98.26,
    needsReviewCount: 1234,
    manualOverridesCount: 45,
    highConfidenceCount: 5234,
    mediumConfidenceCount: 1421,
    lowConfidenceCount: 190
  }
}
```

---

## Performans ve Optimizasyon

### Database Indexes

**Kritik Index'ler:**
```sql
-- Eşleşme sorgulama için
CREATE INDEX IX_AltTeminatIslemler_SutID 
ON AltTeminatIslemler(SutID)

-- Batch koruma için
CREATE INDEX IX_AltTeminatIslemler_IsOverridden 
ON AltTeminatIslemler(IsOverridden)
```

**Performans Test Sonuçları:**
- SutID Lookup: 1.44ms ortalama (100 sorgu)
- IsOverridden Filter: 4ms (7,005 kayıt)
- Genel: EXCELLENT ✅

### Batch Processing

**Chunk Size:** 50 kayıt
- Her chunk paralel değil, sıralı işlenir
- Database consistency için

**Batch Size Limitleri:**
- Minimum: 1
- Maximum: 10,000
- Önerilen: 100-1,000

**Süre Tahminleri:**
- 100 kayıt: ~5-10 saniye
- 1,000 kayıt: ~45-60 saniye
- 7,129 kayıt (tümü): ~5-7 dakika

### Frontend Optimizasyonları

**Pagination:**
- Sayfa başına 50 kayıt
- Lazy loading yok (şimdilik)

**Filtreleme:**
- Backend'de SQL filtreleme
- Frontend'de ek filtreleme yok

**Benzerlik Hesaplama:**
- Sadece dialog açıldığında
- Tüm HUV teminatları için (cache yok)

---

## Gelecek İyileştirmeler

### 1. Toplu Onaylama
**Özellik:** Birden fazla eşleşmeyi tek seferde onaylama

**Kullanım:**
```javascript
POST /api/matching/approve-batch
{
  sutIds: [123, 124, 125],
  userId: 1
}
```

### 2. Orijinal Eşleşmeye Dön
**Özellik:** Manuel değişikliği geri al, otomatik eşleşmeye dön

**UI:**
```jsx
{match.isOverridden && (
  <Button onClick={() => handleRevertToOriginal(match.sutId)}>
    Orijinal Eşleşmeye Dön
  </Button>
)}
```

**Backend:**
```sql
UPDATE AltTeminatIslemler
SET 
  AltTeminatID = OriginalAltTeminatID,
  IsOverridden = 0,
  IsAutomatic = 1,
  ConfidenceScore = OriginalConfidenceScore,
  MatchingRuleType = OriginalRuleType
WHERE SutID = @sutId
```

### 3. Eşleşme Geçmişi
**Özellik:** Bir SUT işleminin tüm eşleşme geçmişini göster

**Tablo:** `AltTeminatIslemlerHistory`
```sql
HistoryID (PK)
SutID
AltTeminatID
ConfidenceScore
MatchingRuleType
ChangedAt
ChangedBy
ChangeType ('AUTO', 'MANUAL', 'APPROVED', 'REVERTED')
```

### 4. Benzerlik Skoru Cache
**Özellik:** Benzerlik skorlarını cache'le

**Tablo:** `SimilarityScoreCache`
```sql
SutID (PK)
AltTeminatID (PK)
SimilarityScore
CalculatedAt
```

### 5. Makine Öğrenmesi
**Özellik:** Onaylanmış eşleşmelerden öğren

**Yaklaşım:**
- Onaylanmış eşleşmeleri training data olarak kullan
- Yeni eşleşmeler için ML modeli ile tahmin
- Güven skorunu artır

### 6. Toplu İşlem Kuyruğu
**Özellik:** Büyük batch'leri arka planda işle

**Teknoloji:** Bull Queue (Redis)
```javascript
const queue = new Queue('matching');

queue.add('batch-matching', {
  batchSize: 10000,
  userId: 1
});
```

---

## Özet

### Güçlü Yönler ✅

1. **Otomatik Eşleştirme:** %98.26 başarı oranı
2. **Manuel Kontrol:** Kullanıcı her eşleşmeyi kontrol edebilir
3. **Koruma Mekanizması:** Manuel değişiklikler korunur
4. **Orijinal Değerler:** Geri dönüş imkanı
5. **Audit Trail:** Kim ne zaman değiştirdi takibi
6. **Benzerlik Skoru:** Kullanıcıya yardımcı olur
7. **Filtreleme:** Güçlü arama ve filtreleme
8. **Performans:** Hızlı ve optimize

### İyileştirilebilir Alanlar ⚠️

1. **Toplu Onaylama:** Şu anda yok
2. **Geri Alma:** Orijinal eşleşmeye dönüş UI'da yok
3. **Geçmiş:** Eşleşme geçmişi takibi yok
4. **Cache:** Benzerlik skorları her seferinde hesaplanıyor
5. **ML:** Makine öğrenmesi yok
6. **Queue:** Büyük batch'ler senkron işleniyor

### Kullanım İstatistikleri 📊

- **Toplam SUT İşlem:** 7,129
- **Eşleşen:** 7,005 (%98.26)
- **Eşleşmemiş:** 124 (%1.74)
- **Manuel Değişiklik:** ~45 (tahmini)
- **Onay Bekleyen:** ~1,234 (tahmini)

### Sonuç

Eşleştirme sistemi **çok iyi çalışıyor** ve **production-ready** durumda. Manuel kontrol ve koruma mekanizmaları güçlü. Gelecekte ML ve toplu işlemler eklenebilir.


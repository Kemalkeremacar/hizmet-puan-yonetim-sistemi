---
inclusion: auto
---

# Database Schema - HuvDB

## Terminology

**Important**: Throughout this system, "Üst Teminat" and "Alt Teminat" terms are used:

**HUV Structure**:
- **Üst Teminat** = Ana Dal (AnaDallar table) - 34 medical specialties
- **Alt Teminat** = Coverage Category (HuvAltTeminatlar table) - Categories under each Ana Dal

**SUT Structure**:
- **Üst Teminat** = Ana Başlık (SutAnaBasliklar table) - 10 main categories
- **Alt Teminat** = Hiyerarşi Başlığı (SutHiyerarsi table, Seviye 2-3) - Sub-categories

**Matching**:
```
SUT İşlem → HUV Alt Teminat (Coverage Category)
```

Note: HUV İşlemler (HuvIslemler table) is separate - contains specific procedures with prices.

---

## Connection Info
- **Server:** localhost\SQLEXPRESS
- **Database:** HuvDB
- **Collation:** Turkish_CI_AS
- **User:** huv_api_user / huv_api_2024!

## SUT (Sağlık Uygulama Tebliği) Tables

### SutIslemler
SUT işlemleri - Ana işlem tablosu (7,129 kayıt)

```sql
SutID (PK, INT, IDENTITY)
SutKodu (NVARCHAR(50)) - Örn: "100.123", "R001", "L045"
IslemAdi (NVARCHAR(500)) - İşlem açıklaması
Puan (DECIMAL(10,2)) - İşlem puanı
AnaBaslikNo (INT) - 1-10 arası ana başlık numarası
HiyerarsiID (INT, FK) - SutHiyerarsi tablosuna referans
Aciklama (NVARCHAR(MAX))
AktifMi (BIT) - Aktif/pasif durumu
OlusturmaTarihi (DATETIME)
GuncellemeTarihi (DATETIME)
VersionID (INT, FK) - ListeVersiyon tablosuna referans
```

### SutAnaBasliklar
SUT ana başlıklar - SUT Üst Teminat (10 adet: 1-10)

```sql
AnaBaslikNo (PK, INT) - 1-10 arası
AnaBaslikAdi (NVARCHAR(200))
HiyerarsiID (INT, FK) - SutHiyerarsi'de Seviye 1
AktifMi (BIT)
OlusturmaTarihi (DATETIME)
GuncellemeTarihi (DATETIME)
```

**Örnekler:**
- 1: CERRAHİ İŞLEMLER
- 8: RADYOTERAPİ
- 9: LABORATUVAR

### SutHiyerarsi
SUT hiyerarşik yapı (ağaç yapısı) - SUT Alt Teminat (Seviye 2-3)

```sql
HiyerarsiID (PK, INT, IDENTITY)
ParentID (INT, NULL) - Üst seviye ID
SeviyeNo (INT) - 1, 2, 3, 4 (derinlik)
Baslik (NVARCHAR(500)) - Hiyerarşi başlığı
Sira (INT) - Sıralama
AktifMi (BIT)
OlusturmaTarihi (DATETIME)
```

**Seviye Yapısı:**
- Seviye 1: Ana Başlık (10 adet) - SUT Üst Teminat
- Seviye 2: Alt Teminat (SUT Alt Teminat - yaygın kullanım)
- Seviye 3: Alt Teminat (SUT Alt Teminat - detay)
- Seviye 4+: Detay seviyeler

### SutKategoriler
SUT kategorileri (eski yapı, hiyerarşi ile değiştirildi)

```sql
KategoriID (PK, INT, IDENTITY)
AnaBaslikNo (INT)
KategoriAdi (NVARCHAR(200))
Aciklama (NVARCHAR(MAX))
AktifMi (BIT)
```

## HUV (Hastane Uygulama Veri) Tables

### HuvAltTeminatlar
HUV alt teminatlar - HUV Alt Teminat (Eşleştirme hedefi)

```sql
AltTeminatID (PK, INT, IDENTITY)
AltTeminatAdi (NVARCHAR(200)) - Örn: "LABORATUVAR", "A", "B"
UstTeminatAdi (NVARCHAR(200))
AnaDalKodu (INT, FK) - AnaDallar tablosuna referans (1-34)
Sira (INT) - Sıralama
AktifMi (BIT)
OlusturmaTarihi (DATETIME)
GuncellemeTarihi (DATETIME)
```

### AnaDallar
HUV ana dallar - HUV Üst Teminat (34 adet)

```sql
AnaDalKodu (PK, INT) - 1-34 arası
BolumAdi (NVARCHAR(200))
Aciklama (NVARCHAR(MAX))
AktifMi (BIT)
OlusturmaTarihi (DATETIME)
```

**Örnekler:**
- 27: RADYOTERAPİ
- 34: LABORATUVAR
- 1: GENEL CERRAHİ

**ÖNEMLİ:** SUT Ana Başlık (1-10) ≠ HUV Ana Dal (1-34)

### HuvIslemler
HUV işlemleri (eski yapı, artık kullanılmıyor)

```sql
IslemID (PK, INT, IDENTITY)
HuvKodu (NVARCHAR(50))
IslemAdi (NVARCHAR(500))
Birim (DECIMAL(10,2))
SutKodu (NVARCHAR(50)) - Eşleşme için kullanılır
AltTeminatID (INT, FK)
AnaDalKodu (INT)
```

## Eşleştirme Tables

### AltTeminatIslemler
SUT-HUV eşleştirme tablosu - EN ÖNEMLİ TABLO

```sql
ID (PK, INT, IDENTITY)
SutID (INT, FK) - SutIslemler.SutID
AltTeminatID (INT, FK) - HuvAltTeminatlar.AltTeminatID
ConfidenceScore (DECIMAL(5,2)) - 0-100 arası güven skoru
MatchingRuleType (NVARCHAR(50)) - Hangi strateji kullanıldı
IsAutomatic (BIT) - Otomatik mi manuel mi?
IsApproved (BIT) - Onaylandı mı?
IsOverridden (BIT) - Manuel değiştirildi mi? (ÖNEMLİ!)
CreatedAt (DATETIME)
CreatedBy (INT, NULL)
UpdatedAt (DATETIME, NULL)
UpdatedBy (INT, NULL)

-- Manuel değişiklik için orijinal değerler
OriginalAltTeminatID (INT, NULL)
OriginalConfidenceScore (DECIMAL(5,2), NULL)
OriginalRuleType (NVARCHAR(50), NULL)
OverriddenAt (DATETIME, NULL)
OverriddenBy (INT, NULL)
```

**MatchingRuleType Değerleri:**
- `direct_sut_code` - Direkt SUT kodu eşleşmesi (%100)
- `hierarchy_matching` - Hiyerarşi başlığı eşleşmesi
- `first_letter` - İlk harf stratejisi (laboratuvar)
- `general_similarity` - Genel benzerlik kuralları

**IsOverridden Kullanımı:**
- `0` veya `NULL`: Otomatik eşleşme, batch ile güncellenebilir
- `1`: Manuel değiştirilmiş, batch ATLAR!

## Versiyon Yönetimi Tables

### ListeVersiyon
Import edilen listelerin versiyonları

```sql
VersionID (PK, INT, IDENTITY)
ListeTipi (NVARCHAR(50)) - 'SUT', 'HUV', 'IlKatsayi'
DosyaAdi (NVARCHAR(255))
YuklemeTarihi (DATETIME)
YukleyenKullanici (NVARCHAR(100))
Aciklama (NVARCHAR(MAX))
EklenenSayisi (INT)
GuncellenenSayisi (INT)
SilinenSayisi (INT)
AktifMi (BIT)
```

## User Tables

### Users
Kullanıcı tablosu

```sql
id (PK, INT, IDENTITY)
username (NVARCHAR(50), UNIQUE)
password (NVARCHAR(255)) - Hashed
email (NVARCHAR(100))
role (NVARCHAR(20)) - 'admin', 'user'
created_at (DATETIME)
```

**Default User:**
- Username: admin
- Password: admin123
- Role: admin

## Views

### vw_SutIslemDetay
SUT işlemleri detaylı view

```sql
SELECT 
  s.SutID, s.SutKodu, s.IslemAdi, s.Puan,
  s.AnaBaslikNo, ab.AnaBaslikAdi,
  k.KategoriID, k.KategoriAdi,
  s.HiyerarsiID, h.Baslik as HiyerarsiBaslik
FROM SutIslemler s
LEFT JOIN SutAnaBasliklar ab ON s.AnaBaslikNo = ab.AnaBaslikNo
LEFT JOIN SutKategoriler k ON s.KategoriID = k.KategoriID
LEFT JOIN SutHiyerarsi h ON s.HiyerarsiID = h.HiyerarsiID
WHERE s.AktifMi = 1
```

### vw_SutAnaBaslikOzet
Ana başlık özet view

```sql
SELECT 
  ab.AnaBaslikNo, ab.AnaBaslikAdi,
  COUNT(s.SutID) as IslemSayisi,
  SUM(s.Puan) as ToplamPuan
FROM SutAnaBasliklar ab
LEFT JOIN SutIslemler s ON ab.AnaBaslikNo = s.AnaBaslikNo AND s.AktifMi = 1
GROUP BY ab.AnaBaslikNo, ab.AnaBaslikAdi
```

## Stored Procedures

### sp_SutHiyerarsiGetir
Hiyerarşi ağacını getir

```sql
CREATE PROCEDURE sp_SutHiyerarsiGetir
  @AnaBaslikNo INT = NULL,
  @ParentID INT = NULL
AS
BEGIN
  -- Recursive CTE ile hiyerarşi ağacı
END
```

## Additional Tables

### SutIslemVersionlar
SUT işlem versiyonları (tarihsel kayıtlar)

```sql
SutVersionID (PK, INT, IDENTITY)
SutID (INT, FK) - SutIslemler.SutID
SutKodu (NVARCHAR(50))
IslemAdi (NVARCHAR(MAX))
Puan (FLOAT)
AnaBaslikNo (INT, FK)
HiyerarsiID (INT)
GecerlilikBaslangic (DATE)
GecerlilikBitis (DATE)
ListeVersiyonID (INT, FK)
DegisiklikSebebi (NVARCHAR(500))
OlusturanKullanici (NVARCHAR(100))
OlusturmaTarihi (DATETIME)
```

### IslemVersionlar
HUV işlem versiyonları (tarihsel kayıtlar)

```sql
VersionID (PK, INT, IDENTITY)
IslemID (INT, FK) - HuvIslemler.IslemID
HuvKodu (DECIMAL(10,5))
IslemAdi (NVARCHAR(MAX))
EskiBirim (FLOAT)
YeniBirim (FLOAT)
GecerlilikBaslangic (DATE)
GecerlilikBitis (DATE)
ListeVersiyonID (INT, FK)
AktifMi (BIT)
OlusturanKullanici (NVARCHAR(100))
OlusturmaTarihi (DATETIME)
```

### IslemAudit
İşlem değişiklik audit tablosu

```sql
AuditID (PK, INT, IDENTITY)
IslemID (INT, FK)
IslemTipi (NVARCHAR(20)) - 'INSERT', 'UPDATE', 'DELETE'
HuvKodu (FLOAT)
IslemAdi (NVARCHAR(MAX))
EskiBirim (FLOAT)
YeniBirim (FLOAT)
DegisiklikTarihi (DATETIME)
DegistirenKullanici (NVARCHAR(100))
Aciklama (NVARCHAR(500))
```

### Kullanicilar
Kullanıcı tablosu (alternatif auth sistemi)

```sql
KullaniciID (PK, INT, IDENTITY)
KullaniciAdi (NVARCHAR(100), UNIQUE)
Sifre (NVARCHAR(255)) - Hashed
Email (NVARCHAR(100))
Rol (NVARCHAR(20)) - 'admin', 'user'
AktifMi (BIT)
OlusturmaTarihi (DATETIME)
SonGirisTarihi (DATETIME)
SonGirisIP (NVARCHAR(50))
```

## Indexes

### Performance Indexes (IMPLEMENTED ✅)
```sql
-- AltTeminatIslemler (Critical for matching performance)
CREATE INDEX IX_AltTeminatIslemler_SutID ON AltTeminatIslemler(SutID)
CREATE INDEX IX_AltTeminatIslemler_IsOverridden ON AltTeminatIslemler(IsOverridden)
```

**Performance Test Results:**
- SutID Lookup: 1.44ms average (100 queries)
- IsOverridden Filter: 4ms (7,005 records)
- Complex Join: 13ms
- Overall: EXCELLENT ✅

### Optional Indexes (Not needed currently)
```sql
-- Only add if data grows beyond 50,000 records or performance degrades

-- SutIslemler
CREATE INDEX IX_SutIslemler_AktifMi ON SutIslemler(AktifMi)
CREATE INDEX IX_SutIslemler_HiyerarsiID ON SutIslemler(HiyerarsiID)

-- HuvAltTeminatlar
CREATE INDEX IX_HuvAltTeminatlar_AnaDalKodu ON HuvAltTeminatlar(AnaDalKodu)
CREATE INDEX IX_HuvAltTeminatlar_AktifMi ON HuvAltTeminatlar(AktifMi)

-- SutHiyerarsi
CREATE INDEX IX_SutHiyerarsi_ParentID ON SutHiyerarsi(ParentID)
CREATE INDEX IX_SutHiyerarsi_SeviyeNo ON SutHiyerarsi(SeviyeNo)
```

**Note:** SutKodu already has UNIQUE constraint (automatic index)

## Foreign Keys

```sql
-- SutIslemler
FK_SutIslemler_AnaBaslik (AnaBaslikNo -> SutAnaBasliklar.AnaBaslikNo)
FK_SutIslemler_Hiyerarsi (HiyerarsiID -> SutHiyerarsi.HiyerarsiID)
FK_SutIslemler_ListeVersiyon (ListeVersiyonID -> ListeVersiyon.VersionID)

-- SutAnaBasliklar
FK_SutAnaBasliklar_Hiyerarsi (HiyerarsiID -> SutHiyerarsi.HiyerarsiID)

-- SutHiyerarsi
FK_SutHiyerarsi_Parent (ParentID -> SutHiyerarsi.HiyerarsiID) - Self-referencing

-- AltTeminatIslemler
FK_AltTeminatIslemler_SutIslemler (SutID -> SutIslemler.SutID)
FK_AltTeminatIslemler_HuvAltTeminatlar (AltTeminatID -> HuvAltTeminatlar.AltTeminatID)

-- HuvAltTeminatlar
FK_HuvAltTeminatlar_AnaDallar (AnaDalKodu -> AnaDallar.AnaDalKodu)

-- HuvIslemler
FK_HuvIslemler_AnaDallar (AnaDalKodu -> AnaDallar.AnaDalKodu)
FK_HuvIslemler_ListeVersiyon (ListeVersiyonID -> ListeVersiyon.VersionID)

-- IlKatsayiVersionlar
FK_IlKatsayiVersionlar_IlKatsayilari (IlKatsayiID -> IlKatsayilari.IlKatsayiID)
FK_IlKatsayiVersionlar_ListeVersiyon (ListeVersiyonID -> ListeVersiyon.VersionID)

-- IslemVersionlar
FK_IslemVersionlar_HuvIslemler (IslemID -> HuvIslemler.IslemID)
FK_IslemVersionlar_ListeVersiyon (ListeVersiyonID -> ListeVersiyon.VersionID)

-- SutIslemVersionlar
FK_SutIslemVersionlar_ListeVersiyon (ListeVersiyonID -> ListeVersiyon.VersionID)
FK_SutIslemVersionlar_SutAnaBasliklar (AnaBaslikNo -> SutAnaBasliklar.AnaBaslikNo)
```

## Data Integrity Rules

1. **Soft Delete:** `AktifMi = 0` (kayıtlar silinmez)
2. **Versioning:** Her import yeni `VersionID` oluşturur
3. **Manual Override Protection:** `IsOverridden = 1` kayıtlar batch'te korunur
4. **Cascade:** Foreign key'ler genelde NO ACTION (veri kaybı önleme)

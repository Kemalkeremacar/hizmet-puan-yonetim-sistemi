# HUV Veritabanı Şema Dokümantasyonu

**Oluşturulma Tarihi:** 12.05.2026

---

## 📊 Veritabanı Genel Bakış

### Temel Bilgiler

| Özellik | Değer |
|---------|-------|
| Veritabanı Adı | HuvDB |
| DBMS | Microsoft SQL Server 2022 Express |
| Collation | Turkish_CI_AS |
| Recovery Model | SIMPLE |
| Toplam Tablo | 15 |
| Toplam View | 4 |
| Toplam SP | 16 |
| Toplam Satır | ~70,000 |
| Toplam Alan | ~57 MB |

---

## 🗂️ Tablo Grupları

### 1. Ana Veri Tabloları

#### HuvIslemler (HUV İşlemleri)
**Amaç**: Sağlık hizmetleri fiyat listesi ana tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| IslemID | int (PK) | Benzersiz işlem ID |
| HuvKodu | decimal(10,5) | HUV kodu |
| IslemAdi | nvarchar(MAX) | İşlem adı |
| Birim | float | Fiyat |
| SutKodu | nvarchar(100) | İlişkili SUT kodu |
| AnaDalKodu | int (FK) | Ana dal referansı |
| AltTeminatID | int (FK) | Alt teminat referansı |
| ListeVersiyonID | int (FK) | Versiyon referansı |
| AktifMi | bit | Aktiflik durumu |

**İlişkiler**:
- → AnaDallar (AnaDalKodu)
- → HuvAltTeminatlar (AltTeminatID)
- → ListeVersiyon (ListeVersiyonID)

**Indexler**: 9 index (HuvKodu, AnaDalKodu, Birim, vb.)

**Trigger'lar**:
- TR_Islemler_Insert_Audit
- TR_Islemler_Update_Audit
- TR_Islemler_Delete_Audit

---

#### SutIslemler (SUT İşlemleri)
**Amaç**: SUT kodları ve puanlama sistemi

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| SutID | int (PK) | Benzersiz SUT ID |
| SutKodu | nvarchar(50) (Unique) | SUT kodu |
| IslemAdi | nvarchar(MAX) | İşlem adı |
| Puan | float | SUT puanı |
| HiyerarsiID | int (FK) | Hiyerarşi referansı |
| AnaBaslikNo | int (FK) | Ana başlık referansı |
| ListeVersiyonID | int (FK) | Versiyon referansı |
| AktifMi | bit | Aktiflik durumu |

**İlişkiler**:
- → SutHiyerarsi (HiyerarsiID)
- → SutAnaBasliklar (AnaBaslikNo)
- → ListeVersiyon (ListeVersiyonID)

**Indexler**: 6 index (SutKodu unique, HiyerarsiID, vb.)

---

#### AnaDallar (Ana Dallar)
**Amaç**: Tıbbi branş/dal tanımları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| AnaDalKodu | int (PK) | Ana dal kodu |
| BolumAdi | nvarchar(200) | Bölüm adı |
| ToplamIslemSayisi | int | İşlem sayısı |
| OlusturmaTarihi | datetime | Oluşturma tarihi |

**Satır Sayısı**: 34

---

### 2. Eşleştirme Tabloları

#### HuvAltTeminatlar (Alt Teminatlar)
**Amaç**: HUV işlemlerinin alt teminat kategorileri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| AltTeminatID | int (PK, Identity) | Benzersiz ID |
| AltTeminatAdi | nvarchar(255) | Alt teminat adı |
| UstTeminatAdi | nvarchar(255) | Üst teminat adı |
| AnaDalKodu | int (FK) | Ana dal referansı |
| Sira | int | Sıralama |
| AktifMi | bit | Aktiflik durumu |

**Unique Constraint**: (AnaDalKodu, UstTeminatAdi, AltTeminatAdi)

**Satır Sayısı**: 333

---

#### AltTeminatIslemler (Eşleştirmeler)
**Amaç**: HUV işlemleri ile SUT kodları arasındaki eşleştirmeler

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| ID | int (PK, Identity) | Benzersiz ID |
| AltTeminatID | int (FK) | Alt teminat referansı |
| SutID | int (FK) | SUT referansı |
| ConfidenceScore | decimal(5,2) | Eşleştirme güven skoru (0-100) |
| MatchingRuleType | nvarchar(50) | Eşleştirme kuralı tipi |
| IsAutomatic | bit | Otomatik mi? |
| IsApproved | bit | Onaylandı mı? |
| IsOverridden | bit | Override edildi mi? |
| CreatedBy | int | Oluşturan kullanıcı |
| UpdatedBy | int | Güncelleyen kullanıcı |

**İlişkiler**:
- → HuvAltTeminatlar (AltTeminatID)
- → SutIslemler (SutID)

**Unique Constraint**: SutID (Her SUT sadece bir alt teminata eşleşebilir)

**Indexler**: 7 index (ConfidenceScore, MatchingRuleType, IsApproved, vb.)

**Satır Sayısı**: ~4,000

---

### 3. Hiyerarşi Tabloları

#### SutHiyerarsi (SUT Hiyerarşisi)
**Amaç**: SUT kodlarının hiyerarşik yapısı

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| HiyerarsiID | int (PK, Identity) | Benzersiz ID |
| ParentID | int (FK, Self) | Üst hiyerarşi |
| SeviyeNo | int | Seviye numarası |
| SeviyeAdi | nvarchar(50) | Seviye adı |
| Baslik | nvarchar(MAX) | Başlık |
| SutKoduBaslangic | nvarchar(100) | Kod aralığı başlangıç |
| SutKoduBitis | nvarchar(100) | Kod aralığı bitiş |
| Sira | int | Sıralama |
| AktifMi | bit | Aktiflik durumu |

**Self-Referencing**: ParentID → HiyerarsiID (Ağaç yapısı)

**Satır Sayısı**: 390

---

#### SutAnaBasliklar (SUT Ana Başlıklar)
**Amaç**: SUT işlemlerinin ana kategorileri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| AnaBaslikNo | int (PK) | Ana başlık numarası |
| AnaBaslikAdi | nvarchar(500) | Ana başlık adı |
| Aciklama | nvarchar(MAX) | Açıklama |
| HiyerarsiID | int (FK) | Hiyerarşi referansı |
| Sira | int | Sıralama |
| ToplamIslemSayisi | int | İşlem sayısı |
| AktifMi | bit | Aktiflik durumu |

**Satır Sayısı**: 10

---

### 4. Versiyon ve Tarihsel Tablolar

#### ListeVersiyon (Liste Versiyonları)
**Amaç**: Excel import versiyonlarının takibi

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| VersionID | int (PK, Identity) | Versiyon ID |
| ListeTipi | nvarchar(50) | Liste tipi (HUV/SUT/IL_KATSAYI) |
| YuklemeTarihi | date | Yükleme tarihi |
| DosyaAdi | nvarchar(255) | Dosya adı |
| KayitSayisi | int | Toplam kayıt |
| EklenenSayisi | int | Eklenen kayıt |
| GuncellenenSayisi | int | Güncellenen kayıt |
| SilinenSayisi | int | Silinen kayıt |
| Aciklama | nvarchar(500) | Açıklama |
| YukleyenKullanici | nvarchar(100) | Yükleyen kullanıcı |

**Satır Sayısı**: 6

---

#### IslemVersionlar (HUV Tarihsel)
**Amaç**: HUV işlemlerinin tarihsel kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| VersionID | int (PK, Identity) | Versiyon ID |
| IslemID | int (FK) | İşlem referansı |
| HuvKodu | decimal(10,5) | HUV kodu |
| IslemAdi | nvarchar(MAX) | İşlem adı |
| Birim | float | Fiyat |
| GecerlilikBaslangic | date | Geçerlilik başlangıç |
| GecerlilikBitis | date | Geçerlilik bitiş |
| AktifMi | bit | Aktiflik durumu |
| ListeVersiyonID | int (FK) | Liste versiyon referansı |
| DegisiklikSebebi | nvarchar(500) | Değişiklik sebebi |
| OlusturanKullanici | nvarchar(100) | Oluşturan kullanıcı |

**İlişkiler**:
- → HuvIslemler (IslemID)
- → ListeVersiyon (ListeVersiyonID)

**Indexler**: 7 index (IslemID, GecerlilikBaslangic, HuvKodu, vb.)

**Satır Sayısı**: ~17,000

---

#### SutIslemVersionlar (SUT Tarihsel)
**Amaç**: SUT işlemlerinin tarihsel kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| SutVersionID | int (PK, Identity) | Versiyon ID |
| SutID | int (FK) | SUT referansı |
| SutKodu | nvarchar(50) | SUT kodu |
| IslemAdi | nvarchar(MAX) | İşlem adı |
| Puan | float | SUT puanı |
| GecerlilikBaslangic | date | Geçerlilik başlangıç |
| GecerlilikBitis | date | Geçerlilik bitiş |
| AktifMi | bit | Aktiflik durumu |
| ListeVersiyonID | int (FK) | Liste versiyon referansı |
| DegisiklikSebebi | nvarchar(500) | Değişiklik sebebi |
| OlusturanKullanici | nvarchar(100) | Oluşturan kullanıcı |

**İlişkiler**:
- → SutIslemler (SutID)
- → ListeVersiyon (ListeVersiyonID)

**Indexler**: 7 index (SutID, GecerlilikBaslangic, SutKodu, vb.)

**Satır Sayısı**: ~7,100

---

#### IslemAudit (Audit Trail)
**Amaç**: Tüm HUV işlem değişikliklerinin audit kaydı

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| AuditID | int (PK, Identity) | Audit ID |
| IslemID | int | İşlem ID |
| IslemTipi | nvarchar(20) | İşlem tipi (INSERT/UPDATE/DELETE) |
| HuvKodu | decimal(10,5) | HUV kodu |
| IslemAdi | nvarchar(MAX) | İşlem adı |
| EskiBirim | float | Eski fiyat |
| YeniBirim | float | Yeni fiyat |
| DegisiklikTarihi | datetime | Değişiklik tarihi |
| DegistirenKullanici | nvarchar(100) | Değiştiren kullanıcı |
| Aciklama | nvarchar(500) | Açıklama |

**Indexler**: 4 index (IslemID, IslemTipi, DegisiklikTarihi)

**Satır Sayısı**: ~17,000

**Not**: Trigger'lar tarafından otomatik doldurulur

---

### 5. İl Katsayıları Tabloları

#### IlKatsayilari (İl Katsayıları)
**Amaç**: İl bazlı fiyat katsayıları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| IlKatsayiID | int (PK, Identity) | Katsayı ID |
| IlAdi | nvarchar(100) | İl adı |
| PlakaKodu | int | Plaka kodu |
| Katsayi | decimal(18,2) | Katsayı değeri |
| DonemBaslangic | date | Dönem başlangıç |
| DonemBitis | date | Dönem bitiş |
| AktifMi | bit | Aktiflik durumu |

**Unique Constraint**: IlAdi (Her il için tek aktif kayıt)

**Satır Sayısı**: 81

---

#### IlKatsayiVersionlar (İl Katsayı Tarihsel)
**Amaç**: İl katsayılarının tarihsel kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| VersionID | int (PK, Identity) | Versiyon ID |
| IlKatsayiID | int (FK) | Katsayı referansı |
| IlAdi | nvarchar(100) | İl adı |
| Katsayi | decimal(18,2) | Katsayı değeri |
| GecerlilikBaslangic | date | Geçerlilik başlangıç |
| GecerlilikBitis | date | Geçerlilik bitiş |
| ListeVersiyonID | int (FK) | Liste versiyon referansı |

**Satır Sayısı**: 162

---

### 6. Kullanıcı Tabloları

#### Kullanicilar (Kullanıcılar)
**Amaç**: Sistem kullanıcıları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| KullaniciID | int (PK, Identity) | Kullanıcı ID |
| KullaniciAdi | nvarchar(100) (Unique) | Kullanıcı adı |
| Sifre | nvarchar(255) | Şifre (bcrypt hash) |
| Rol | nvarchar(20) | Rol (admin/user) |
| AktifMi | bit | Aktiflik durumu |
| OlusturmaTarihi | datetime | Oluşturma tarihi |
| SonGirisTarihi | datetime | Son giriş tarihi |
| SonGirisIP | nvarchar(50) | Son giriş IP |

**Satır Sayısı**: 2

---

## 🔗 İlişki Diyagramı

### Ana İlişkiler

```
AnaDallar (1) ──────────── (N) HuvIslemler
                │
                └────────── (N) HuvAltTeminatlar (1) ──── (N) AltTeminatIslemler
                                                                      │
SutHiyerarsi (1) ──────────── (N) SutIslemler (1) ──────────────────┘
      │                              │
      │ (Self)                       │
      └──────────────────────────────┴──────── (N) SutIslemVersionlar
      
SutAnaBasliklar (1) ──────────── (N) SutIslemler

ListeVersiyon (1) ──────────── (N) HuvIslemler
                 │
                 ├──────────── (N) SutIslemler
                 │
                 ├──────────── (N) IslemVersionlar
                 │
                 ├──────────── (N) SutIslemVersionlar
                 │
                 └──────────── (N) IlKatsayiVersionlar

HuvIslemler (1) ──────────── (N) IslemVersionlar
```

---

## 📈 View'lar

### vw_IslemArama
**Amaç**: HUV işlem araması için optimize edilmiş view

**Kolonlar**:
- IslemID, HuvKodu, IslemAdi, Birim
- SutKodu, HiyerarsiSeviyesi, UstBaslik
- AnaDalKodu, BolumAdi
- AramaMetni (Birleştirilmiş arama alanı)

**Kullanım**: Full-text search için

---

### vw_SutIslemDetay
**Amaç**: SUT işlem detayları

**Kolonlar**:
- SutID, SutKodu, IslemAdi, Puan
- AnaBaslikNo, AnaBaslikAdi
- HiyerarsiID, HiyerarsiBaslik

**Kullanım**: SUT detay görüntüleme

---

### vw_SutAnaBaslikOzet
**Amaç**: SUT ana başlık istatistikleri

**Kolonlar**:
- AnaBaslikNo, AnaBaslikAdi
- IslemSayisi, HiyerarsiSayisi
- MinPuan, MaxPuan, OrtalamaPuan
- PuanliIslemSayisi

**Kullanım**: Dashboard ve raporlama

---

### vw_SutKategoriOzet
**Amaç**: SUT kategori istatistikleri

**Kolonlar**:
- KategoriID, KategoriAdi
- ParentID, Seviye, Sira
- IslemSayisi, MinPuan, MaxPuan, OrtalamaPuan

**Kullanım**: Hiyerarşik raporlama

---

## ⚙️ Stored Procedures

### Arama ve Filtreleme

#### sp_IslemAra
**Parametreler**:
- @AramaMetni: Arama terimi
- @AnaDalKodu: Ana dal filtresi
- @MinBirim, @MaxBirim: Fiyat aralığı

**Dönüş**: Filtrelenmiş işlem listesi

---

#### sp_IslemlerSutKodu
**Parametreler**:
- @SutKodu: SUT kodu

**Dönüş**: Belirtilen SUT koduna sahip işlemler

---

### Tarihsel Sorgular

#### sp_TarihtekiFiyat
**Parametreler**:
- @IslemID: İşlem ID
- @Tarih: Sorgu tarihi

**Dönüş**: Belirtilen tarihteki fiyat

---

#### sp_TarihAraligindaDegişenler
**Parametreler**:
- @BaslangicTarihi: Başlangıç
- @BitisTarihi: Bitiş

**Dönüş**: Tarih aralığında değişen işlemler

---

#### sp_FiyatDegisimRaporu
**Parametreler**:
- @HuvKodu veya @IslemID
- @BaslangicTarihi, @BitisTarihi

**Dönüş**: Fiyat değişim geçmişi

---

### SUT Stored Procedures

#### sp_SutHiyerarsiGetir
**Parametreler**:
- @ParentID: Üst hiyerarşi ID (NULL = root)

**Dönüş**: Hiyerarşik ağaç yapısı

---

#### sp_SutTarihtekiPuan
**Parametreler**:
- @SutID: SUT ID
- @Tarih: Sorgu tarihi

**Dönüş**: Belirtilen tarihteki puan

---

#### sp_SutVersiyonKarsilastir
**Parametreler**:
- @SutID: SUT ID
- @Tarih1, @Tarih2: Karşılaştırma tarihleri

**Dönüş**: İki tarih arasındaki farklar

---

### İstatistiksel Sorgular

#### sp_EnPahaliIslemler
**Parametreler**:
- @TopN: Kaç kayıt (default: 50)
- @AnaDalKodu: Ana dal filtresi (optional)

**Dönüş**: En pahalı N işlem

---

#### sp_EnUcuzIslemler
**Parametreler**:
- @TopN: Kaç kayıt (default: 50)
- @AnaDalKodu: Ana dal filtresi (optional)

**Dönüş**: En ucuz N işlem

---

## 🔐 Güvenlik Özellikleri

### Constraint'ler

1. **Primary Keys**: Tüm tablolarda
2. **Foreign Keys**: İlişkisel bütünlük
3. **Unique Constraints**: İş kuralları
4. **Check Constraints**: Veri doğrulama
5. **Default Values**: Otomatik değerler

### Trigger'lar

1. **Audit Triggers**: IslemAudit tablosuna otomatik kayıt
   - TR_Islemler_Insert_Audit
   - TR_Islemler_Update_Audit
   - TR_Islemler_Delete_Audit

### Index Stratejisi

1. **Clustered Index**: Primary key'lerde
2. **Non-Clustered Index**: Foreign key ve arama alanlarında
3. **Unique Index**: Business key'lerde
4. **Composite Index**: Çoklu kolon sorgularında

---

## 📊 Performans İstatistikleri

### Tablo Boyutları

| Tablo | Satır | Alan (MB) | Index Sayısı |
|-------|-------|-----------|--------------|
| IslemVersionlar | 17,185 | 23.88 | 7 |
| IslemAudit | 17,191 | 5.53 | 4 |
| HuvIslemler | 8,594 | 12.82 | 9 |
| SutIslemler | 7,130 | 5.24 | 6 |
| SutIslemVersionlar | 7,136 | 5.80 | 7 |
| AltTeminatIslemler | 3,991 | 1.62 | 7 |

### Query Performance

- **Ortalama Query Süresi**: < 50ms
- **Index Hit Ratio**: > 95%
- **Cache Hit Ratio**: > 90%

---

## 🔄 Bakım ve Optimizasyon

### Düzenli Bakım

1. **Index Rebuild**: Haftalık
2. **Statistics Update**: Günlük
3. **Backup**: Günlük (Full), Saatlik (Differential)
4. **Log Cleanup**: Haftalık

### Monitoring

1. **Deadlock Detection**: Aktif
2. **Long Running Queries**: > 5 saniye
3. **Blocking Queries**: > 10 saniye
4. **Index Fragmentation**: > 30%

---

**Son Güncelleme:** 12.05.2026
**Versiyon:** 1.0.0

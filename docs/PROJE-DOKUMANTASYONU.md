# HUV Yönetim Sistemi - Kapsamlı Proje Dokümantasyonu

> **Versiyon:** 2.0.0  
> **Son Güncelleme:** 12 Mayıs 2026  
> **Açıklama:** Sağlık Uygulama Tebliği (SUT) ve Hekim Uygulama Veri (HUV) Hizmet Listesi Yönetim Sistemi

---

## İçindekiler

1. [Proje Genel Bakış](#1-proje-genel-bakış)
2. [Mimari ve Teknoloji Yığını](#2-mimari-ve-teknoloji-yığını)
3. [Veritabanı Yapısı](#3-veritabanı-yapısı)
4. [Backend API Katmanı](#4-backend-api-katmanı)
5. [Frontend Katmanı](#5-frontend-katmanı)
6. [Excel Import Akışı (Baştan Sona)](#6-excel-import-akışı-baştan-sona)
7. [Karşılaştırma ve Değişiklik Algılama](#7-karşılaştırma-ve-değişiklik-algılama)
8. [SCD Type 2 Versiyonlama](#8-scd-type-2-versiyonlama)
9. [Tarihsel Sorgular](#9-tarihsel-sorgular)
10. [HUV ve SUT Farkları](#10-huv-ve-sut-farkları)
11. [İl Katsayıları](#11-il-katsayıları)
12. [Eşleşme (Matching) Sistemi](#12-eşleşme-matching-sistemi)
13. [Alt Teminatlar](#13-alt-teminatlar)
14. [Kimlik Doğrulama ve Yetkilendirme](#14-kimlik-doğrulama-ve-yetkilendirme)
15. [Hiyerarşi Ağacı](#15-hiyerarşi-ağacı)
16. [Türkçe Karakter Desteği](#16-türkçe-karakter-desteği)
17. [Yapılandırma ve Sabitler](#17-yapılandırma-ve-sabitler)
18. [Dış Servis API'si (External)](#18-dış-servis-apisi-external)
19. [Hata Yönetimi](#19-hata-yönetimi)
20. [Dosya Yapısı Referansı](#20-dosya-yapısı-referansı)

---

## 1. Proje Genel Bakış

### Ne Yapar?

HUV Yönetim Sistemi, sağlık sektöründeki iki temel listeyi yönetir:

- **HUV (Hekim Uygulama Veri) Listesi:** Sağlık işlemlerinin TL bazında birim fiyatlarını içerir. Resmi Excel dosyası SGK tarafından yayınlanır.
- **SUT (Sağlık Uygulama Tebliği) Listesi:** Sağlık işlemlerinin puan bazında değerlerini içerir. SUT kodları ile sağlık hizmeti fiyatlandırması yapılır.

### Temel İşlevler

| İşlev | Açıklama |
|-------|----------|
| **Liste Yükleme** | Excel dosyalarından HUV, SUT ve İl Katsayı listelerini sisteme aktarma |
| **Versiyon Yönetimi** | Her yükleme bir versiyon oluşturur; eski veriler tarihsel olarak saklanır (SCD Type 2) |
| **Karşılaştırma** | Yeni liste yüklendiğinde eski listeyle alan bazlı karşılaştırma yapılır |
| **Tarihsel Sorgular** | Geçmişe dönük fiyat/puan sorgulaması ve değişiklik takibi |
| **Hiyerarşi Ağacı** | HUV ve SUT işlemlerinin kategorik ağaç yapısında görüntülenmesi |
| **Eşleştirme** | SUT kodları ile HUV kodları arasında otomatik ve manuel eşleştirme |
| **Alt Teminatlar** | HUV ana dallarına bağlı alt teminat tanımlaması ve işlem atama |
| **İl Katsayıları** | İl bazlı çarpan katsayılarını yönetme |
| **Dış Servis API** | Diğer sistemlerin güncel listeye erişmesi için API |

### Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| **USER** | Liste görüntüleme, tarihsel sorgular, hiyerarşi ağacı, alt teminatlar |
| **ADMIN** | Tüm USER yetkileri + liste yükleme, versiyon yönetimi, eşleştirme yönetimi, il katsayı yönetimi |

---

## 2. Mimari ve Teknoloji Yığını

### Genel Mimari

```
┌──────────────────────────────────────────────────────────┐
│                       Frontend                            │
│  React 19 + Vite + React Router 7 + MUI v7               │
│  Port: 5173                                               │
├──────────────────────────────────────────────────────────┤
│                       Backend                             │
│  Node.js + Express 5                                      │
│  Port: 3000                                               │
├──────────────────────────────────────────────────────────┤
│                      Veritabanı                           │
│  SQL Server (mssql)                                       │
│  Turkish_CI_AS Collation                                  │
└──────────────────────────────────────────────────────────┘
```

### Teknoloji Detayları

**Frontend:**
| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| React | 19 | UI framework |
| Vite | - | Build tool ve dev server |
| React Router | 7 | Client-side routing |
| MUI (Material UI) | v7 | UI component kütüphanesi |
| @mui/x-tree-view | - | Hiyerarşi ağacı bileşeni |
| Emotion | - | CSS-in-JS (MUI'nin styling altyapısı) |
| Axios | - | HTTP istemcisi |

**Backend:**
| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| Node.js | - | Runtime |
| Express | 5 | Web framework |
| mssql | - | SQL Server bağlantısı |
| jsonwebtoken (JWT) | - | Kimlik doğrulama |
| multer | - | Dosya yükleme (multipart/form-data) |
| xlsx (SheetJS) | - | Excel dosya okuma |
| helmet | - | HTTP güvenlik başlıkları |
| cors | - | Cross-Origin kaynak paylaşımı |
| morgan | - | HTTP request loglama |
| he | - | HTML entity decode (Türkçe karakter) |
| dotenv | - | Ortam değişkenleri |

**Veritabanı:**
| Özellik | Değer |
|---------|-------|
| DBMS | Microsoft SQL Server |
| Bağlantı | mssql paketi (Connection Pool) |
| Auth | Windows Auth (NTLM) veya SQL Auth |
| Collation | Turkish_CI_AS (Türkçe karakter desteği) |

---

## 3. Veritabanı Yapısı

### 3.1. Tablo Diyagramı

```
┌──────────────────┐       ┌───────────────────┐
│   ListeVersiyon  │       │    Kullanicilar    │
│──────────────────│       │───────────────────│
│ VersionID (PK)   │       │ KullaniciID (PK)  │
│ ListeTipi        │       │ KullaniciAdi      │
│ YuklemeTarihi    │       │ Sifre (hash)      │
│ DosyaAdi         │       │ Rol               │
│ KayitSayisi      │       │ AktifMi           │
│ Aciklama         │       └───────────────────┘
│ YukleyenKullanici│
│ EklenenSayisi    │
│ GuncellenenSayisi│
│ SilinenSayisi    │
└────────┬─────────┘
         │
    ┌────┴─────────────────────────┐
    │                              │
┌───┴──────────────┐   ┌──────────┴────────┐
│   HuvIslemler    │   │   SutIslemler     │
│──────────────────│   │───────────────────│
│ IslemID (PK)     │   │ SutID (PK)        │
│ HuvKodu          │   │ SutKodu           │
│ IslemAdi         │   │ IslemAdi          │
│ Birim            │   │ Puan              │
│ SutKodu          │   │ Aciklama          │
│ AnaDalKodu (FK)  │   │ AnaBaslikNo (FK)  │
│ UstBaslik        │   │ HiyerarsiID (FK)  │
│ HiyerarsiSeviyesi│   │ AktifMi           │
│ Not              │   │ ListeVersiyonID   │
│ AktifMi          │   └──────────┬────────┘
│ ListeVersiyonID  │              │
│ ListeTipi        │   ┌──────────┴─────────────┐
└──────────┬───────┘   │  SutIslemVersionlar     │
           │           │────────────────────────│
┌──────────┴──────────┐│ VersionID (PK)          │
│  IslemVersionlar    ││ SutID (FK)              │
│─────────────────────││ SutKodu                 │
│ VersionID (PK)      ││ IslemAdi                │
│ IslemID (FK)        ││ Puan                    │
│ HuvKodu             ││ Aciklama                │
│ IslemAdi            ││ AnaBaslikNo             │
│ Birim               ││ GecerlilikBaslangic     │
│ SutKodu             ││ GecerlilikBitis         │
│ Not                 ││ AktifMi                 │
│ GecerlilikBaslangic ││ ListeVersiyonID (FK)    │
│ GecerlilikBitis     ││ DegisiklikSebebi        │
│ AktifMi             │└────────────────────────┘
│ ListeVersiyonID (FK)│
│ DegisiklikSebebi    │
└─────────────────────┘

┌─────────────────┐    ┌─────────────────────┐
│   AnaDallar     │    │  SutAnaBasliklar     │
│─────────────────│    │─────────────────────│
│ AnaDalKodu (PK) │    │ AnaBaslikNo (PK)    │
│ AnaDalAdi       │    │ AnaBaslikAdi        │
│ AktifMi         │    │ HiyerarsiID (FK)    │
└─────────────────┘    │ AktifMi             │
                       └─────────────────────┘

┌──────────────────┐    ┌──────────────────────────┐
│  SutHiyerarsi    │    │  IlKatsayilari           │
│──────────────────│    │──────────────────────────│
│ HiyerarsiID (PK) │    │ IlKatsayiID (PK)         │
│ ParentID (FK)    │    │ IlAdi                    │
│ SeviyeNo         │    │ PlakaKodu                │
│ Baslik           │    │ Katsayi                  │
│ Sira             │    │ DonemBaslangic           │
│ AktifMi          │    │ DonemBitis               │
└──────────────────┘    │ AktifMi                  │
                        │ ListeVersiyonID (FK)     │
                        └──────────────────────────┘

┌──────────────────────────┐    ┌────────────────────────┐
│  IlKatsayiVersionlar     │    │  HuvAltTeminatlar      │
│──────────────────────────│    │────────────────────────│
│ VersionID (PK)           │    │ AltTeminatID (PK)      │
│ IlKatsayiID (FK)         │    │ AnaDalKodu (FK)        │
│ Katsayi                  │    │ AnaDalAdi              │
│ DonemBaslangic           │    │ AktifMi                │
│ DonemBitis               │    └────────────────────────┘
│ GecerlilikBaslangic      │
│ GecerlilikBitis          │    ┌────────────────────────┐
│ AktifMi                  │    │  AltTeminatIslemler    │
│ ListeVersiyonID (FK)     │    │────────────────────────│
│ DegisiklikSebebi         │    │ ID (PK)               │
└──────────────────────────┘    │ AltTeminatID (FK)     │
                                │ SutID (FK)            │
                                │ SutKodu               │
                                │ OlusturmaTarihi       │
                                └────────────────────────┘
```

### 3.2. Tablolar Detaylı Açıklama

#### `ListeVersiyon`
Her import işlemi bir versiyon kaydı oluşturur. HUV, SUT ve İl Katsayı versiyonları aynı tabloda `ListeTipi` alanıyla ayrılır.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| VersionID | INT (PK) | Otomatik artan birincil anahtar |
| ListeTipi | NVARCHAR(50) | `'HUV'`, `'SUT'` veya `'IL_KATSAYI'` |
| YuklemeTarihi | DATETIME | Listenin geçerlilik tarihi |
| DosyaAdi | NVARCHAR | Yüklenen Excel dosyasının adı |
| KayitSayisi | INT | Yüklenen toplam kayıt sayısı |
| Aciklama | NVARCHAR | Otomatik oluşturulan açıklama |
| YukleyenKullanici | NVARCHAR | İşlemi yapan kullanıcı |
| OlusturmaTarihi | DATETIME | Kaydın oluşturulma zamanı (GETDATE()) |
| EklenenSayisi | INT | Bu versiyonda eklenen kayıt sayısı |
| GuncellenenSayisi | INT | Bu versiyonda güncellenen kayıt sayısı |
| SilinenSayisi | INT | Bu versiyonda silinen kayıt sayısı |

#### `HuvIslemler`
HUV işlemlerinin ana tablosu. Her satır bir sağlık işlemini temsil eder. `AktifMi = 1` olan kayıtlar güncel listeyi oluşturur.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| IslemID | INT (PK) | Otomatik artan birincil anahtar |
| HuvKodu | FLOAT | HUV kodu (ör: 20.00057) — benzersiz tanımlayıcı |
| IslemAdi | NVARCHAR | İşlemin adı |
| Birim | FLOAT | TL cinsinden birim fiyat |
| SutKodu | NVARCHAR | İlişkili SUT kodu |
| AnaDalKodu | INT (FK) | İlişkili ana dal kodu |
| UstBaslik | NVARCHAR | Hiyerarşik üst başlık |
| HiyerarsiSeviyesi | INT | 0-4 arası seviye |
| Not | NVARCHAR | İşleme ait not/açıklama |
| AktifMi | BIT | 1 = aktif, 0 = silinmiş/pasif |
| ListeVersiyonID | INT (FK) | Son güncelleyen versiyon |
| ListeTipi | NVARCHAR | `'HUV'` sabit |
| GuncellemeTarihiDate | DATETIME | Son güncelleme zamanı |

#### `IslemVersionlar`
HUV işlemlerinin SCD Type 2 tarihsel versiyon tablosu. Her değişiklik yeni bir satır olarak kaydedilir.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| VersionID | INT (PK) | Otomatik artan |
| IslemID | INT (FK) | `HuvIslemler.IslemID` referansı |
| HuvKodu | FLOAT | İşlemin HUV kodu |
| IslemAdi | NVARCHAR | O versiyondaki işlem adı |
| Birim | FLOAT | O versiyondaki birim fiyat |
| SutKodu | NVARCHAR | O versiyondaki SUT kodu |
| Not | NVARCHAR | O versiyondaki not |
| GecerlilikBaslangic | DATE | Bu versiyonun geçerlilik başlangıcı |
| GecerlilikBitis | DATE | Bu versiyonun geçerlilik bitişi (NULL = hâlâ aktif) |
| AktifMi | BIT | 1 = güncel versiyon |
| ListeVersiyonID | INT (FK) | Hangi import ile oluşturulduğu |
| DegisiklikSebebi | NVARCHAR | Değişiklik açıklaması |

#### `SutIslemler`
SUT işlemlerinin ana tablosu. Yapı olarak HUV'a benzer ancak alanlar farklıdır.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| SutID | INT (PK) | Otomatik artan birincil anahtar |
| SutKodu | NVARCHAR | SUT kodu (ör: P521690) — benzersiz tanımlayıcı |
| IslemAdi | NVARCHAR | İşlemin adı |
| Puan | FLOAT | Puan değeri (fiyatlandırma birimi) |
| Aciklama | NVARCHAR | İşleme ait açıklama |
| AnaBaslikNo | INT (FK) | İlişkili ana başlık numarası (1-10) |
| HiyerarsiID | INT (FK) | `SutHiyerarsi` tablosu referansı |
| AktifMi | BIT | 1 = aktif |
| ListeVersiyonID | INT (FK) | Son güncelleyen versiyon |

#### `SutIslemVersionlar`
SUT işlemlerinin SCD Type 2 tarihsel versiyon tablosu.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| VersionID | INT (PK) | Otomatik artan |
| SutID | INT (FK) | `SutIslemler.SutID` referansı |
| SutKodu | NVARCHAR | O versiyondaki SUT kodu |
| IslemAdi | NVARCHAR | O versiyondaki işlem adı |
| Puan | FLOAT | O versiyondaki puan |
| Aciklama | NVARCHAR | O versiyondaki açıklama |
| AnaBaslikNo | INT | O versiyondaki ana başlık |
| GecerlilikBaslangic | DATE | Geçerlilik başlangıcı |
| GecerlilikBitis | DATE | Geçerlilik bitişi (NULL = aktif) |
| AktifMi | BIT | 1 = güncel versiyon |
| ListeVersiyonID | INT (FK) | Import referansı |
| DegisiklikSebebi | NVARCHAR | Değişiklik açıklaması |

#### `AnaDallar`
HUV hiyerarşisinde ana dalları tanımlar (ör: İÇ HASTALIKLARI, GENEL CERRAHİ).

#### `SutAnaBasliklar`
SUT hiyerarşisinde 10 ana başlığı tanımlar. Her ana başlık bir `HiyerarsiID` ile `SutHiyerarsi` tablosuna bağlanır.

#### `SutHiyerarsi`
SUT için çok seviyeli hiyerarşi ağacı. `ParentID` ile kendi kendine referans (self-referencing) yapı.

#### `IlKatsayilari` ve `IlKatsayiVersionlar`
İl bazlı katsayıları ve tarihsel versiyonlarını tutar. Yapı olarak diğer versiyon tablolarına benzer.

#### `HuvAltTeminatlar` ve `AltTeminatIslemler`
Alt teminat tanımlarını ve teminatlara atanmış SUT işlemlerini tutar. `HuvAltTeminatlar` sadece Seviye 1 (ana dal düzeyinde) kategorileri barındırır — yalnızca altında birim fiyatı olan gerçek işlem barındıran ana dallar dahildir.

#### `Kullanicilar`
Sistem kullanıcılarını tutar. `Rol` alanı `'ADMIN'` veya `'USER'` olabilir.

---

## 4. Backend API Katmanı

### 4.1. Proje Yapısı

```
huv-api/
├── src/
│   ├── app.js                    # Express app setup ve route kaydı
│   ├── server.js                 # HTTP server başlatma
│   ├── config/
│   │   └── database.js           # SQL Server bağlantı havuzu
│   ├── middleware/
│   │   ├── auth.js               # JWT doğrulama ve yetkilendirme
│   │   ├── errorHandler.js       # Global hata yakalama
│   │   ├── importLock.js         # Concurrent import engelleme
│   │   └── uploadMiddleware.js   # Multer ile dosya yükleme
│   ├── routes/
│   │   ├── auth.js               # /api/auth/*
│   │   ├── islemler.js           # /api/islemler/*
│   │   ├── anadal.js             # /api/anadal/*
│   │   ├── sut.js                # /api/sut/*
│   │   ├── tarihsel.js           # /api/tarihsel/*
│   │   ├── sutTarihsel.js        # /api/tarihsel/sut/*
│   │   ├── versiyonlar.js        # /api/admin/versiyonlar/*
│   │   ├── import.js             # /api/admin/import/*
│   │   ├── matching.js           # /api/matching/*
│   │   ├── altTeminatlar.js      # /api/alt-teminatlar/*
│   │   └── external.js           # /api/external/*
│   ├── controllers/
│   │   ├── authController.js     # Login/Logout/Me
│   │   ├── islemController.js    # HUV işlem sorguları
│   │   ├── anadalController.js   # Ana dal listesi
│   │   ├── sutController.js      # SUT işlem sorguları
│   │   ├── tarihselController.js # HUV tarihsel sorgular
│   │   ├── sutTarihselController.js # SUT tarihsel sorgular
│   │   ├── importController.js   # HUV import (preview + import)
│   │   ├── sutImportController.js # SUT import (preview + import)
│   │   ├── ilKatsayiImportController.js # İl katsayı import
│   │   ├── matchingController.js # Eşleştirme API
│   │   ├── altTeminatController.js # Alt teminat yönetimi
│   │   └── externalController.js # Dış servis listeler
│   ├── services/
│   │   ├── excelParser.js        # HUV Excel parse ve validasyon
│   │   ├── sutExcelParser.js     # SUT Excel parse ve validasyon
│   │   ├── ilKatsayiExcelParser.js # İl katsayı Excel parse
│   │   ├── comparisonService.js  # HUV liste karşılaştırma
│   │   ├── sutComparisonService.js # SUT liste karşılaştırma
│   │   ├── ilKatsayiComparisonService.js # İl katsayı karşılaştırma
│   │   ├── versionManager.js     # HUV versiyon yönetimi (SCD Type 2)
│   │   ├── sutVersionManager.js  # SUT versiyon yönetimi (SCD Type 2)
│   │   ├── ilKatsayiVersionManager.js # İl katsayı versiyon yönetimi
│   │   └── matching/
│   │       ├── MatchingEngine.js # Eşleştirme ana motoru
│   │       ├── MatchingStrategy.js # Base strateji sınıfı
│   │       ├── DirectSutCodeStrategy.js # SUT kodu ile direkt eşleştirme
│   │       ├── HierarchyMatchingStrategy.js # Hiyerarşi bazlı eşleştirme
│   │       └── StatisticsService.js # Eşleştirme istatistikleri
│   └── utils/
│       ├── response.js           # Standart API response formatı
│       ├── dateUtils.js          # Tarih işlemleri
│       ├── turkishCharFix.js     # Türkçe encoding düzeltme
│       ├── fileCleanup.js        # Upload klasörü temizleme
│       ├── BatchProcessor.js     # Batch işleme utility
│       └── matching/
│           ├── StringNormalizer.js # String normalizasyon
│           └── SimilarityCalculator.js # Benzerlik hesaplama
└── .env                          # Ortam değişkenleri
```

### 4.2. API Endpoint Referansı

#### Kimlik Doğrulama (`/api/auth`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| POST | `/api/auth/login` | Public | Kullanıcı girişi |
| POST | `/api/auth/logout` | Auth | Kullanıcı çıkışı |
| GET | `/api/auth/me` | Auth | Mevcut kullanıcı bilgisi |

#### HUV İşlemler (`/api/islemler`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/islemler` | Auth | Tüm işlemler (sayfalı) |
| GET | `/api/islemler/ara` | Auth | İşlem arama |
| GET | `/api/islemler/gelismis-arama` | Auth | Gelişmiş arama (çoklu filtre) |
| GET | `/api/islemler/fiyat-aralik` | Auth | Fiyat aralığına göre filtreleme |
| GET | `/api/islemler/hiyerarsi` | Auth | Hiyerarşi seviyesine göre |
| GET | `/api/islemler/son-guncellemeler` | Auth | Son güncellemeler |
| GET | `/api/islemler/sut-kodu` | Auth | SUT koduna göre |
| GET | `/api/islemler/en-pahali` | Auth | En pahalı N işlem |
| GET | `/api/islemler/en-ucuz` | Auth | En ucuz N işlem |
| GET | `/api/islemler/kategori` | Auth | Kategoriye göre |

#### Ana Dallar (`/api/anadal`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/anadal` | Auth | Tüm ana dalları listele |

#### SUT İşlemler (`/api/sut`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/sut` | Auth | Tüm SUT kodları (sayfalı) |
| GET | `/api/sut/ana-basliklar` | Auth | 10 ana başlık listesi |
| GET | `/api/sut/ana-baslik/:no` | Auth | Ana başlık detayı |
| GET | `/api/sut/hiyerarsi` | Auth | Hiyerarşi ağacı |
| GET | `/api/sut/kategoriler` | Auth | Kategoriler |
| GET | `/api/sut/kategori/:id` | Auth | Kategoriye göre SUT kodları |
| GET | `/api/sut/ara` | Auth | SUT kodu arama |
| GET | `/api/sut/stats` | Auth | SUT istatistikleri |
| GET | `/api/sut/unmatched` | Auth | Eşleşmemiş kayıtlar |
| GET | `/api/sut/:kod` | Auth | Belirli SUT kodu detayı |

#### HUV Tarihsel (`/api/tarihsel`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/tarihsel/fiyat` | Auth | Belirli tarihteki birim fiyat |
| GET | `/api/tarihsel/degisen` | Auth | Tarih aralığında değişenler |
| GET | `/api/tarihsel/gecmis/:id` | Auth | İşlemin tüm fiyat geçmişi |
| GET | `/api/tarihsel/versiyonlar/:id` | Auth | İşlemin tüm versiyonları |
| GET | `/api/tarihsel/yasam-dongusu/:id` | Auth | İşlemin yaşam döngüsü |

#### SUT Tarihsel (`/api/tarihsel/sut`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/tarihsel/sut/puan` | Auth | Belirli tarihteki SUT puanı |
| GET | `/api/tarihsel/sut/degisen` | Auth | Tarih aralığında değişenler |
| GET | `/api/tarihsel/sut/gecmis/:id` | Auth | SUT kodunun puan geçmişi |
| GET | `/api/tarihsel/sut/versiyonlar/:id` | Auth | SUT işlem versiyonları |
| GET | `/api/tarihsel/sut/karsilastir` | Auth | İki versiyon arası fark |
| GET | `/api/tarihsel/sut/stats` | Auth | Tarihsel istatistikler |
| GET | `/api/tarihsel/sut/yasam-dongusu/:id` | Auth | Yaşam döngüsü |

#### Admin - Versiyon Yönetimi (`/api/admin/versiyonlar`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/admin/versiyonlar` | Admin | Tüm versiyonları listele |
| GET | `/api/admin/versiyonlar/:id` | Admin | Versiyon detayı (eklenen/güncellenen/silinen) |

#### Admin - Import (`/api/admin/import`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/admin/import/status` | Admin | Import lock durumu |
| POST | `/api/admin/import/preview` | Admin | HUV Excel önizleme (dry-run) |
| POST | `/api/admin/import/huv` | Admin | HUV listesi yükle |
| POST | `/api/admin/import/sut/preview` | Admin | SUT Excel önizleme (dry-run) |
| POST | `/api/admin/import/sut` | Admin | SUT listesi yükle |
| POST | `/api/admin/import/il-katsayi/preview` | Admin | İl katsayı önizleme |
| POST | `/api/admin/import/il-katsayi` | Admin | İl katsayı yükle |
| GET | `/api/admin/import/history` | Admin | Import geçmişi |
| GET | `/api/admin/import/report/:id` | Admin | Import detaylı rapor |

#### Eşleştirme (`/api/matching`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| POST | `/api/matching/run-batch` | Auth | Toplu eşleştirme çalıştır |
| GET | `/api/matching/results` | Auth | Eşleştirme sonuçları |
| POST | `/api/matching/approve/:sutId` | Auth | Eşleşmeyi onayla |
| PUT | `/api/matching/change/:sutId` | Auth | Eşleşmeyi değiştir |
| GET | `/api/matching/huv-options/:sutId` | Auth | HUV teminat seçenekleri |
| GET | `/api/matching/stats` | Auth | Eşleştirme istatistikleri |

#### Alt Teminatlar (`/api/alt-teminatlar`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/alt-teminatlar` | Auth | Tüm alt teminatlar |
| GET | `/api/alt-teminatlar/sut-islemler` | Auth | SUT işlemleri ara |
| GET | `/api/alt-teminatlar/:id/islemler` | Auth | Alt teminata atanmış işlemler |
| POST | `/api/alt-teminatlar/:id/islemler` | Auth | Alt teminata işlem ata |
| DELETE | `/api/alt-teminatlar/:id/islemler/:sutId` | Auth | İşlem kaldır |

#### Dış Servis API (`/api/external`)
| Method | Endpoint | Yetki | Açıklama |
|--------|----------|-------|----------|
| GET | `/api/external/huv` | Auth | Güncel HUV listesi |
| GET | `/api/external/sut` | Auth | Güncel SUT listesi |
| GET | `/api/external/il-katsayi` | Auth | Güncel il katsayıları |

### 4.3. Middleware Zinciri

```
İstek → helmet → cors → json → morgan → auth.authenticate → [authorizeAdmin] → Controller → errorHandler
```

| Middleware | Dosya | Açıklama |
|-----------|-------|----------|
| `helmet` | npm paketi | HTTP güvenlik başlıkları (XSS, clickjacking vs.) |
| `cors` | npm paketi | `localhost:5173` ve `127.0.0.1:5173` için CORS izni |
| `authenticate` | `auth.js` | JWT token doğrulama, kullanıcıyı DB'den çek, `req.user` set et |
| `authorizeAdmin` | `auth.js` | `req.user.rol === 'ADMIN'` kontrolü |
| `importLock` | `importLock.js` | Aynı anda sadece 1 import — in-memory mutex |
| `uploadSingle` | `uploadMiddleware.js` | Multer ile tek dosya yükleme (Excel) |
| `errorHandler` | `errorHandler.js` | Global hata yakalama ve standart JSON response |

---

## 5. Frontend Katmanı

### 5.1. Proje Yapısı

```
huv-frontend/
├── src/
│   ├── main.jsx                  # React DOM render
│   ├── App.jsx                   # Route tanımları
│   ├── api/
│   │   └── axios.js              # Axios instance (baseURL, interceptor)
│   ├── app/
│   │   ├── config/
│   │   │   └── constants.js      # Uygulama sabitleri
│   │   └── theme/
│   │       ├── index.js          # MUI createTheme
│   │       ├── palette.js        # Renk paleti
│   │       ├── typography.js     # Tipografi ayarları
│   │       └── components.js     # Global component overrides
│   ├── components/
│   │   ├── layout/
│   │   │   └── Layout.jsx        # Sidebar + AppBar + Content alanı
│   │   ├── admin/
│   │   │   ├── ImportPreviewDialog.jsx  # Import önizleme dialog'u
│   │   │   ├── ImportReportDialog.jsx   # Import rapor dialog'u
│   │   │   ├── ExcelImportTab.jsx       # HUV Excel yükleme tab'ı
│   │   │   ├── SutExcelImportTab.jsx    # SUT Excel yükleme tab'ı
│   │   │   └── IlKatsayiExcelImportTab.jsx # İl katsayı yükleme tab'ı
│   │   ├── common/
│   │   │   ├── DataTable.jsx            # Ortak veri tablosu
│   │   │   ├── PageHeader.jsx           # Sayfa başlığı
│   │   │   ├── LoadingSpinner.jsx       # Yükleniyor animasyonu
│   │   │   ├── ErrorBoundary.jsx        # React error boundary
│   │   │   ├── ErrorAlert.jsx           # Hata uyarısı
│   │   │   ├── ConfirmDialog.jsx        # Onay dialog'u
│   │   │   ├── EmptyState.jsx           # Boş durum gösterimi
│   │   │   ├── DateDisplay.jsx          # Tarih gösterimi
│   │   │   ├── TabPanel.jsx             # Tab panel wrapper
│   │   │   └── ProtectedRoute.jsx       # Auth korumalı route
│   │   └── matching/
│   │       ├── BatchMatchingPanel.jsx   # Toplu eşleştirme paneli
│   │       └── HuvTeminatSelectionDialog.jsx # HUV teminat seçim dialog'u
│   ├── pages/
│   │   ├── Login.jsx             # Giriş sayfası
│   │   ├── HiyerarsiAgaci.jsx   # HUV hiyerarşi ağacı
│   │   ├── SutListe.jsx          # SUT hiyerarşi ağacı
│   │   ├── HuvTarihsel.jsx       # HUV tarihsel sorgular
│   │   ├── SutTarihsel.jsx       # SUT tarihsel sorgular
│   │   ├── HuvYonetimi.jsx       # HUV versiyon yönetimi (Admin)
│   │   ├── SutYonetimi.jsx       # SUT versiyon yönetimi (Admin)
│   │   ├── IlKatsayiYonetimi.jsx # İl katsayı yönetimi (Admin)
│   │   ├── AltTeminatlar.jsx     # Alt teminatlar listesi
│   │   ├── MatchingReview.jsx    # Eşleştirme gözden geçirme (Admin)
│   │   └── UnmatchedRecords.jsx  # Eşleşmemiş kayıtlar
│   ├── services/
│   │   ├── adminService.js       # Admin API çağrıları
│   │   ├── islemService.js       # HUV işlem API çağrıları
│   │   ├── anadalService.js      # Ana dal API çağrıları
│   │   ├── sutService.js         # SUT API çağrıları
│   │   ├── tarihselService.js    # Tarihsel sorgu API çağrıları
│   │   ├── matchingService.js    # Eşleştirme API çağrıları
│   │   ├── altTeminatService.js  # Alt teminat API çağrıları
│   │   ├── ilKatsayiService.js   # İl katsayı API çağrıları
│   │   └── externalService.js    # Dış servis API çağrıları
│   └── utils/
│       ├── dateUtils.js          # Tarih formatları ve validasyon
│       ├── stringUtils.js        # String yardımcıları
│       ├── export.js             # Dışa aktarma
│       └── toastManager.js       # Toast bildirimleri
└── vite.config.js
```

### 5.2. Routing Yapısı

| Yol | Sayfa Bileşeni | Yetki | Açıklama |
|-----|----------------|-------|----------|
| `/login` | `Login.jsx` | Public | Giriş sayfası |
| `/huv-liste` | `HiyerarsiAgaci.jsx` | Auth | HUV hiyerarşi ağacı |
| `/sut-liste` | `SutListe.jsx` | Auth | SUT hiyerarşi ağacı |
| `/huv-tarihsel` | `HuvTarihsel.jsx` | Auth | HUV tarihsel sorgular |
| `/sut-tarihsel` | `SutTarihsel.jsx` | Auth | SUT tarihsel sorgular |
| `/huv-yonetimi` | `HuvYonetimi.jsx` | Admin | HUV liste yükleme ve yönetim |
| `/sut-yonetimi` | `SutYonetimi.jsx` | Admin | SUT liste yükleme ve yönetim |
| `/il-katsayi-yonetimi` | `IlKatsayiYonetimi.jsx` | Admin | İl katsayı yönetimi |
| `/alt-teminatlar` | `AltTeminatlar.jsx` | Auth | Alt teminatlar |
| `/matching-review` | `MatchingReview.jsx` | Admin | Eşleştirme gözden geçirme |
| `/matching/unmatched` | `UnmatchedRecords.jsx` | Auth | Eşleşmemiş kayıtlar |

### 5.3. Tema ve Stil

Tema `src/app/theme/` altında merkezi olarak yönetilir:

- **`palette.js`**: Renk paleti tanımları (primary, secondary, background vb.)
- **`typography.js`**: Font ailesi, boyutları ve ağırlıkları
- **`components.js`**: MUI bileşenlerinin global override'ları (Button, Card, Paper, Chip, TextField, Table, Alert, Tab, Accordion vb.)
- **`index.js`**: `createTheme()` ile hepsini birleştirir

Tasarım yaklaşımı: Profesyonel, temiz, minimal — aşırı renkli olmayan outlined stil.

---

## 6. Excel Import Akışı (Baştan Sona)

Bu bölüm, bir Excel dosyasının sisteme yüklenmesinden verinin veritabanına kaydedilmesine kadar olan **tüm** adımları detaylı olarak açıklar.

### 6.1. Genel Akış Diyagramı

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  IMPORT AKIŞI                                       │
│                                                                                     │
│  1. Kullanıcı Excel seçer                                                           │
│     └─→ Frontend: ExcelImportTab / SutExcelImportTab                                │
│                                                                                     │
│  2. "Önizle" butonu                                                                 │
│     └─→ POST /api/admin/import/preview (veya /sut/preview)                          │
│         └─→ multer → importLock yok (preview için) → Controller                     │
│                                                                                     │
│  3. Backend Önizleme:                                                               │
│     a. Excel Parse  (excelParser.js / sutExcelParser.js)                             │
│     b. Validasyon   (validateHuvData / validateSutData)                              │
│     c. Normalizasyon (normalizeHuvData / normalizeSutData)                           │
│     d. DB'den mevcut veri çek (getMevcutHuvData / getMevcutSutData)                  │
│     e. Karşılaştırma (compareHuvLists / compareSutLists)                             │
│     f. Rapor oluştur (generateComparisonReport)                                     │
│     g. Response: { summary, onizleme, degisiklikDagilimi }                           │
│                                                                                     │
│  4. Frontend Önizleme Dialog'u (ImportPreviewDialog)                                │
│     └─→ Özet: Eklenecek / Güncellenecek / Silinecek / Değişmeyen                   │
│     └─→ Tablolar: Her kategori ayrı tab'da listelenir                               │
│     └─→ Güncellenen satırlarda alan bazlı eski/yeni değer gösterimi                 │
│                                                                                     │
│  5. Kullanıcı "Onayla ve İçe Aktar" butonu                                          │
│     └─→ POST /api/admin/import/huv (veya /sut)                                      │
│         └─→ multer → importLock → Controller                                        │
│                                                                                     │
│  6. Backend Import:                                                                 │
│     a. Parse + Validate + Normalize (tekrar)                                        │
│     b. Karşılaştırma (tekrar)                                                       │
│     c. Transaction başlat                                                           │
│     d. ListeVersiyon oluştur                                                        │
│     e. Eklenen   → INSERT HuvIslemler + INSERT IslemVersionlar                       │
│     f. Güncellenen → UPDATE (SCD Type 2) + UPDATE HuvIslemler                        │
│     g. Silinecek → HuvIslemler.AktifMi = 0 + IslemVersionlar.GecerlilikBitis        │
│     h. Değişmeyen → copyUnchangedIslemToVersion (versiyon tablosuna kopyala)         │
│     i. ListeVersiyon sayıları güncelle                                              │
│     j. Transaction commit                                                           │
│                                                                                     │
│  7. Response: { success, versionId, summary }                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2. Adım 1 — Excel Dosya Seçimi (Frontend)

Kullanıcı admin sayfasındaki (HuvYonetimi veya SutYonetimi) "Dosya Seç" butonuna tıklar. `ExcelImportTab` veya `SutExcelImportTab` bileşeni dosyayı `FormData` olarak hazırlar.

**Kabul edilen dosya formatları:**
- `.xls` (eski Excel)
- `.xlsx` (modern Excel)
- `.xlsm` (makrolu Excel)
- Maksimum boyut: 10 MB

### 6.3. Adım 2 — Excel Parse (Backend)

**HUV için** (`excelParser.js → parseHuvExcel`):
1. `XLSX.readFile()` ile Excel okunur (UTF-8 codepage)
2. İlk sheet JSON'a çevrilir
3. Türkçe karakter düzeltmesi (`fixTurkishEncoding`) uygulanır
4. Kolon adları normalize edilir (büyük/küçük harf, Türkçe karakter)
5. Dosya adından tarih çıkarılır (ör: `05.02.2026.xlsx` → `2026-02-05`)

**SUT için** (`sutExcelParser.js → parseSutExcel`):
1. Excel okunur
2. **Başlık satırı otomatik bulunur** — ilk 20 satırda SUT anahtar kelimelerini arar
3. Hiyerarşi satırları (kategoriler, ana başlıklar) ayrı tespit edilir (`parseHierarchy`)
4. İşlem satırları ve hiyerarşi satırları ayrılır

### 6.4. Adım 3 — Validasyon

**HUV** (`validateHuvData`):
- HUV kodu formatı kontrolü (XX.XXXXX)
- İşlem adı zorunluluğu
- Birim değeri kontrolü (sayısal, >= 0)
- Tekrarlayan HUV kodu kontrolü

**SUT** (`validateSutData`):
- SUT kodu zorunluluğu
- İşlem adı zorunluluğu
- Puan değeri kontrolü
- Tekrarlayan SUT kodu kontrolü

### 6.5. Adım 4 — Normalizasyon

**HUV** (`normalizeHuvData`):
- `HuvKodu` float'a çevrilir
- `Birim` float'a çevrilir
- `AnaDalKodu` DB'deki `AnaDallar` tablosuyla eşleştirilir
- Hiyerarşi seviyesi hesaplanır

**SUT** (`normalizeSutData`):
- `SutKodu` string olarak normalize
- `Puan` float'a çevrilir
- `AnaBaslikNo` atanır
- `HiyerarsiID` (varsa) eşleştirilir

### 6.6. Adım 5 — Karşılaştırma

Detaylı açıklama [Bölüm 7](#7-karşılaştırma-ve-değişiklik-algılama)'de.

### 6.7. Adım 6 — Önizleme Dialog'u (Frontend)

`ImportPreviewDialog.jsx` bileşeni hem HUV hem SUT için tek bir ortak dialog kullanır. `listeTipi` prop'u ile ayrılır.

**Özet Kartları:**
- Toplam geçerli işlem sayısı
- Eklenecek sayısı (yeşil)
- Güncellenecek sayısı (turuncu)
- Silinecek sayısı (kırmızı)
- Değişmeyen sayısı (gri)

**Tab'lar:**
1. **Eklenecekler**: Yeni işlemlerin listesi
2. **Güncellenecekler**: Expandable satırlar — tıklandığında eski/yeni değerler detaylı gösterilir, değişen alanlar renkli chip'lerle belirtilir
3. **Silinecekler**: Silinecek işlemlerin listesi
4. **Değişmeyenler**: Sabit kalan işlemler

**Değişiklik Dağılımı:** Tüm güncellenen kayıtlar üzerinden hangi alanların ne kadar değiştiğini gösteren istatistik (ör: "Birim: 2, İşlem Adı: 1").

### 6.8. Adım 7 — Import (Kaydetme)

Kullanıcı "Onayla ve İçe Aktar" butonuna bastığında:

1. **Import Lock**: `importLock` middleware'i aynı anda birden fazla import'u engeller
2. **Parse + Validate + Compare** tekrar yapılır (güvenlik)
3. **SQL Transaction** başlatılır
4. **ListeVersiyon** kaydı oluşturulur
5. Karşılaştırma sonucuna göre:

| Durum | Ana Tablo İşlemi | Versiyon Tablosu İşlemi |
|-------|-------------------|-------------------------|
| **Eklenen** | INSERT (AktifMi=1) | INSERT (GecerlilikBitis=NULL) |
| **Güncellenen** | UPDATE (yeni değerler) | Eski: GecerlilikBitis set, AktifMi=0 / Yeni: INSERT |
| **Silinen** | AktifMi = 0 | GecerlilikBitis set, AktifMi=0 |
| **Değişmeyen** | Dokunulmaz | Yeni versiyona kopyalanır |

6. **ListeVersiyon** sayıları güncellenir
7. **Transaction commit**
8. Başarılı response döner

---

## 7. Karşılaştırma ve Değişiklik Algılama

### 7.1. Genel Algoritma

```
1. Mevcut aktif veriler DB'den çekilir (AktifMi = 1)
2. Eski ve yeni veriler Map'e alınır:
   - HUV: key = HuvKodu (float)
   - SUT: key = SutKodu (string)
3. Yeni listede her kayıt için:
   - Eski Map'te yoksa → ADDED (Eklenen)
   - Eski Map'te varsa → detectChanges() ile alan bazlı kontrol
     - Fark varsa → UPDATED (Güncellenen) + changes[] detay listesi
     - Fark yoksa → UNCHANGED (Değişmeyen)
4. Eski listede olup yeni listede olmayanlar → DELETED (Silinen)
```

### 7.2. HUV `detectChanges()` — Alan Bazlı Karşılaştırma

`comparisonService.js` içindeki fonksiyon:

| Alan | Yöntem | Detay |
|------|--------|-------|
| **Birim** | `Math.abs(old - new) > 0.01` | Float toleransı ile karşılaştırma. Fark ve yüzde hesaplanır. |
| **IslemAdi** | `normalizeText()` sonrası | Newline, tab, çoklu boşluk, zero-width karakter normalizasyonu |
| **SutKodu** | `normalizeNullable()` | null/undefined → '' dönüşümü + normalizeText |
| **Not** | `normalizeText()` sonrası | Aynı metin normalizasyonu |

### 7.3. SUT `detectChanges()` — Alan Bazlı Karşılaştırma

`sutComparisonService.js` içindeki fonksiyon:

| Alan | Yöntem | Detay |
|------|--------|-------|
| **Puan** | `Math.abs(old - new) > 0.01` | Float toleransı |
| **IslemAdi** | `normalizeText()` sonrası | Metin normalizasyonu |
| **Aciklama** | `normalizeText()` sonrası | Metin normalizasyonu |
| **AnaBaslikNo** | `Number()` dönüşümü | Tip güvenli sayısal karşılaştırma |

### 7.4. Metin Normalizasyonu (`normalizeText`)

Hem HUV hem SUT'ta kullanılan güçlü metin normalizasyonu:

```javascript
const normalizeText = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/\r\n/g, '\n')              // Windows newline → Unix
    .replace(/\r/g, '\n')                // Eski Mac newline → Unix
    .replace(/[\u00A0\u2007\u202F]/g, ' ') // Non-breaking space → normal space
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Zero-width karakter kaldır
    .replace(/\t/g, ' ')                 // Tab → space
    .replace(/ {2,}/g, ' ')              // Çoklu space → tek space
    .trim();                             // Baş/son boşluk kaldır
};
```

Bu normalizasyon, Excel'den gelen metinlerle veritabanındaki metinler arasında yalnızca **gerçek içerik** farklarının tespit edilmesini sağlar. Sahte (false positive) değişiklik algılamasını önler.

### 7.5. SQL Tarafında Karşılaştırma (Versiyon Detay API'si)

`versiyonlar.js` route'undaki SQL sorguları da tutarlı karşılaştırma yapar:

```sql
-- HUV güncellenen kayıtları bulmak için:
WHERE (
  LTRIM(RTRIM(ISNULL(v_curr.IslemAdi, ''))) != LTRIM(RTRIM(ISNULL(v_prev.IslemAdi, '')))
  OR LTRIM(RTRIM(ISNULL(v_curr.SutKodu, ''))) != LTRIM(RTRIM(ISNULL(v_prev.SutKodu, '')))
  OR LTRIM(RTRIM(ISNULL(v_curr.[Not], ''))) != LTRIM(RTRIM(ISNULL(v_prev.[Not], '')))
  OR ABS(ISNULL(v_curr.Birim, 0) - ISNULL(v_prev.Birim, 0)) > 0.01
)
```

---

## 8. SCD Type 2 Versiyonlama

### 8.1. Konsept

**Slowly Changing Dimension Type 2** — verinin her değişimini tarihsel olarak saklama yöntemi. Bir kayıt değiştiğinde eski satır kapatılır, yeni satır açılır.

### 8.2. Yaşam Döngüsü

```
Zaman çizgisi:
────────────────────────────────────────────────────────→
2026-02-05          2026-06-15          2026-09-01

İşlem "X" (HuvKodu: 20.00057):

Versiyon 1: │──── Birim: 50 TL ────│ (GecerlilikBitis = 2026-06-14)
Versiyon 2:                         │──── Birim: 60 TL ────│ (GecerlilikBitis = 2026-08-31)
Versiyon 3:                                                  │──── Birim: 65 TL ────→ (GecerlilikBitis = NULL)
```

### 8.3. Geçerlilik Tarihleri

| Alan | Anlamı |
|------|--------|
| `GecerlilikBaslangic` | Bu versiyonun ne zamandan itibaren geçerli olduğu |
| `GecerlilikBitis` | Bu versiyonun ne zaman sona erdiği |
| `GecerlilikBitis = NULL` | Bu versiyon hâlâ aktif (en güncel) |

### 8.4. Tarihsel Sorgu Mantığı

Belirli bir tarihteki değeri bulmak için:

```sql
SELECT * FROM IslemVersionlar
WHERE IslemID = @IslemID
  AND @Tarih BETWEEN GecerlilikBaslangic 
      AND ISNULL(GecerlilikBitis, '9999-12-31')
```

### 8.5. İlk Yükleme

İlk versiyon yüklendiğinde:
- Tüm kayıtlar **ADDED** olarak işaretlenir (karşılaştırılacak önceki veri yok)
- `GecerlilikBaslangic` = yükleme tarihi
- `GecerlilikBitis` = NULL
- `isFirstVersion` flag'ı frontend'e iletilir

---

## 9. Tarihsel Sorgular

### 9.1. HUV Tarihsel Sorgular (`HuvTarihsel.jsx`)

**3 Ana İşlev:**

1. **Belirli Tarihteki Fiyat:** Bir HUV kodu ve tarih girilerek o tarihteki birim fiyat sorgulanır.
2. **Değişen Kodlar:** İki tarih arasında birimi değişen tüm HUV kodları listelenir. Varsayılan başlangıç: `2026-02-05`, varsayılan bitiş: bugünün tarihi.
3. **Fiyat Geçmişi:** Bir HUV kodunun tüm birim değişim geçmişi kronolojik olarak listelenir.

### 9.2. SUT Tarihsel Sorgular (`SutTarihsel.jsx`)

Yapı olarak HUV tarihsele benzer ancak SUT'a özel alanları kullanır:

1. **Belirli Tarihteki Puan:** SUT kodu + tarih → puan
2. **Değişen Kodlar:** İki tarih arasında puanı değişen SUT kodları
3. **Puan Geçmişi:** SUT kodunun tüm puan değişim geçmişi

### 9.3. Minimum Sorgu Tarihi

Tüm tarihsel sorgularda `2026-02-05` tarihinden öncesi sorgulanamaz. Bu kısıt hem frontend'de (HTML `min` attribute) hem de `dateUtils.js` validasyonunda uygulanır.

```javascript
// Frontend sabiti
export const MIN_QUERY_DATE = '2026-02-05';
export const MIN_QUERY_DATE_DISPLAY = '05.02.2026';
```

---

## 10. HUV ve SUT Farkları

### 10.1. Temel Yapısal Farklar

| Özellik | HUV | SUT |
|---------|-----|-----|
| **Birincil Anahtar** | `HuvKodu` (decimal/float) | `SutKodu` (string) |
| **Değer Alanı** | `Birim` (TL cinsinden fiyat) | `Puan` (puanlama değeri) |
| **Not/Açıklama Alanı** | `Not` | `Aciklama` |
| **Hiyerarşi Referansı** | `AnaDalKodu` → `AnaDallar` tablosu | `AnaBaslikNo` → `SutAnaBasliklar` tablosu |
| **Hiyerarşi Derinliği** | 5 seviye (0-4) | Sınırsız (self-referencing `SutHiyerarsi`) |
| **Ana Tablo** | `HuvIslemler` | `SutIslemler` |
| **Versiyon Tablosu** | `IslemVersionlar` | `SutIslemVersionlar` |
| **Excel Parse** | `excelParser.js` | `sutExcelParser.js` |
| **Karşılaştırma Servisi** | `comparisonService.js` | `sutComparisonService.js` |
| **Version Manager** | `versionManager.js` | `sutVersionManager.js` |

### 10.2. Karşılaştırılan Alanlar

| HUV | SUT |
|-----|-----|
| Birim (float tolerance) | Puan (float tolerance) |
| IslemAdi (normalizeText) | IslemAdi (normalizeText) |
| SutKodu (normalizeNullable) | Aciklama (normalizeText) |
| Not (normalizeText) | AnaBaslikNo (Number) |

### 10.3. Hiyerarşi Farkı

**HUV Hiyerarşisi:**
```
Seviye 0: Ana Dal (ör: İÇ HASTALIKLARI)
  Seviye 1: Kategori (ör: ENDOKRİNOLOJİ VE METABOLİZMA)
    Seviye 2: Alt Kategori (ör: EĞİTİM)
      Seviye 3: Alt Alt Kategori
        Seviye 4: İşlem (ör: Yeni başvurmuş diyabetlinin eğitimi)
```

**SUT Hiyerarşisi:**
```
Seviye 1: Ana Başlık (ör: 5 - Tıbbi İşlemler)
  Seviye 2: Alt Başlık (ör: 5.1 - Göz Hastalıkları)
    Seviye 3: Kategori (ör: 5.1.1 - Göz Muayenesi)
      ... (sınırsız derinlik, ParentID ile)
        İşlem (ör: P521690 - Göz dibi muayenesi)
```

### 10.4. Excel Parse Farkı

- **HUV Excel:** Kolon adları standart, başlık satırı genellikle 1. satır.
- **SUT Excel:** Başlık satırı otomatik bulunur (ilk 20 satır taranır). Hiyerarşi satırları (kategoriler, ana başlıklar) ayrı tespit edilip `SutHiyerarsi` tablosuna kaydedilir.

---

## 11. İl Katsayıları

### 11.1. Genel

İl katsayıları, sağlık hizmet fiyatlarının il bazında çarpan katsayısını belirler. Örnek: İstanbul katsayısı 1.2 ise, bir işlemin fiyatı `Birim × 1.2` olarak hesaplanır.

### 11.2. Veri Modeli

| Tablo | Amaç |
|-------|------|
| `IlKatsayilari` | Güncel katsayılar (ana tablo) |
| `IlKatsayiVersionlar` | Tarihsel katsayı versiyonları (SCD Type 2) |

**Birincil anahtar:** `IlAdi` + `PlakaKodu`

### 11.3. Karşılaştırılan Alanlar

| Alan | Yöntem |
|------|--------|
| Katsayı | Float tolerance (0.001) |
| DonemBaslangic | Tarih karşılaştırma |
| DonemBitis | Tarih karşılaştırma |

### 11.4. Import Akışı

HUV/SUT ile aynı mantık: Excel parse → validate → normalize → compare → preview → import.

---

## 12. Eşleşme (Matching) Sistemi

### 12.1. Amaç

SUT kodları ile HUV kodları arasında otomatik eşleştirme yaparak, bir SUT işleminin hangi HUV alt teminatına karşılık geldiğini belirler.

### 12.2. Strateji Mimarisi

Eşleştirme motoru **Strategy Pattern** kullanır:

```
MatchingEngine
├── DirectSutCodeStrategy   (En yüksek öncelik, %100 güven)
│   └── HUV'daki SutKodu alanı ile direkt eşleştirme
└── HierarchyMatchingStrategy (İkinci öncelik)
    └── Hiyerarşi ağacı üzerinden benzerlik ile eşleştirme
```

### 12.3. Batch İşleme

Toplu eşleştirme `BatchProcessor` utility'si ile batch'ler halinde çalıştırılır. Her batch'te belirli sayıda SUT işlemi eşleştirilir.

### 12.4. Frontend Akışı

1. Admin "Toplu Eşleştir" butonuna basar (`BatchMatchingPanel`)
2. Backend batch olarak eşleştirme çalıştırır
3. Sonuçlar `MatchingReview` sayfasında listelenir
4. Her eşleşme onaylanabilir veya farklı bir HUV teminatıyla değiştirilebilir
5. Eşleşmemiş kayıtlar ayrı sayfada görüntülenebilir (`UnmatchedRecords`)

---

## 13. Alt Teminatlar

### 13.1. Tanım

Alt teminatlar, HUV ana dallarının sigorta teminat sınıflandırması için kullanılır. Her alt teminat bir `AnaDalKodu`'na bağlıdır.

### 13.2. Alt Teminat Mantığı

- `HuvAltTeminatlar` tablosu sadece **Seviye 1** (ana dal düzeyi) kategorileri içerir
- Sadece altında **birim fiyatı olan gerçek işlem** barındıran ana dallar dahil edilir
- "Genel İşlemler ve Muayene" gibi açıklama içerikli kategoriler hariç tutulur

### 13.3. Üst Teminat / Alt Teminat Belirleme

Bir işlemin yolu dikkate alınarak:

```
İÇ HASTALIKLARI → ENDOKRİNOLOJİ VE METABOLİZMA → EĞİTİM → İşlem
```

- **Üst Teminat:** Ana dal = İÇ HASTALIKLARI
- **Alt Teminat:** Ana dalın bir altındaki kırılım = ENDOKRİNOLOJİ VE METABOLİZMA

Eğer ana dal ve işlem arasında kırılım yoksa (direkt ana dal → işlem), hem üst hem alt teminat ana dalın kendisidir.

### 13.4. API Endpoint'leri

`/api/alt-teminatlar/` — CRUD operasyonları. SUT işlemleri aranabilir ve alt teminatlara atanabilir/kaldırılabilir.

---

## 14. Kimlik Doğrulama ve Yetkilendirme

### 14.1. JWT Akışı

```
1. Login:
   POST /api/auth/login { kullaniciAdi, sifre }
   → Kullanıcı DB'de kontrol edilir
   → JWT token oluşturulur (payload: kullaniciId, kullaniciAdi, rol)
   → Token frontend'e döner
   → Frontend token'ı localStorage'a kaydeder

2. Her İstek:
   Header: Authorization: Bearer <token>
   → auth.authenticate middleware token'ı doğrular
   → Kullanıcı DB'den çekilir (AktifMi=1 kontrolü)
   → req.user set edilir

3. Admin İşlemler:
   → auth.authorizeAdmin middleware'i req.user.rol === 'ADMIN' kontrolü yapar
```

### 14.2. Token Ayarları

| Ayar | Varsayılan |
|------|-----------|
| JWT_SECRET | Environment variable'dan |
| JWT_EXPIRES_IN | 24 saat |

### 14.3. Koruma Seviyeleri

| Seviye | Uygulama |
|--------|----------|
| Public | `/api/auth/login` — giriş endpoint'i |
| Auth | Tüm diğer endpoint'ler — JWT zorunlu |
| Admin | `/api/admin/*` — JWT + ADMIN rol zorunlu |

---

## 15. Hiyerarşi Ağacı

### 15.1. HUV Hiyerarşi Ağacı (`HiyerarsiAgaci.jsx`)

- MUI `@mui/x-tree-view` kullanır
- Ana dallar seviye 0, kategoriler seviye 1, alt kategoriler seviye 2-3, işlemler seviye 4
- Filtreleme: Ana dal, arama, seviye
- Seçilen düğümün detay paneli: işlem adı, HUV kodu, birim, SUT kodu, not
- **Teminat bilgisi:** SUT Üst Teminat, SUT Alt Teminat, HUV Üst Teminat, HUV Alt Teminat kutuları

### 15.2. SUT Hiyerarşi Ağacı (`SutListe.jsx`)

- Ana başlıklar (1-10) → alt başlıklar → kategoriler → işlemler
- `SutHiyerarsi` tablosundan ağaç yapısı çekilir
- Seçilen düğümün detay paneli: SUT kodu, işlem adı, puan, açıklama
- **Teminat kutuları:** SUT Üst Teminat, SUT Alt Teminat, HUV Üst Teminat, HUV Alt Teminat

---

## 16. Türkçe Karakter Desteği

### 16.1. Sorun

Excel dosyaları farklı encoding'lerde (Windows-1254, UTF-8, vb.) gelebilir. SQL Server'ın collation'ı ile uyumsuzluk bozuk karakterlere neden olabilir.

### 16.2. Çözüm Katmanları

| Katman | Dosya | Yöntem |
|--------|-------|--------|
| Excel okuma | `excelParser.js` | `codepage: 65001` (UTF-8) |
| String düzeltme | `turkishCharFix.js` | Windows-1254 → UTF-8 karakter haritası |
| HTML entity | `turkishCharFix.js` | `he.decode()` ile HTML entity decode |
| DB collation | `database.js` | Turkish_CI_AS collation kontrolü |
| Sayı parse | `turkishCharFix.js` | Türkçe virgül → nokta dönüşümü |
| Frontend API yanıtı | `axios.js` (interceptor) | `fixTurkishChars` ile string alanları |

### 16.3. Karakter Haritası

```
Ä° → İ    Ä± → ı    Åž → Ş    ÅŸ → ş
Ä  → Ğ    Ä  → ğ    Ã– → Ö    Ã¶ → ö
Ãœ → Ü    Ã¼ → ü    Ã‡ → Ç    Ã§ → ç
```

---

## 17. Yapılandırma ve Sabitler

### 17.1. Frontend Sabitleri (`constants.js`)

| Sabit | Değer | Açıklama |
|-------|-------|----------|
| `API_CONFIG.baseURL` | `http://localhost:3000/api` | Backend URL |
| `API_CONFIG.timeout` | 30000 ms | API istek timeout |
| `MIN_QUERY_DATE` | `2026-02-05` | Minimum sorgu tarihi |
| `PAGINATION.defaultLimit` | 25 | Sayfa başına varsayılan kayıt |
| `EXCEL_CONFIG.maxFileSize` | 10 MB | Maksimum Excel boyutu |
| `HIYERARSI_SEVIYELERI` | 0-4 | HUV hiyerarşi seviyeleri |

### 17.2. Backend Ortam Değişkenleri (`.env`)

| Değişken | Açıklama |
|----------|----------|
| `DB_SERVER` | SQL Server adresi |
| `DB_PORT` | SQL Server portu (varsayılan: 1433) |
| `DB_DATABASE` | Veritabanı adı |
| `DB_USER` | SQL Auth kullanıcı adı |
| `DB_PASSWORD` | SQL Auth şifresi |
| `DB_WINDOWS_AUTH` | Windows Auth kullan (true/false) |
| `DB_ENCRYPT` | Bağlantı şifrele (true/false) |
| `DB_TRUST_SERVER_CERTIFICATE` | Sertifika güven (true/false) |
| `JWT_SECRET` | JWT imza anahtarı |
| `JWT_EXPIRES_IN` | Token ömrü (varsayılan: 24h) |
| `API_PREFIX` | API yol ön eki (varsayılan: /api) |
| `PORT` | Backend port (varsayılan: 3000) |

---

## 18. Dış Servis API'si (External)

### 18.1. Amaç

Diğer sistemlerin güncel HUV, SUT ve İl Katsayı listelerine erişmesi için basit read-only API.

### 18.2. Endpoint'ler

| Endpoint | Dönen Veri |
|----------|-----------|
| `GET /api/external/huv` | Tüm aktif HUV işlemleri |
| `GET /api/external/sut` | Tüm aktif SUT işlemleri |
| `GET /api/external/il-katsayi` | Tüm aktif il katsayıları |

Her endpoint JWT doğrulaması gerektirir.

---

## 19. Hata Yönetimi

### 19.1. Backend Hata Yapısı

```javascript
// Standart hata response formatı:
{
  success: false,
  message: "Hata açıklaması",
  errors: {
    tip: "HATA_TIPI",
    detay: "Teknik detay",
    cozum: "Kullanıcıya önerilen çözüm"
  }
}
```

### 19.2. Frontend Hata Yönetimi

- `ErrorBoundary.jsx` — React error boundary, crash'leri yakalar
- `ErrorAlert.jsx` — Hata mesajı gösterimi
- Axios interceptor — token süresi dolduğunda otomatik login'e yönlendirme
- Toast bildirimleri — başarı/hata durumlarında anlık geri bildirim

### 19.3. Import Lock

`importLock.js` middleware'i in-memory mutex mekanizması kullanır. Bir import devam ederken ikinci import isteği 409 (Conflict) ile reddedilir. Response veya connection kapandığında lock otomatik serbest kalır.

---

## 20. Dosya Yapısı Referansı

### Proje Kök Dizini

```
HUV/
├── huv-api/                      # Backend (Node.js + Express)
│   ├── src/
│   │   ├── app.js                # Express app
│   │   ├── server.js             # HTTP server
│   │   ├── config/database.js    # DB bağlantısı
│   │   ├── middleware/           # Auth, upload, lock, error
│   │   ├── routes/               # API route tanımları
│   │   ├── controllers/          # İş mantığı (request/response)
│   │   ├── services/             # Veri işleme servisleri
│   │   └── utils/                # Yardımcı araçlar
│   ├── uploads/                  # Geçici Excel dosyaları
│   ├── .env                      # Ortam değişkenleri
│   └── package.json
├── huv-frontend/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── main.jsx              # Uygulama giriş noktası
│   │   ├── App.jsx               # Route yapısı
│   │   ├── api/axios.js          # HTTP istemcisi
│   │   ├── app/                  # Tema ve sabitler
│   │   ├── components/           # Ortak ve modül bileşenleri
│   │   ├── pages/                # Sayfa bileşenleri
│   │   ├── services/             # API çağrı servisleri
│   │   └── utils/                # Yardımcı fonksiyonlar
│   ├── vite.config.js
│   └── package.json
└── docs/                         # Dokümantasyon
    ├── PROJE-DOKUMANTASYONU.md   # Bu dosya
    └── KARSILASTIRMA-MANTIGI.md  # Karşılaştırma mantığı detayı
```

---

## Ek: Sıkça Karşılaşılan Konular

### Not/Açıklama Sahte Değişiklik (False Positive) Sorunu

**Sorun:** Excel'deki metin alanları (Not, Açıklama, İşlem Adı) farklı satır sonu karakterleri, görünmez Unicode karakterleri veya fazladan boşluklar içerebilir. Bu, DB'deki değerle karşılaştırıldığında içerik değişmemiş olsa bile "değişmiş" olarak algılanmasına neden olur.

**Çözüm:** `normalizeText()` fonksiyonu her iki taraftaki metni de normalize ederek yalnızca gerçek içerik farklarını tespit eder.

### SUT Excel'de Hiyerarşi Satırları

**Sorun:** SUT Excel dosyasında işlem satırlarının yanı sıra kategori ve başlık satırları da bulunur. Bunlar işlem sayısına dahil edilmemelidir.

**Çözüm:** `sutExcelParser.js` hiyerarşi satırlarını otomatik tespit eder ve ayırır. `normalizedData.length` (gerçek işlem sayısı) frontend'deki özette gösterilir, hiyerarşi satırları ayrı yönetilir.

### İlk Yükleme Tarihi

İlk liste yüklemesi `2026-02-05` tarihli olarak kaydedilmiştir. Sonraki yüklemeler yüklemenin yapıldığı günün tarihini alır. Dosya adından tarih çıkarılabiliyorsa (`extractDateFromFilename`), o tarih kullanılır.

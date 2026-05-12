# HUV API - Endpoint Dokümantasyonu

**Oluşturulma Tarihi:** 12.05.2026 22:10:20

---

## 📊 Genel Bilgiler

**Base URL:** `http://localhost:3000/api`

**Authentication:** JWT Bearer Token

**Content-Type:** `application/json`

### İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam Endpoint | 61 |
| Public Endpoint | 59 |
| Auth Required | 2 |
| Admin Only | 0 |

### HTTP Method Dağılımı

| Method | Sayı |
|--------|------|
| DELETE | 1 |
| GET | 48 |
| POST | 11 |
| PUT | 1 |

## 📑 İçindekiler

- [Alt Teminatlar](#altteminatlar)
- [Ana Dallar](#anadal)
- [Authentication](#auth)
- [External API](#external)
- [Import (Admin)](#import)
- [HUV İşlemleri](#islemler)
- [Matching](#matching)
- [SUT İşlemleri](#sut)
- [SUT Tarihsel](#suttarihsel)
- [HUV Tarihsel](#tarihsel)
- [Versiyonlar (Admin)](#versiyonlar)

---

## Alt Teminatlar

**Dosya:** `altTeminatlar.js`

### 🔴 DELETE `/:id/islemler/:sutId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** DELETE /api/alt-teminatlar/:id/islemler/:sutId - Alt teminattan işlem kaldır

**Handler:** `removeAltTeminatIslem`

**Path Parameters:**

- `id`: Kayıt ID
- `sutId`: ID parametresi

---

### 🔵 GET `/`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/alt-teminatlar - Tüm alt teminatları listele

**Handler:** `getAltTeminatlar`

---

### 🔵 GET `/sut-islemler`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/alt-teminatlar/sut-islemler - SUT işlemlerini ara

**Handler:** `searchSutIslemler`

---

### 🔵 GET `/:id/islemler`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/alt-teminatlar/:id/islemler - Alt teminata atanmış işlemleri getir

**Handler:** `getAltTeminatIslemler`

**Path Parameters:**

- `id`: Kayıt ID

---

### 🟢 POST `/:id/islemler`

**Yetkilendirme:** 🌐 Public

**Açıklama:** POST /api/alt-teminatlar/:id/islemler - Alt teminata işlem ata

**Handler:** `addAltTeminatIslem`

**Path Parameters:**

- `id`: Kayıt ID

---

## Ana Dallar

**Dosya:** `anadal.js`

### 🔵 GET `/`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getAnaDallar`

---

## Authentication

**Dosya:** `auth.js`

### 🔵 GET `/me`

**Yetkilendirme:** 🔒 Auth

**Açıklama:** ============================================

**Handler:** `getMe`

**Middleware:** authenticate

---

### 🟢 POST `/login`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `login`

---

### 🟢 POST `/logout`

**Yetkilendirme:** 🔒 Auth

**Açıklama:** ============================================

**Handler:** `logout`

**Middleware:** authenticate

---

## External API

**Dosya:** `external.js`

### 🔵 GET `/huv`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/external/huv

**Handler:** `getHuvList`

---

### 🔵 GET `/sut`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/external/sut

**Handler:** `getSutList`

---

### 🔵 GET `/il-katsayi`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/external/il-katsayi

**Handler:** `getIlKatsayiList`

---

## Import (Admin)

**Dosya:** `import.js`

### 🔵 GET `/status`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `checkImportStatus`

---

### 🔵 GET `/history`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getImportHistory`

---

### 🔵 GET `/report/:versionId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getImportReport`

**Path Parameters:**

- `versionId`: ID parametresi

---

### 🟢 POST `/huv`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**File Upload:** ✓ (multipart/form-data)

**Handler:** `importHuvList`

**Middleware:** uploadSingle, importLock

---

### 🟢 POST `/sut`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**File Upload:** ✓ (multipart/form-data)

**Handler:** `importSutList`

**Middleware:** uploadSingle, importLock

---

### 🟢 POST `/sut/preview`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**File Upload:** ✓ (multipart/form-data)

**Handler:** `previewSutImport`

**Middleware:** uploadSingle

---

### 🟢 POST `/il-katsayi`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**File Upload:** ✓ (multipart/form-data)

**Handler:** `importIlKatsayiList`

**Middleware:** uploadSingle, importLock

---

### 🟢 POST `/il-katsayi/preview`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**File Upload:** ✓ (multipart/form-data)

**Handler:** `previewIlKatsayiImport`

**Middleware:** uploadSingle

---

### 🟢 POST `/preview`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**File Upload:** ✓ (multipart/form-data)

**Handler:** `previewImport`

**Middleware:** uploadSingle

---

## HUV İşlemleri

**Dosya:** `islemler.js`

### 🔵 GET `/`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getIslemler`

---

### 🔵 GET `/ara`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `araIslem`

---

### 🔵 GET `/gelismis-arama`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getGelismisArama`

---

### 🔵 GET `/fiyat-aralik`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getFiyatAralik`

---

### 🔵 GET `/hiyerarsi`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getHiyerarsi`

---

### 🔵 GET `/son-guncellemeler`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getSonGuncellemeler`

---

### 🔵 GET `/sut-kodu`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getSutKodu`

---

### 🔵 GET `/en-pahali`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getEnPahali`

---

### 🔵 GET `/en-ucuz`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getEnUcuz`

---

### 🔵 GET `/kategori`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getKategori`

---

## Matching

**Dosya:** `matching.js`

### 🔵 GET `/results`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/matching/results - Get matching results with filtering and pagination

**Handler:** `getResults`

---

### 🔵 GET `/huv-options/:sutId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/matching/huv-options/:sutId - Get available HUV teminat options for a SUT işlem

**Handler:** `getHuvOptions`

**Path Parameters:**

- `sutId`: ID parametresi

---

### 🔵 GET `/stats`

**Yetkilendirme:** 🌐 Public

**Açıklama:** GET /api/matching/stats - Get comprehensive matching statistics

**Handler:** `getStats`

---

### 🟢 POST `/run-batch`

**Yetkilendirme:** 🌐 Public

**Açıklama:** POST /api/matching/run-batch - Run batch matching operation

**Handler:** `runBatch`

---

### 🟢 POST `/approve/:sutId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** POST /api/matching/approve/:sutId - Approve an automatic match

**Handler:** `approveMatch`

**Path Parameters:**

- `sutId`: ID parametresi

---

### 🟡 PUT `/change/:sutId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** PUT /api/matching/change/:sutId - Change match to a different HUV teminat

**Handler:** `changeMatch`

**Path Parameters:**

- `sutId`: ID parametresi

---

## SUT İşlemleri

**Dosya:** `sut.js`

### 🔵 GET `/ana-basliklar`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Ana başlıklar (1-10)

**Handler:** `sutController.getAnaBasliklar`

---

### 🔵 GET `/ana-baslik/:no`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Ana başlık detayı

**Handler:** `sutController.getAnaBaslikDetay`

**Path Parameters:**

- `no`: ID parametresi

---

### 🔵 GET `/hiyerarsi`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Hiyerarşi ağacı

**Handler:** `sutController.getHiyerarsi`

---

### 🔵 GET `/unmatched`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Eşleşmemiş kayıtlar

**Handler:** `sutController.getUnmatchedRecords`

---

### 🔵 GET `/kategoriler`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Kategoriler

**Handler:** `sutController.getKategoriler`

---

### 🔵 GET `/kategori/:kategoriId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Kategoriye göre SUT kodları

**Handler:** `sutController.getSutByKategori`

**Path Parameters:**

- `kategoriId`: ID parametresi

---

### 🔵 GET `/ara`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Arama

**Handler:** `sutController.araSut`

---

### 🔵 GET `/stats`

**Yetkilendirme:** 🌐 Public

**Açıklama:** İstatistikler

**Handler:** `sutController.getSutStats`

---

### 🔵 GET `/:kod`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Belirli SUT kodu

**Handler:** `sutController.getSutByKod`

**Path Parameters:**

- `kod`: ID parametresi

---

### 🔵 GET `/`

**Yetkilendirme:** 🌐 Public

**Açıklama:** Ana başlıklar (1-10)

**Handler:** `sutController.getSutKodlari`

---

## SUT Tarihsel

**Dosya:** `sutTarihsel.js`

### 🔵 GET `/puan`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getPuanByTarih`

---

### 🔵 GET `/degisen`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getDegişenler`

---

### 🔵 GET `/karsilastir`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `karsilastirVersiyonlar`

---

### 🔵 GET `/stats`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getTarihselStats`

---

### 🔵 GET `/gecmis/:identifier`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getPuanGecmisi`

**Path Parameters:**

- `identifier`: ID parametresi

---

### 🔵 GET `/versiyonlar/:sutId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getVersionlar`

**Path Parameters:**

- `sutId`: ID parametresi

---

### 🔵 GET `/yasam-dongusu/:identifier`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getYasamDongusu`

**Path Parameters:**

- `identifier`: ID parametresi

---

## HUV Tarihsel

**Dosya:** `tarihsel.js`

### 🔵 GET `/fiyat`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getFiyatByTarih`

---

### 🔵 GET `/degisen`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getDegişenler`

---

### 🔵 GET `/gecmis/:identifier`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getFiyatGecmisi`

**Path Parameters:**

- `identifier`: ID parametresi

---

### 🔵 GET `/versiyonlar/:islemId`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getVersionlar`

**Path Parameters:**

- `islemId`: ID parametresi

---

### 🔵 GET `/yasam-dongusu/:identifier`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `getYasamDongusu`

**Path Parameters:**

- `identifier`: ID parametresi

---

## Versiyonlar (Admin)

**Dosya:** `versiyonlar.js`

### 🔵 GET `/`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `next`

**Middleware:** async (req, res

---

### 🔵 GET `/:id`

**Yetkilendirme:** 🌐 Public

**Açıklama:** ============================================

**Handler:** `next`

**Middleware:** async (req, res

**Path Parameters:**

- `id`: Kayıt ID

---

## 🔐 Authentication

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**

```json
{
  "kullaniciAdi": "admin",
  "sifre": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "kullanici": {
      "kullaniciID": 1,
      "kullaniciAdi": "admin",
      "rol": "admin"
    }
  },
  "message": "Giriş başarılı"
}
```

### Token Kullanımı

Tüm korumalı endpoint'ler için Authorization header'ı gereklidir:

```
Authorization: Bearer <token>
```

## ❌ Error Responses

### Standart Error Format

```json
{
  "success": false,
  "message": "Hata mesajı",
  "error": "Detaylı hata açıklaması"
}
```

### HTTP Status Codes

| Code | Açıklama |
|------|----------|
| 200 | Başarılı istek |
| 201 | Kaynak oluşturuldu |
| 400 | Geçersiz istek |
| 401 | Yetkilendirme gerekli |
| 403 | Erişim yasak |
| 404 | Kaynak bulunamadı |
| 409 | Çakışma (duplicate) |
| 500 | Sunucu hatası |


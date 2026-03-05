---
title: External API Documentation
description: Dışarıdan erişilebilen API endpoint'leri - HUV ve SUT listeleri
inclusion: auto
fileMatchPattern: "**/external/**"
---

# External API Documentation

Bu dokümantasyon, sistemin dışarıya açtığı API endpoint'lerini açıklar. Bu API'ler, üçüncü parti sistemlerin HUV ve SUT verilerine erişmesini sağlar.

## Genel Bilgiler

### Base URL
```
http://localhost:3000/api/external
```

### Authentication
**ÖNEMLİ:** Bu endpoint'ler JWT authentication gerektiriyor! ✅

**Authentication Mekanizması:**
- JWT (JSON Web Token) tabanlı
- Token süresi: 24 saat (varsayılan)
- Header: `Authorization: Bearer <token>`

**Token Alma:**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "kullaniciAdi": "admin",
  "sifre": "admin123"
}

# Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "kullanici": {
      "kullaniciId": 1,
      "kullaniciAdi": "admin",
      "rol": "ADMIN"
    }
  }
}
```

**Token Kullanımı:**
```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/external/huv
```

⚠️ **Ek Güvenlik Önerileri:**
- Rate limiting eklenebilir
- IP whitelist yapılabilir
- API key sistemi eklenebilir (çift katmanlı güvenlik)

### Response Format
Tüm endpoint'ler standart response formatını kullanır:

```javascript
{
  "success": true,
  "message": "Success message",
  "data": {
    "listeTipi": "HUV" | "SUT" | "ILKATSAYI",
    "toplamUstTeminat": 123,
    "toplamAltTeminat": 456,
    "toplamIslem": 7890,
    "data": [ /* array of records */ ]
  }
}
```

---

## 1. HUV Listesi API

### Endpoint
```
GET /api/external/huv
```

### Açıklama
HUV (Hastane Uygulama Veri) işlemlerini 2 seviye kırılımla döner:
- **Üst Teminat:** Ana dal bazlı üst kategori
- **Alt Teminat:** İşlem kategorisi
- **İşlemler:** Her alt teminat altındaki işlemler

### Veri Kaynağı
- **Tablo:** `HuvIslemler` + `AnaDallar`
- **Filtre:** `AktifMi = 1`
- **Sıralama:** `AnaDalKodu, HuvKodu`

### Üst/Alt Teminat Belirleme Mantığı

**ÖNEMLİ:** External API **sadece ilk 2 seviye** döner. İç sistemde 3-4 seviye hiyerarşi olabilir.

HUV'da `UstBaslik` alanı hiyerarşik yapıyı içerir:
```
İç Sistem: "KALP VE DAMAR CERRAHİSİ → ERİŞKİN KALP CERRAHİSİ → Kapak Cerrahisi → Mitral Kapak"
External API: Sadece ilk 2 seviye
```

**Parsing Kuralları:**
1. `UstBaslik` boş ise → Üst Teminat = Alt Teminat = Ana Dal Adı
2. Tek seviye ("A") → Üst Teminat = Alt Teminat = "A"
3. İki+ seviye ("A → B → C → D") → **Sadece ilk 2 seviye:** Üst Teminat = "A", Alt Teminat = "B"

**Örnek:**
```javascript
// İç Sistem (HuvIslemler.UstBaslik):
"KALP VE DAMAR CERRAHİSİ → ERİŞKİN KALP CERRAHİSİ → Kapak Cerrahisi → Mitral Kapak"

// External API Response:
ustTeminat: "KALP VE DAMAR CERRAHİSİ"      // parts[0]
altTeminat: "ERİŞKİN KALP CERRAHİSİ"       // parts[1]
// "Kapak Cerrahisi" ve "Mitral Kapak" gruplama için kullanılmaz

// Ama işlem detayında tam bilgi var:
islemler[0].ustBaslik: "KALP VE DAMAR CERRAHİSİ → ERİŞKİN KALP CERRAHİSİ → Kapak Cerrahisi → Mitral Kapak"
islemler[0].hiyerarsiSeviyesi: 4
```

**Not:** Detaylı hiyerarşi bilgisi her işlemin `ustBaslik` ve `hiyerarsiSeviyesi` alanlarında mevcuttur.

### Response Yapısı

**Not:** Gruplama sadece ilk 2 seviye üzerinden yapılır. 3-4 seviye hiyerarşi olan işlemler aynı alt teminat altında toplanır.

```javascript
{
  "success": true,
  "message": "HUV listesi",
  "data": {
    "listeTipi": "HUV",
    "toplamUstTeminat": 34,        // Benzersiz üst teminat sayısı
    "toplamAltTeminat": 156,       // Toplam alt teminat sayısı (ilk 2 seviye)
    "toplamIslem": 8542,           // Toplam işlem sayısı
    "data": [
      {
        "ustTeminat": {
          "kod": "1|GENEL CERRAHİ",
          "adi": "GENEL CERRAHİ"
        },
        "altTeminat": {
          "kod": "1|GENEL CERRAHİ|Meme Cerrahisi",
          "adi": "Meme Cerrahisi"
        },
        "islemler": [
          {
            "islemId": 123,
            "huvKodu": 10.12345,
            "islemAdi": "Mastektomi",
            "birim": 1500.50,
            "sutKodu": "10.01.0123",
            "ustBaslik": "GENEL CERRAHİ → Meme Cerrahisi → Mastektomi",  // ✅ Tam hiyerarşi
            "hiyerarsiSeviyesi": 3,                                       // ✅ Gerçek seviye
            "notlar": "Açıklama metni"
          }
        ]
      }
    ]
  }
}
```

**Önemli:** 
- `ustTeminat` ve `altTeminat`: Sadece ilk 2 seviye (gruplama için)
- `islemler[].ustBaslik`: Tam hiyerarşi bilgisi (3-4 seviye olabilir)
- `islemler[].hiyerarsiSeviyesi`: Gerçek seviye sayısı

### Kullanım Senaryoları

1. **Fiyat Sorgulama Sistemi**
   - Üçüncü parti sistemler HUV kodlarına göre fiyat sorgulayabilir
   - İlk 2 seviye ile filtreleme yapabilir
   - Detaylı hiyerarşi için `ustBaslik` alanını kullanabilir

2. **Entegrasyon**
   - Hastane bilgi sistemleri HUV listesini senkronize edebilir
   - Muhasebe sistemleri fiyat güncellemelerini alabilir
   - **Not:** Gruplama basitleştirilmiş (2 seviye), detay için işlem bazlı kontrol gerekir

3. **Raporlama**
   - Ana dal bazlı işlem sayıları
   - Teminat bazlı maliyet analizleri (ilk 2 seviye)
   - Detaylı analiz için `hiyerarsiSeviyesi` ve `ustBaslik` kullanılabilir

### Örnek Kullanım

```javascript
// JavaScript - Token ile istek
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

fetch('http://localhost:3000/api/external/huv', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log(`Toplam ${data.data.toplamIslem} işlem bulundu`);
    
    // İlk alt teminatın işlemlerini listele
    const ilkAltTeminat = data.data.data[0];
    console.log(`${ilkAltTeminat.altTeminat.adi} - ${ilkAltTeminat.islemler.length} işlem`);
  });
```

```python
# Python - Token ile istek
import requests

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
headers = {'Authorization': f'Bearer {token}'}

response = requests.get('http://localhost:3000/api/external/huv', headers=headers)
data = response.json()

for item in data['data']['data']:
    print(f"{item['altTeminat']['adi']}: {len(item['islemler'])} işlem")
```

```bash
# cURL - Token ile istek
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/external/huv
```

---

## 2. SUT Listesi API

### Endpoint
```
GET /api/external/sut
```

### Açıklama
SUT (Sağlık Uygulama Tebliği) işlemlerini 2 seviye kırılımla döner:
- **Üst Teminat:** Ana Başlık (1-10)
- **Alt Teminat:** Hiyerarşi Seviye 2
- **İşlemler:** Her alt teminat altındaki SUT kodları

### Veri Kaynağı
- **Tablolar:** `SutIslemler` + `SutAnaBasliklar` + `SutHiyerarsi`
- **Filtre:** `AktifMi = 1`
- **Sıralama:** `AnaBaslikNo, SutKodu`

### Hiyerarşi Yapısı

SUT'ta 4 seviyeli hiyerarşi var:
```
Seviye 1: Ana Başlık (10 adet) - Üst Teminat
Seviye 2: Alt Kategori - Alt Teminat
Seviye 3: Detay Kategori
Seviye 4: İşlem
```

**Örnek:**
```
Seviye 1: CERRAHİ İŞLEMLER (Ana Başlık)
  └─ Seviye 2: Genel Cerrahi İşlemler (Alt Teminat)
      └─ Seviye 3: Meme Cerrahisi
          └─ İşlem: 10.01.0123 - Mastektomi
```

### Response Yapısı

```javascript
{
  "success": true,
  "message": "SUT listesi",
  "data": {
    "listeTipi": "SUT",
    "toplamUstTeminat": 10,        // Ana başlık sayısı
    "toplamIslem": 7129,           // Toplam SUT işlem sayısı
    "data": [
      {
        "ustTeminat": {
          "kod": 1,
          "adi": "CERRAHİ İŞLEMLER"
        },
        "altTeminat": {
          "kod": 123,                // HiyerarsiID
          "adi": "Genel Cerrahi İşlemler"
        },
        "islemler": [
          {
            "sutId": 456,
            "sutKodu": "10.01.0123",
            "islemAdi": "Mastektomi",
            "puan": 1500.0,
            "aciklama": "Açıklama metni"
          }
        ]
      }
    ]
  }
}
```

### Kullanım Senaryoları

1. **Puan Sorgulama**
   - SUT koduna göre puan bilgisi alınabilir
   - Ana başlık bazlı işlem listeleri

2. **Eşleştirme Sistemleri**
   - HUV-SUT eşleştirme için referans liste
   - Otomatik kod dönüşüm sistemleri

3. **Fatura Sistemleri**
   - SUT kodlarına göre fatura oluşturma
   - Puan bazlı hesaplamalar

### Örnek Kullanım

```javascript
// JavaScript - Belirli bir SUT kodunu bul
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

fetch('http://localhost:3000/api/external/sut', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    const sutKodu = "10.01.0123";
    
    for (const item of data.data.data) {
      const islem = item.islemler.find(i => i.sutKodu === sutKodu);
      if (islem) {
        console.log(`${islem.sutKodu}: ${islem.puan} puan`);
        break;
      }
    }
  });
```

---

## 3. İl Katsayıları API

### Endpoint
```
GET /api/external/il-katsayi
```

### Açıklama
İllere göre uygulanan katsayı listesini döner.

### Veri Kaynağı
- **Tablo:** `IlKatsayilari`
- **Filtre:** `AktifMi = 1`
- **Sıralama:** `IlAdi`

### Response Yapısı

```javascript
{
  "success": true,
  "message": "İl katsayıları listesi",
  "data": {
    "listeTipi": "ILKATSAYI",
    "toplamIl": 81,
    "data": [
      {
        "ilKatsayiId": 1,
        "ilAdi": "ADANA",
        "plakaKodu": 1,
        "katsayi": 1.15,
        "donemBaslangic": "2024-01-01",
        "donemBitis": "2024-12-31"
      }
    ]
  }
}
```

### Kullanım Senaryoları

1. **Fiyat Hesaplama**
   - İl bazlı fiyat çarpanı
   - Bölgesel fiyat farklılıkları

2. **Raporlama**
   - İl bazlı maliyet analizleri
   - Dönemsel katsayı değişimleri

### Örnek Kullanım

```javascript
// JavaScript - İstanbul katsayısını bul
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

fetch('http://localhost:3000/api/external/il-katsayi', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    const istanbul = data.data.data.find(il => il.ilAdi === 'İSTANBUL');
    console.log(`İstanbul katsayısı: ${istanbul.katsayi}`);
  });
```

---

## Performans Bilgileri

### Veri Boyutları (Tahmini)

| Endpoint | Kayıt Sayısı | Response Boyutu | Süre |
|----------|--------------|-----------------|------|
| /huv | ~8,500 işlem | ~2-3 MB | ~200-300ms |
| /sut | ~7,129 işlem | ~1-2 MB | ~150-250ms |
| /il-katsayi | 81 il | ~10 KB | ~10-20ms |

### Optimizasyon Önerileri

1. **Caching**
   ```javascript
   // Redis cache eklenebilir
   // Cache TTL: 1 saat (veriler sık değişmez)
   ```

2. **Pagination**
   ```javascript
   // Büyük listeler için sayfalama
   GET /api/external/huv?page=1&limit=100
   ```

3. **Filtering**
   ```javascript
   // Ana dal bazlı filtreleme
   GET /api/external/huv?anaDalKodu=1
   
   // Ana başlık bazlı filtreleme
   GET /api/external/sut?anaBaslikNo=1
   ```

4. **Compression**
   ```javascript
   // GZIP compression (Express middleware)
   app.use(compression());
   ```

---

## Güvenlik Özellikleri

### ✅ Mevcut Güvenlik

1. **JWT Authentication**
   - Token tabanlı kimlik doğrulama
   - 24 saat token süresi
   - Kullanıcı aktiflik kontrolü
   - Token expiration kontrolü

2. **Database Validation**
   - Her istekte kullanıcı veritabanından kontrol edilir
   - Pasif kullanıcılar erişemez
   - Rol bazlı yetkilendirme

3. **CORS Protection**
   - Sadece belirli origin'lere izin
   - Credentials kontrolü

### 🔒 Ek Güvenlik Önerileri

#### 1. Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const externalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // 100 istek
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use('/external', externalApiLimiter);
```

#### 2. IP Whitelist (Opsiyonel)

```javascript
const ipWhitelist = ['192.168.1.100', '10.0.0.50'];

const ipFilter = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!ipWhitelist.includes(clientIp)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied from this IP'
    });
  }
  
  next();
};

// Sadece external API'lere uygula
router.use('/external', ipFilter);
```

#### 3. API Key (Çift Katmanlı Güvenlik)

```javascript
// JWT + API Key kombinasyonu
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing API key'
    });
  }
  
  next();
};

// Hem JWT hem API Key gerekli
router.use('/external', authenticate, apiKeyAuth);
```

---

## Hata Durumları

### Authentication Errors

#### Missing Token
```javascript
{
  "success": false,
  "message": "Token bulunamadı",
  "errors": {
    "tip": "TOKEN_EKSIK",
    "cozum": "Lütfen giriş yapın"
  }
}
```
**HTTP Status:** 401

#### Expired Token
```javascript
{
  "success": false,
  "message": "Token süresi dolmuş",
  "errors": {
    "tip": "TOKEN_SURESI_DOLMUS",
    "cozum": "Lütfen tekrar giriş yapın"
  }
}
```
**HTTP Status:** 401

#### Invalid Token
```javascript
{
  "success": false,
  "message": "Geçersiz token",
  "errors": {
    "tip": "TOKEN_GECERSIZ",
    "cozum": "Lütfen tekrar giriş yapın"
  }
}
```
**HTTP Status:** 401

#### User Not Found
```javascript
{
  "success": false,
  "message": "Kullanıcı bulunamadı veya aktif değil",
  "errors": {
    "tip": "KULLANICI_BULUNAMADI",
    "cozum": "Lütfen tekrar giriş yapın"
  }
}
```
**HTTP Status:** 401

### Database Errors

#### Connection Error
```javascript
{
  "success": false,
  "message": "Database connection failed",
  "errors": null
}
```
**HTTP Status:** 500

### Success with Empty Data
```javascript
{
  "success": true,
  "message": "HUV listesi",
  "data": {
    "listeTipi": "HUV",
    "toplamUstTeminat": 0,
    "toplamAltTeminat": 0,
    "toplamIslem": 0,
    "data": []
  }
}
```
**HTTP Status:** 200 (boş liste başarılı response)

---

## Kullanım İstatistikleri (Önerilen)

### Logging Ekle

```javascript
const logApiUsage = async (endpoint, clientIp, responseTime) => {
  await pool.request()
    .input('endpoint', sql.NVarChar, endpoint)
    .input('clientIp', sql.NVarChar, clientIp)
    .input('responseTime', sql.Int, responseTime)
    .query(`
      INSERT INTO ApiUsageLogs (Endpoint, ClientIP, ResponseTime, RequestDate)
      VALUES (@endpoint, @clientIp, @responseTime, GETDATE())
    `);
};
```

### Monitoring Dashboard

- Günlük istek sayısı
- Endpoint bazlı kullanım
- Ortalama response time
- Hata oranları

---

## Test Örnekleri

### cURL

```bash
# Önce login olup token al
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"kullaniciAdi":"admin","sifre":"admin123"}' \
  | jq -r '.data.token')

# HUV listesi
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/external/huv

# SUT listesi
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/external/sut

# İl katsayıları
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/external/il-katsayi
```

### Postman Collection

```json
{
  "info": {
    "name": "HUV External API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{authToken}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Login",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "var jsonData = pm.response.json();",
              "pm.environment.set('authToken', jsonData.data.token);"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/auth/login",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"kullaniciAdi\": \"admin\",\n  \"sifre\": \"admin123\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        }
      }
    },
    {
      "name": "Get HUV List",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/external/huv"
      }
    },
    {
      "name": "Get SUT List",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/external/sut"
      }
    },
    {
      "name": "Get Il Katsayi List",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/external/il-katsayi"
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ]
}
```

---

## Özet

### Mevcut Durum
- ✅ 3 endpoint aktif
- ✅ JWT Authentication var
- ✅ Kullanıcı doğrulama var
- ✅ Token expiration kontrolü var
- ❌ Rate limiting yok
- ❌ Caching yok
- ❌ Frontend'de kullanılmıyor
- ❌ API usage logging yok

### Önemli Notlar
1. **HUV Hiyerarşi:** İç sistemde 3-4 seviye olabilir, external API sadece ilk 2 seviye döner
2. **Detay Bilgi:** Tam hiyerarşi her işlemin `ustBaslik` alanında mevcut
3. **Gruplama:** Basitleştirilmiş (2 seviye), farklı alt seviyeler aynı grupta olabilir

### Güçlü Yönler
1. **Güvenli:** JWT authentication ile korumalı
2. **Yapılandırılmış:** 2 seviye kırılım ile basit gruplama
3. **Kapsamlı:** HUV, SUT ve İl Katsayı verilerini sunuyor
4. **Standart:** Tutarlı response formatı
5. **Detay Korunuyor:** Tam hiyerarşi bilgisi işlem detayında var

### İyileştirme Önerileri
1. **Performans:** Redis cache ekle (1 saat TTL)
2. **Güvenlik:** Rate limiting ekle (DDoS koruması)
3. **Monitoring:** API usage logging ekle
4. **Documentation:** Swagger/OpenAPI dokümantasyonu
5. **Versioning:** `/api/v1/external` gibi versiyonlama
6. **Pagination:** Büyük listeler için sayfalama
7. **Filtering:** Ana dal/başlık bazlı filtreleme

### Kullanım Alanları
- Üçüncü parti entegrasyonlar
- Mobil uygulama backend'i
- Partner sistemler (hastane, muhasebe)
- Raporlama araçları
- Veri senkronizasyonu
- Fiyat sorgulama sistemleri


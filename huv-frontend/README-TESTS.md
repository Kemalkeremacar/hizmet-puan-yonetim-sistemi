# HUV Frontend Test Dokümantasyonu

Bu dokümantasyon, HUV Frontend uygulaması için yazılmış olan E2E (End-to-End) testleri hakkında bilgi içerir.

## Test Özeti

**Toplam Test Sayısı:** 45
- **Authentication Tests:** 12 test ✅
- **Smoke Tests:** 6 test ✅  
- **Filtering Tests:** 8 test ✅
- **Tarihsel Queries Tests:** 19 test ✅

**Başarı Oranı:** 100% (45/45)

## Test Kategorileri

### 1. Authentication Tests (`auth.spec.js`)
Kullanıcı girişi ve oturum yönetimi testleri:
- Login sayfası görünürlüğü
- Geçersiz kimlik bilgileri kontrolü
- Başarılı giriş işlemi
- Oturum kalıcılığı
- Çıkış işlemi
- Korumalı sayfa erişimi
- Session timeout yönetimi
- Password visibility toggle
- Network hata yönetimi
- Whitespace trimming
- Çoklu login denemesi koruması

### 2. Smoke Tests (`smoke-tests.spec.js`)
Temel uygulama sağlığı testleri:
- Ana sayfaların yüklenmesi
- Sayfa crash kontrolü
- Temel UI elementleri varlığı
- Navigasyon işlevselliği
- API çağrıları
- Logout işlemi

### 3. Filtering Tests (`filtering.spec.js`)
Matching-review sayfası filtreleme testleri:
- Filtre alanları görünürlüğü
- SUT kodu filtresi
- İşlem adı filtresi
- Skor aralığı filtreleri
- Filtreleri temizle butonu
- Çoklu filtre kombinasyonları
- Input validation
- Pagination entegrasyonu

### 4. Tarihsel Queries Tests (`tarihsel-queries.spec.js`)
HUV ve SUT tarihsel sorgu sayfaları testleri:

#### HUV Tarihsel Testleri:
- Sayfa yükleme ve tab görünürlüğü
- Tarihteki Fiyat tab işlevselliği
- Değişen İşlemler tab geçişi
- Fiyat Geçmişi tab geçişi
- Form validasyonu
- **Gerçek veri ile sorgu testleri:**
  - HUV fiyat sorgusu
  - Değişen işlemler sorgusu
  - Fiyat geçmişi sorgusu

#### SUT Tarihsel Testleri:
- Sayfa yükleme ve tab görünürlüğü
- Tarihteki Puan tab işlevselliği
- Değişen Kodlar tab geçişi
- Puan Geçmişi tab geçişi
- Form validasyonu
- **Gerçek veri ile sorgu testleri:**
  - SUT puan sorgusu
  - Değişen kodlar sorgusu
  - Puan geçmişi sorgusu

#### Genel Tarihsel Testleri:
- Sayfa navigasyonları
- Tarih input alanları
- Tab geçişlerinde state koruma

## Test Çalıştırma

### Tüm Testleri Çalıştır
```bash
npm test
```

### Belirli Test Kategorilerini Çalıştır
```bash
# Authentication testleri
npm test -- --grep "Authentication Tests"

# Smoke testleri
npm test -- --grep "Smoke Tests"

# Filtreleme testleri
npm test -- --grep "Filtreleme Testleri"

# Tarihsel sorgu testleri
npm test -- --grep "Tarihsel Sorgular Testleri"
```

### Test Raporunu Görüntüle
```bash
npm run test:report
```

## Test Yapılandırması

### Playwright Konfigürasyonu
- **Tarayıcılar:** Chromium, Firefox, WebKit
- **Paralel Çalıştırma:** Etkin
- **Retry:** 2 kez
- **Timeout:** 30 saniye
- **Reporter:** Özel Türkçe reporter

### Test Helpers
- **Auth Helper:** Otomatik login işlemi
- **Test Users:** Farklı kullanıcı rolleri için test verileri
- **Turkish Reporter:** Türkçe test sonuçları

## Önemli Notlar

### Gerçek API Testleri
Tarihsel sorgu testleri gerçek backend API'leri ile çalışır:
- Gerçek veri ile sorgu yapılır
- API response'ları kontrol edilir
- Toast mesajları ve UI feedback'leri test edilir
- Hata durumları da test kapsamındadır

### Test Verileri
- HUV Kodu örnekleri: `100001`, `20.00057`
- SUT Kodu örnekleri: `510010`
- Tarih aralıkları: Son 7 gün, belirli tarihler

### Güvenilir Seçiciler
Testlerde kullanılan seçici stratejileri:
- `visible=true` ile sadece görünür elementler
- Spesifik label ve role seçicileri
- Tab panel index'leri ile doğru buton seçimi

## Test Geliştirme Rehberi

### Yeni Test Ekleme
1. Uygun test dosyasını seç veya yeni oluştur
2. `test.describe()` ile test grubunu tanımla
3. `test.beforeEach()` ile setup işlemlerini yap
4. Gerçekçi test senaryoları yaz
5. Anlamlı assertion'lar kullan

### Best Practices
- Gerçek kullanıcı davranışlarını simüle et
- UI elementlerinin varlığını ve işlevselliğini test et
- API çağrılarının sonuçlarını kontrol et
- Hata durumlarını da test et
- Console log'ları ile test durumunu takip et

## Sorun Giderme

### Yaygın Sorunlar
1. **Timeout Hataları:** `waitForTimeout()` ve `waitForLoadState()` kullan
2. **Element Bulunamama:** Seçicileri kontrol et, `visible=true` ekle
3. **API Hataları:** Backend'in çalıştığından emin ol
4. **Flaky Testler:** Retry mekanizması ve daha güvenilir seçiciler kullan

### Debug İpuçları
- `--debug` flag'i ile test debug et
- `page.screenshot()` ile görsel kontrol yap
- Console log'ları ile test akışını takip et
- HTML report'u ile detaylı analiz yap

## Sonuç

Bu test suite'i HUV Frontend uygulamasının temel işlevselliğini kapsamlı şekilde test eder. Özellikle tarihsel sorgu testleri ile gerçek API entegrasyonları da doğrulanmaktadır. Testler sürekli entegrasyon süreçlerinde otomatik olarak çalıştırılabilir ve uygulamanın kalitesini garanti altına alır.
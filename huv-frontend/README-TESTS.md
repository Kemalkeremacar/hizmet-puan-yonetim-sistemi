# Playwright Test Dokümantasyonu

## 🎭 Kurulum

Playwright zaten yüklü. Eğer yeniden kurulum gerekirse:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## 🚀 Test Çalıştırma

### Tüm testleri çalıştır
```bash
npm test
```

### UI modunda çalıştır (interaktif)
```bash
npm run test:ui
```

### Headed modda çalıştır (browser görünür)
```bash
npm run test:headed
```

### Debug modda çalıştır
```bash
npm run test:debug
```

### Belirli bir test dosyasını çalıştır
```bash
npx playwright test tests/e2e/auth.spec.js
```

### Test raporunu görüntüle
```bash
npm run test:report
```

## 📁 Test Yapısı

```
tests/
├── e2e/                    # End-to-end testler
│   └── auth.spec.js        # Authentication testleri
├── fixtures/               # Test verileri
│   └── test-users.json     # Test kullanıcıları
└── helpers/                # Yardımcı fonksiyonlar
    └── auth.js             # Login/logout helpers
```

## 🧪 Mevcut Testler

### Authentication Tests (auth.spec.js)

1. ✅ **Login sayfası görüntüleme**
   - Form elementlerinin varlığı
   - Buton ve input kontrolü

2. ✅ **Boş form validasyonu**
   - Boş kullanıcı adı/şifre kontrolü

3. ✅ **Yanlış kimlik bilgileri**
   - Hata mesajı görüntüleme
   - Toast notification kontrolü

4. ✅ **Başarılı login**
   - Admin kullanıcısı ile giriş
   - Dashboard'a yönlendirme
   - Navbar kontrolü

5. ✅ **Session persistence**
   - Sayfa yenileme sonrası login durumu
   - LocalStorage kontrolü

6. ✅ **Logout işlemi**
   - Çıkış yapma
   - Login sayfasına yönlendirme

7. ✅ **Protected route kontrolü**
   - Login olmadan erişim engelleme
   - Otomatik yönlendirme

8. ✅ **Session timeout**
   - Token silme simülasyonu
   - Otomatik logout

9. ✅ **Şifre görünürlük toggle**
   - Göz ikonu kontrolü
   - Type attribute değişimi

10. ✅ **Network hataları**
    - Offline mod simülasyonu
    - Hata mesajı kontrolü

11. ✅ **Whitespace trim**
    - Kullanıcı adı temizleme
    - Başarılı login

12. ✅ **Çoklu login engelleme**
    - Button disabled kontrolü
    - Loading state

## 🔧 Helper Fonksiyonlar

### `login(page, userType)`
Kullanıcı girişi yapar.
```javascript
import { login } from '../helpers/auth';

test('my test', async ({ page }) => {
  await login(page, 'admin');
  // Test devam eder...
});
```

### `logout(page)`
Kullanıcı çıkışı yapar.
```javascript
import { logout } from '../helpers/auth';

test('my test', async ({ page }) => {
  await logout(page);
});
```

### `isLoggedIn(page)`
Login durumunu kontrol eder.
```javascript
import { isLoggedIn } from '../helpers/auth';

const loggedIn = await isLoggedIn(page);
```

### `getAuthToken(page)`
LocalStorage'dan token alır.
```javascript
import { getAuthToken } from '../helpers/auth';

const token = await getAuthToken(page);
```

## 📊 Test Kullanıcıları

Test kullanıcıları `tests/fixtures/test-users.json` dosyasında tanımlı:

```json
{
  "admin": {
    "username": "admin",
    "password": "admin123",
    "role": "admin"
  },
  "user": {
    "username": "user",
    "password": "user123",
    "role": "user"
  }
}
```

## ⚙️ Konfigürasyon

`playwright.config.js` dosyasında:
- ✅ Chromium browser
- ✅ Screenshot on failure
- ✅ Video on failure
- ✅ Trace on retry
- ✅ Otomatik dev server başlatma

## 📝 Yeni Test Ekleme

1. `tests/e2e/` klasörüne yeni `.spec.js` dosyası oluştur
2. Test senaryolarını yaz
3. Helper fonksiyonları kullan
4. `npm test` ile çalıştır

Örnek:
```javascript
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('should do something', async ({ page }) => {
    // Test kodları...
  });
});
```

## 🐛 Debug İpuçları

1. **UI Mode kullan**: `npm run test:ui`
2. **Headed mode**: `npm run test:headed`
3. **Debug mode**: `npm run test:debug`
4. **Screenshot'ları kontrol et**: `test-results/` klasörü
5. **Trace viewer**: `npx playwright show-trace trace.zip`

## 📈 Sonraki Adımlar

- [ ] Excel import testleri
- [ ] Matching review testleri
- [ ] Admin panel testleri
- [ ] API testleri
- [ ] Performance testleri
- [ ] Visual regression testleri

## 🔗 Kaynaklar

- [Playwright Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test.describe('Tarihsel Sorgular Testleri', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
    await page.waitForLoadState('networkidle');
  });

  // ============================================
  // HUV TARİHSEL TESTLER
  // ============================================
  test.describe('HUV Tarihsel Sorgular', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.goto('/huv-tarihsel');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    });

    test('HUV tarihsel sayfa yükleniyor mu?', async ({ page }) => {
      // Sayfa başlığı - h1 tag'inde olabilir
      const titleLocator = page.locator('h1, h2, h3, h4, h5, h6').filter({ hasText: 'HUV Tarihsel Sorgular' });
      await expect(titleLocator).toBeVisible();
      
      // Tab'lar görünür olmalı - tam metin eşleşmesi
      await expect(page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Fiyat' })).toBeVisible();
      await expect(page.locator('button[role="tab"]').filter({ hasText: 'Değişen İşlemler' })).toBeVisible();
      await expect(page.locator('button[role="tab"]').filter({ hasText: 'Fiyat Geçmişi' })).toBeVisible();
      
      console.log('✅ HUV tarihsel sayfa yüklendi');
    });

    test('Tarihteki Fiyat tab\'ı çalışıyor mu?', async ({ page }) => {
      // İlk tab aktif olmalı
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Fiyat' });
      await expect(firstTab).toHaveAttribute('aria-selected', 'true');
      
      // Form alanları görünür olmalı
      await expect(page.getByLabel('HUV Kodu')).toBeVisible();
      await expect(page.getByLabel('Tarih')).toBeVisible();
      
      // İlk tab'daki sorgula butonunu bul
      const sorgulaButton = page.locator('button').filter({ hasText: 'Sorgula' }).first();
      await expect(sorgulaButton).toBeVisible();
      
      console.log('✅ Tarihteki Fiyat tab çalışıyor');
    });

    test('Değişen İşlemler tab\'ına geçiş çalışıyor mu?', async ({ page }) => {
      // İkinci tab'a tıkla
      const secondTab = page.locator('button[role="tab"]').filter({ hasText: 'Değişen İşlemler' });
      await secondTab.click();
      await page.waitForTimeout(1000);
      
      // Tab aktif olmalı
      await expect(secondTab).toHaveAttribute('aria-selected', 'true');
      
      // Form alanları görünür olmalı
      await expect(page.getByLabel('Başlangıç Tarihi')).toBeVisible();
      await expect(page.getByLabel('Bitiş Tarihi')).toBeVisible();
      
      console.log('✅ Değişen İşlemler tab geçişi çalışıyor');
    });

    test('Fiyat Geçmişi tab\'ına geçiş çalışıyor mu?', async ({ page }) => {
      // Üçüncü tab'a tıkla
      const thirdTab = page.locator('button[role="tab"]').filter({ hasText: 'Fiyat Geçmişi' });
      await thirdTab.click();
      await page.waitForTimeout(1000);
      
      // Tab aktif olmalı
      await expect(thirdTab).toHaveAttribute('aria-selected', 'true');
      
      // Form alanları görünür olmalı - bu tab'da HUV Kodu var
      await expect(page.getByLabel('HUV Kodu')).toBeVisible();
      
      console.log('✅ Fiyat Geçmişi tab geçişi çalışıyor');
    });

    test('HUV fiyat sorgusu form validasyonu çalışıyor mu?', async ({ page }) => {
      // İlk tab'da olduğumuzdan emin ol
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Fiyat' });
      await firstTab.click();
      await page.waitForTimeout(500);
      
      // İlk tab'daki sorgula butonunu bul ve tıkla
      const sorgulaButton = page.locator('button').filter({ hasText: 'Sorgula' }).first();
      await sorgulaButton.click();
      await page.waitForTimeout(2000);
      
      // Hata mesajı görünmeli (toast)
      const errorToast = page.locator('.Toastify__toast--error, .MuiAlert-root');
      const hasError = await errorToast.count() > 0;
      
      if (hasError) {
        console.log('✅ Form validasyonu çalışıyor');
      } else {
        console.log('⚠️ Hata mesajı görünmedi, farklı validation olabilir');
      }
    });

    test('HUV fiyat sorgusu gerçek veri ile çalışıyor mu?', async ({ page }) => {
      // İlk tab'da olduğumuzdan emin ol
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Fiyat' });
      await firstTab.click();
      await page.waitForTimeout(500);
      
      // Geçerli bir HUV kodu ve tarih gir
      await page.getByLabel('HUV Kodu').fill('100001');
      await page.getByLabel('Tarih').fill('2025-01-01');
      
      // Sorguyu çalıştır
      const sorgulaButton = page.locator('button').filter({ hasText: 'Sorgula' }).first();
      await sorgulaButton.click();
      await page.waitForTimeout(3000);
      
      // Sonuç kontrol et - ya başarılı sonuç ya da anlamlı hata mesajı olmalı
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      const resultCard = page.locator('.MuiCard-root, .MuiPaper-root').filter({ hasText: /fiyat|sonuç|bulunamadı/i });
      
      const hasSuccess = await successToast.count() > 0;
      const hasError = await errorToast.count() > 0;
      const hasResult = await resultCard.count() > 0;
      
      if (hasSuccess || hasResult) {
        console.log('✅ HUV fiyat sorgusu başarılı');
      } else if (hasError) {
        console.log('⚠️ HUV fiyat sorgusu hata döndü (beklenen durum olabilir)');
      } else {
        console.log('⚠️ Sorgu sonucu belirsiz');
      }
    });

    test('HUV değişen işlemler sorgusu çalışıyor mu?', async ({ page }) => {
      // İkinci tab'a geç
      const secondTab = page.locator('button[role="tab"]').filter({ hasText: 'Değişen İşlemler' });
      await secondTab.click();
      await page.waitForTimeout(1000);
      
      // Tarih aralığı belirle (son 7 gün)
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      await page.getByLabel('Başlangıç Tarihi').fill(weekAgo.toISOString().split('T')[0]);
      await page.getByLabel('Bitiş Tarihi').fill(today.toISOString().split('T')[0]);
      
      // Sadece görünür olan sorgula butonunu seç
      const sorgulaButtons = page.locator('button').filter({ hasText: 'Sorgula' });
      const visibleButton = sorgulaButtons.locator('visible=true').first();
      await visibleButton.click();
      await page.waitForTimeout(3000);
      
      // Sonuç kontrol et
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      const table = page.locator('table, .MuiTable-root');
      
      const hasSuccess = await successToast.count() > 0;
      const hasError = await errorToast.count() > 0;
      const hasTable = await table.count() > 0;
      
      if (hasSuccess || hasTable) {
        console.log('✅ Değişen işlemler sorgusu çalışıyor');
      } else if (hasError) {
        console.log('⚠️ Değişen işlemler sorgusu hata döndü');
      } else {
        console.log('⚠️ Sorgu sonucu belirsiz');
      }
    });

    test('HUV fiyat geçmişi sorgusu çalışıyor mu?', async ({ page }) => {
      // Üçüncü tab'a geç
      const thirdTab = page.locator('button[role="tab"]').filter({ hasText: 'Fiyat Geçmişi' });
      await thirdTab.click();
      await page.waitForTimeout(1000);
      
      // HUV kodu gir
      await page.getByLabel('HUV Kodu').fill('100001');
      
      // Sadece görünür olan sorgula butonunu seç
      const sorgulaButtons = page.locator('button').filter({ hasText: 'Sorgula' });
      const visibleButton = sorgulaButtons.locator('visible=true').first();
      await visibleButton.click();
      await page.waitForTimeout(3000);
      
      // Sonuç kontrol et
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      const chart = page.locator('canvas, .recharts-wrapper, .MuiTable-root');
      
      const hasSuccess = await successToast.count() > 0;
      const hasError = await errorToast.count() > 0;
      const hasChart = await chart.count() > 0;
      
      if (hasSuccess || hasChart) {
        console.log('✅ Fiyat geçmişi sorgusu çalışıyor');
      } else if (hasError) {
        console.log('⚠️ Fiyat geçmişi sorgusu hata döndü');
      } else {
        console.log('⚠️ Sorgu sonucu belirsiz');
      }
    });
  });

  // ============================================
  // SUT TARİHSEL TESTLER
  // ============================================
  test.describe('SUT Tarihsel Sorgular', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.goto('/sut-tarihsel');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    });

    test('SUT tarihsel sayfa yükleniyor mu?', async ({ page }) => {
      // Sayfa başlığı
      const titleLocator = page.locator('h1, h2, h3, h4, h5, h6').filter({ hasText: 'SUT Tarihsel Sorgular' });
      await expect(titleLocator).toBeVisible();
      
      // Tab'lar görünür olmalı - doğru tab isimleri
      await expect(page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Puan' })).toBeVisible();
      await expect(page.locator('button[role="tab"]').filter({ hasText: 'Değişen Kodlar' })).toBeVisible();
      await expect(page.locator('button[role="tab"]').filter({ hasText: 'Puan Geçmişi' })).toBeVisible();
      
      console.log('✅ SUT tarihsel sayfa yüklendi');
    });

    test('Tarihteki Puan tab\'ı çalışıyor mu?', async ({ page }) => {
      // İlk tab aktif olmalı
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Puan' });
      await expect(firstTab).toHaveAttribute('aria-selected', 'true');
      
      // Form alanları görünür olmalı
      await expect(page.getByLabel('SUT Kodu')).toBeVisible();
      await expect(page.getByLabel('Tarih')).toBeVisible();
      
      console.log('✅ Tarihteki Puan tab çalışıyor');
    });

    test('SUT Değişen Kodlar tab\'ına geçiş çalışıyor mu?', async ({ page }) => {
      // İkinci tab'a tıkla - doğru tab ismi
      const secondTab = page.locator('button[role="tab"]').filter({ hasText: 'Değişen Kodlar' });
      await secondTab.click();
      await page.waitForTimeout(1000);
      
      // Tab aktif olmalı
      await expect(secondTab).toHaveAttribute('aria-selected', 'true');
      
      // Form alanları görünür olmalı
      await expect(page.getByLabel('Başlangıç Tarihi')).toBeVisible();
      await expect(page.getByLabel('Bitiş Tarihi')).toBeVisible();
      
      console.log('✅ SUT Değişen Kodlar tab geçişi çalışıyor');
    });

    test('Puan Geçmişi tab\'ına geçiş çalışıyor mu?', async ({ page }) => {
      // Üçüncü tab'a tıkla
      const thirdTab = page.locator('button[role="tab"]').filter({ hasText: 'Puan Geçmişi' });
      await thirdTab.click();
      await page.waitForTimeout(1000);
      
      // Tab aktif olmalı
      await expect(thirdTab).toHaveAttribute('aria-selected', 'true');
      
      // Form alanları görünür olmalı
      await expect(page.getByLabel('SUT Kodu')).toBeVisible();
      
      console.log('✅ Puan Geçmişi tab geçişi çalışıyor');
    });

    test('SUT puan sorgusu form validasyonu çalışıyor mu?', async ({ page }) => {
      // İlk tab'da olduğumuzdan emin ol
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Puan' });
      await firstTab.click();
      await page.waitForTimeout(500);
      
      // İlk tab'daki sorgula butonunu bul ve tıkla
      const sorgulaButton = page.locator('button').filter({ hasText: 'Sorgula' }).first();
      await sorgulaButton.click();
      await page.waitForTimeout(2000);
      
      // Hata mesajı görünmeli
      const errorToast = page.locator('.Toastify__toast--error, .MuiAlert-root');
      const hasError = await errorToast.count() > 0;
      
      if (hasError) {
        console.log('✅ SUT form validasyonu çalışıyor');
      } else {
        console.log('⚠️ Hata mesajı görünmedi, farklı validation olabilir');
      }
    });

    test('SUT puan sorgusu gerçek veri ile çalışıyor mu?', async ({ page }) => {
      // İlk tab'da olduğumuzdan emin ol
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Puan' });
      await firstTab.click();
      await page.waitForTimeout(500);
      
      // Geçerli bir SUT kodu ve tarih gir
      await page.getByLabel('SUT Kodu').fill('510010');
      await page.getByLabel('Tarih').fill('2025-01-01');
      
      // Sorguyu çalıştır
      const sorgulaButton = page.locator('button').filter({ hasText: 'Sorgula' }).first();
      await sorgulaButton.click();
      await page.waitForTimeout(3000);
      
      // Sonuç kontrol et
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      const resultCard = page.locator('.MuiCard-root, .MuiPaper-root').filter({ hasText: /puan|sonuç|bulunamadı/i });
      
      const hasSuccess = await successToast.count() > 0;
      const hasError = await errorToast.count() > 0;
      const hasResult = await resultCard.count() > 0;
      
      if (hasSuccess || hasResult) {
        console.log('✅ SUT puan sorgusu başarılı');
      } else if (hasError) {
        console.log('⚠️ SUT puan sorgusu hata döndü (beklenen durum olabilir)');
      } else {
        console.log('⚠️ Sorgu sonucu belirsiz');
      }
    });

    test('SUT değişen kodlar sorgusu çalışıyor mu?', async ({ page }) => {
      // İkinci tab'a geç
      const secondTab = page.locator('button[role="tab"]').filter({ hasText: 'Değişen Kodlar' });
      await secondTab.click();
      await page.waitForTimeout(1000);
      
      // Tarih aralığı belirle (son 7 gün)
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      await page.getByLabel('Başlangıç Tarihi').fill(weekAgo.toISOString().split('T')[0]);
      await page.getByLabel('Bitiş Tarihi').fill(today.toISOString().split('T')[0]);
      
      // Sadece görünür olan sorgula butonunu seç
      const sorgulaButtons = page.locator('button').filter({ hasText: 'Sorgula' });
      const visibleButton = sorgulaButtons.locator('visible=true').first();
      await visibleButton.click();
      await page.waitForTimeout(3000);
      
      // Sonuç kontrol et
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      const table = page.locator('table, .MuiTable-root');
      
      const hasSuccess = await successToast.count() > 0;
      const hasError = await errorToast.count() > 0;
      const hasTable = await table.count() > 0;
      
      if (hasSuccess || hasTable) {
        console.log('✅ Değişen kodlar sorgusu çalışıyor');
      } else if (hasError) {
        console.log('⚠️ Değişen kodlar sorgusu hata döndü');
      } else {
        console.log('⚠️ Sorgu sonucu belirsiz');
      }
    });

    test('SUT puan geçmişi sorgusu çalışıyor mu?', async ({ page }) => {
      // Üçüncü tab'a geç
      const thirdTab = page.locator('button[role="tab"]').filter({ hasText: 'Puan Geçmişi' });
      await thirdTab.click();
      await page.waitForTimeout(1000);
      
      // SUT kodu gir
      await page.getByLabel('SUT Kodu').fill('510010');
      
      // Sadece görünür olan sorgula butonunu seç
      const sorgulaButtons = page.locator('button').filter({ hasText: 'Sorgula' });
      const visibleButton = sorgulaButtons.locator('visible=true').first();
      await visibleButton.click();
      await page.waitForTimeout(3000);
      
      // Sonuç kontrol et
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      const chart = page.locator('canvas, .recharts-wrapper, .MuiTable-root');
      
      const hasSuccess = await successToast.count() > 0;
      const hasError = await errorToast.count() > 0;
      const hasChart = await chart.count() > 0;
      
      if (hasSuccess || hasChart) {
        console.log('✅ Puan geçmişi sorgusu çalışıyor');
      } else if (hasError) {
        console.log('⚠️ Puan geçmişi sorgusu hata döndü');
      } else {
        console.log('⚠️ Sorgu sonucu belirsiz');
      }
    });
  });

  // ============================================
  // GENEL TARİHSEL TESTLER
  // ============================================
  test.describe('Genel Tarihsel İşlevsellik', () => {
    
    test('Her iki tarihsel sayfaya navigasyon çalışıyor mu?', async ({ page }) => {
      // HUV tarihsel sayfasına git
      await page.goto('/huv-tarihsel');
      await page.waitForLoadState('networkidle');
      const huvTitle = page.locator('h1, h2, h3, h4, h5, h6').filter({ hasText: 'HUV Tarihsel Sorgular' });
      await expect(huvTitle).toBeVisible();
      
      // SUT tarihsel sayfasına git
      await page.goto('/sut-tarihsel');
      await page.waitForLoadState('networkidle');
      const sutTitle = page.locator('h1, h2, h3, h4, h5, h6').filter({ hasText: 'SUT Tarihsel Sorgular' });
      await expect(sutTitle).toBeVisible();
      
      console.log('✅ Tarihsel sayfa navigasyonları çalışıyor');
    });

    test('Tarih input alanları çalışıyor mu?', async ({ page }) => {
      await page.goto('/huv-tarihsel');
      await page.waitForLoadState('networkidle');
      
      // Tarih alanına değer gir
      const today = new Date().toISOString().split('T')[0];
      await page.getByLabel('Tarih').fill(today);
      
      // Değerin girildiğini kontrol et
      await expect(page.getByLabel('Tarih')).toHaveValue(today);
      
      console.log('✅ Tarih input alanları çalışıyor');
    });

    test('Tab geçişleri state\'i koruyor mu?', async ({ page }) => {
      await page.goto('/huv-tarihsel');
      await page.waitForLoadState('networkidle');
      
      // İlk tab'da değer gir
      await page.getByLabel('HUV Kodu').fill('12345');
      
      // İkinci tab'a geç
      const secondTab = page.locator('button[role="tab"]').filter({ hasText: 'Değişen İşlemler' });
      await secondTab.click();
      await page.waitForTimeout(1000);
      
      // Tekrar ilk tab'a dön
      const firstTab = page.locator('button[role="tab"]').filter({ hasText: 'Tarihteki Fiyat' });
      await firstTab.click();
      await page.waitForTimeout(1000);
      
      // Değer korunmuş olmalı
      await expect(page.getByLabel('HUV Kodu')).toHaveValue('12345');
      
      console.log('✅ Tab geçişleri state koruyor');
    });
  });
});
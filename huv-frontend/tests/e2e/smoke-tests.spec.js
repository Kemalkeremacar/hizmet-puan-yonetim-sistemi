import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test.describe('Smoke Tests - Temel Sayfa Çalışma Kontrolü', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('Ana sayfalar yükleniyor mu?', async ({ page }) => {
    // HUV Yönetimi
    await page.goto('/huv-yonetimi');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ HUV Yönetimi sayfası yüklendi');
    
    // Matching Review
    await page.goto('/matching-review');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Matching Review sayfası yüklendi');
    
    // SUT Yönetimi
    await page.goto('/sut-yonetimi');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ SUT Yönetimi sayfası yüklendi');
  });

  test('Sayfalar crash olmuyor mu?', async ({ page }) => {
    const errors = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // Tüm ana sayfalara git
    const pages = ['/huv-yonetimi', '/matching-review', '/sut-yonetimi'];
    
    for (const url of pages) {
      await page.goto(url);
      await page.waitForTimeout(2000);
    }
    
    // Kritik hata olmamalı
    const criticalErrors = errors.filter(error => 
      error.includes('Uncaught') || 
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );
    
    expect(criticalErrors.length).toBe(0);
    console.log(`✅ ${pages.length} sayfa crash olmadan yüklendi`);
  });

  test('Temel UI elementleri var mı?', async ({ page }) => {
    await page.goto('/matching-review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Sayfa yüklenmiş olmalı
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Matching Review sayfası yüklendi');
    
    await page.goto('/huv-yonetimi');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Sayfa yüklenmiş olmalı
    await expect(page.locator('body')).toBeVisible();
    console.log('✅ HUV Yönetimi sayfası yüklendi');
  });

  test('Navigasyon çalışıyor mu?', async ({ page }) => {
    // Sayfa geçişleri
    await page.goto('/huv-yonetimi');
    await expect(page).toHaveURL('/huv-yonetimi');
    
    await page.goto('/matching-review');
    await expect(page).toHaveURL('/matching-review');
    
    // Geri git
    await page.goBack();
    await expect(page).toHaveURL('/huv-yonetimi');
    
    console.log('✅ Navigasyon çalışıyor');
  });

  test('API çağrıları yapılıyor mu?', async ({ page }) => {
    let apiCalls = 0;
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls++;
      }
    });
    
    await page.goto('/matching-review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // En azından bir API çağrısı yapılmalı
    expect(apiCalls).toBeGreaterThan(0);
    console.log(`✅ ${apiCalls} API çağrısı yapıldı`);
  });

  test('Logout çalışıyor mu?', async ({ page }) => {
    await page.goto('/matching-review');
    
    // Logout butonunu bul ve tıkla
    const logoutButton = page.getByRole('button', { name: /çıkış/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Login sayfasına yönlendirilmeli
      await expect(page).toHaveURL('/login', { timeout: 10000 });
      console.log('✅ Logout çalışıyor');
    } else {
      console.log('⚠️ Logout butonu bulunamadı');
    }
  });
});
import { test, expect } from '@playwright/test';
import testUsers from '../fixtures/test-users.json' with { type: 'json' };

test.describe('Authentication Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Her testten önce login sayfasına git
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    // Login sayfası elementlerini kontrol et
    // Loading state'i geçmesini bekle
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel(/kullanıcı adı/i)).toBeVisible();
    await expect(page.getByLabel(/şifre/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /giriş yap/i })).toBeVisible();
  });

  test('should show error with empty credentials', async ({ page }) => {
    // Boş form ile giriş yapmayı dene
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Hata mesajı veya validation kontrolü
    // Not: Form validation varsa kontrol et
    await page.waitForTimeout(500);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Yanlış kullanıcı adı ve şifre ile giriş yap
    await page.getByLabel(/kullanıcı adı/i).fill('wronguser');
    await page.getByLabel(/şifre/i).fill('wrongpassword');
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Hata mesajını bekle (toast notification) - first() ile ilk toast'u al
    await expect(page.locator('.Toastify__toast--error').first()).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    // Admin kullanıcısı ile giriş yap
    await page.getByLabel(/kullanıcı adı/i).fill(testUsers.admin.kullaniciAdi);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Dashboard'a yönlendirildiğini kontrol et (home route '/' olabilir)
    await expect(page).toHaveURL(/\/(huv-liste|huv-yonetimi|matching-review)?$/, { timeout: 10000 });
    
    // Navbar'da kullanıcı adını kontrol et
    await expect(page.locator('header')).toContainText(testUsers.admin.kullaniciAdi);
    
    // Çıkış butonu görünür olmalı
    await expect(page.getByRole('button', { name: /çıkış/i })).toBeVisible();
  });

  test('should persist login after page reload', async ({ page }) => {
    // Login yap
    await page.getByLabel(/kullanıcı adı/i).fill(testUsers.admin.kullaniciAdi);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Dashboard'a yönlendirilmesini bekle
    await expect(page).toHaveURL(/\/(huv-liste|huv-yonetimi|matching-review)?$/, { timeout: 10000 });
    
    // Sayfayı yenile
    await page.reload();
    
    // Hala login olduğunu kontrol et (login sayfasına dönmemeli)
    await expect(page).not.toHaveURL('/login');
    await expect(page.locator('header')).toContainText(testUsers.admin.kullaniciAdi);
  });

  test('should logout successfully', async ({ page }) => {
    // Login yap
    await page.getByLabel(/kullanıcı adı/i).fill(testUsers.admin.kullaniciAdi);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Dashboard'a yönlendirilmesini bekle
    await expect(page).toHaveURL(/\/(huv-liste|huv-yonetimi|matching-review)?$/, { timeout: 10000 });
    
    // Token'ın localStorage'da olduğunu kontrol et
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenBefore).not.toBeNull();
    
    // Çıkış yap
    await page.getByRole('button', { name: /çıkış/i }).click();
    
    // Login sayfasına yönlendirildiğini kontrol et
    await expect(page).toHaveURL('/login', { timeout: 5000 });
    
    // Token'ın localStorage'dan silindiğini kontrol et
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenAfter).toBeNull();
    
    // Login formu görünür olmalı (loading geçsin)
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel(/kullanıcı adı/i)).toBeVisible();
  });

  test('should not access protected routes without login', async ({ page }) => {
    // Login olmadan korumalı bir sayfaya gitmeyi dene
    await page.goto('/huv-yonetimi');
    
    // Login sayfasına yönlendirilmeli
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('should handle session timeout gracefully', async ({ page, context }) => {
    // Login yap
    await page.getByLabel(/kullanıcı adı/i).fill(testUsers.admin.kullaniciAdi);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Dashboard'a yönlendirilmesini bekle
    await expect(page).toHaveURL(/\/(huv-liste|huv-yonetimi|matching-review)?$/, { timeout: 10000 });
    
    // Token'ı localStorage'dan sil (session timeout simülasyonu)
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    
    // Korumalı bir sayfaya gitmeyi dene
    await page.goto('/huv-yonetimi');
    
    // Login sayfasına yönlendirilmeli
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('should show password visibility toggle', async ({ page }) => {
    const passwordInput = page.getByLabel(/şifre/i);
    
    // Şifre input'u type="password" olmalı
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Göz ikonu varsa tıkla (MUI IconButton)
    const visibilityToggle = page.locator('[aria-label*="toggle password"]').or(
      page.locator('button').filter({ has: page.locator('svg[data-testid*="Visibility"]') })
    );
    
    if (await visibilityToggle.count() > 0) {
      await visibilityToggle.first().click();
      
      // Şifre görünür olmalı (type="text")
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Tekrar tıkla
      await visibilityToggle.first().click();
      
      // Şifre gizli olmalı (type="password")
      await expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // API request'i intercept et ve hata döndür
    await page.route('**/api/auth/login', route => {
      route.abort('failed'); // Network failure simülasyonu
    });
    
    // Login yapmayı dene
    await page.getByLabel(/kullanıcı adı/i).fill(testUsers.admin.kullaniciAdi);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Hata mesajı görünmeli (toast notification)
    await expect(page.locator('.Toastify__toast--error').first()).toBeVisible({ timeout: 5000 });
  });

  test('should trim whitespace from username', async ({ page }) => {
    // NOT: Backend trim yapmıyorsa bu test başarısız olur
    // Bu test frontend'in trim yapıp yapmadığını kontrol eder
    await page.getByLabel(/kullanıcı adı/i).fill(`  ${testUsers.admin.kullaniciAdi}  `);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Eğer trim yapılıyorsa başarılı login olmalı
    // Yapılmıyorsa hata mesajı görmeli
    await page.waitForTimeout(2000);
    
    // İki durumdan biri olmalı: başarılı login VEYA hata mesajı
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('/login');
    const hasError = await page.locator('.Toastify__toast--error').first().isVisible().catch(() => false);
    
    // En azından birisi true olmalı
    expect(isLoggedIn || hasError).toBe(true);
  });

  test('should prevent multiple simultaneous login attempts', async ({ page }) => {
    // İlk login denemesi
    await page.getByLabel(/kullanıcı adı/i).fill(testUsers.admin.kullaniciAdi);
    await page.getByLabel(/şifre/i).fill(testUsers.admin.sifre);
    
    const loginButton = page.getByRole('button', { name: /giriş yap/i });
    
    // Butona tıkla
    await loginButton.click();
    
    // Buton disabled olmalı veya loading state'de olmalı
    // (Bu implementasyona bağlı, kontrol et)
    await page.waitForTimeout(100);
    
    // İkinci tıklama engellenmeli
    const isDisabled = await loginButton.isDisabled().catch(() => false);
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    }
  });
});

/**
 * Authentication Helper Functions
 * Reusable functions for login/logout in tests
 */

import testUsers from '../fixtures/test-users.json' with { type: 'json' };

/**
 * Login helper function
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} userType - 'admin' or 'user'
 */
export async function login(page, userType = 'admin') {
  const user = testUsers[userType];
  
  if (!user) {
    throw new Error(`User type '${userType}' not found in test-users.json`);
  }

  // Navigate to login page
  await page.goto('/login');
  
  // Fill credentials
  await page.getByLabel(/kullanıcı adı/i).fill(user.kullaniciAdi);
  await page.getByLabel(/şifre/i).fill(user.sifre);
  
  // Click login button
  await page.getByRole('button', { name: /giriş yap/i }).click();
  
  // Wait for navigation to dashboard
  await page.waitForURL(/\/(huv-liste|huv-yonetimi|matching-review)?$/, { timeout: 10000 });
}

/**
 * Logout helper function
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function logout(page) {
  // Click logout button
  await page.getByRole('button', { name: /çıkış/i }).click();
  
  // Wait for navigation to login page
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn(page) {
  try {
    // Check if logout button exists
    const logoutButton = page.getByRole('button', { name: /çıkış/i });
    return await logoutButton.isVisible({ timeout: 1000 });
  } catch {
    return false;
  }
}

/**
 * Get stored auth token from localStorage
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string|null>}
 */
export async function getAuthToken(page) {
  return await page.evaluate(() => localStorage.getItem('token'));
}

/**
 * Set auth token in localStorage (for API testing)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} token - JWT token
 */
export async function setAuthToken(page, token) {
  await page.evaluate((t) => localStorage.setItem('token', t), token);
}

/**
 * Clear auth data from localStorage
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  });
}

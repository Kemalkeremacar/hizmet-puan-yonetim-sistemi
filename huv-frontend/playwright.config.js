import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  
  // Maximum time one test can run - daha da artırdık
  timeout: 90 * 1000, // 90 saniye
  
  // Test execution settings
  fullyParallel: false, // Testleri sırayla çalıştır
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Retry ekledik
  workers: 1, // Tek worker kullan (tek browser)
  
  // Reporter to use
  reporter: [
    ['./tests/turkish-reporter.js'], // Türkçe reporter
    ['html'] // HTML rapor
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:5173',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Slow down actions for debugging (when --headed is used)
    launchOptions: {
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
    
    // Timeout'ları daha da artırdık
    actionTimeout: 20 * 1000, // 20 saniye
    navigationTimeout: 45 * 1000, // 45 saniye
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

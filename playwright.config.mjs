import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', workers: 1, timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'qa/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5174', headless: true,
    launchOptions: process.env.CHEESE_TEST_BROWSER ? { executablePath: process.env.CHEESE_TEST_BROWSER } : {},
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});

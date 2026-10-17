import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/dashboard',
  outputDir: '.next/dashboard-test-results',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3106', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3106',
    url: 'http://127.0.0.1:3106/dashboard/preview',
    reuseExistingServer: true,
    // Publicly fake values satisfy SDK construction; no sign-in or bank calls run.
    env: {
      AUTH0_DOMAIN: 'dashboard-preview.invalid',
      AUTH0_CLIENT_ID: 'synthetic-gallery-client',
      AUTH0_CLIENT_SECRET: 'synthetic-gallery-only',
      AUTH0_SECRET: '0'.repeat(64),
      APP_BASE_URL: 'http://127.0.0.1:3106',
    },
    timeout: 120_000,
  },
});

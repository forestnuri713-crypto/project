import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3088',
  },
  projects: [{ name: 'chromium', use: { channel: 'chromium' } }],
  webServer: [
    {
      command: 'npx tsx e2e/mock-api.ts',
      port: 3099,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx next start -p 3088',
      port: 3088,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:3099',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3088',
      },
    },
  ],
});

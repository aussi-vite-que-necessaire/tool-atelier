import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// .env.test (committé) force DATABASE_URL sur cast_test : les E2E locaux
// ne touchent pas la base de dev. En CI, DATABASE_URL est déjà posé par le job test.
loadEnv();
loadEnv({ path: '.env.test', override: true });

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './test/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    timeout: 60_000,
    reuseExistingServer: false,
    env: {
      E2E_TESTING: 'true',
      RESEND_API_KEY: '',
      CONTENT_OS_LINKEDIN_STUB: '1',
      CONTENT_OS_MEDIA_STUB: 'fs',
      DATABASE_URL: process.env.DATABASE_URL!,
    },
  },
});

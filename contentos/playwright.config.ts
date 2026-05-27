import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// .env.test (committé) force DATABASE_URL sur contentos_test : les E2E locaux
// ne touchent pas la base de dev. En CI, DATABASE_URL est déjà posé.
loadEnv();
loadEnv({ path: '.env.test', override: true });

// Mode serveur externe : si E2E_BASE_URL est défini (CI contre un conteneur de
// l'image déjà construite), Playwright ne lance pas son propre serveur.
const externalBase = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './test/e2e/global-setup.ts',
  use: {
    baseURL: externalBase ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  ...(externalBase
    ? {}
    : {
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
      }),
});

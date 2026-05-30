import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Charge .env une seule fois dans le process parent. Les vars d'env sont
// ensuite propagées à tous les workers de projets (unit/integration/worker).
// .env.test (committé) force DATABASE_URL sur cast_test : les tests ne
// touchent jamais la base de dev.
loadEnv();
loadEnv({ path: '.env.test', override: true });

const alias = { '@': path.resolve(__dirname, './src') };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          testTimeout: 10_000,
          sequence: { groupOrder: 0 },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./test/setup-integration.ts'],
          pool: 'forks',
          maxWorkers: 1,
          isolate: false,
          testTimeout: 10_000,
          sequence: { groupOrder: 1 },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'worker',
          include: ['test/worker/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./test/setup-integration.ts'],
          pool: 'forks',
          maxWorkers: 1,
          isolate: false,
          testTimeout: 10_000,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});

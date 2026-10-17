// Integration tests: real Tiger Data database, fake Nessie. `npm run test:db`.
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { alias } from './vitest.config.mjs';

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['**/*.int.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    // Loads .env.local, which holds DATABASE_URL.
    env: loadEnv('test', process.cwd(), ''),
    // The files share one database and clean up shared rows (fake Nessie
    // merchants), so they run one at a time rather than racing each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

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
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

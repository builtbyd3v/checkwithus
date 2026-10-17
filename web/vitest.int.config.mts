// Integration tests: real Tiger Data database, fake Nessie. `npm run test:db`.
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { alias } from './vitest.config.mjs';

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['**/*.int.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    // .env.local holds DATABASE_URL. CODE_HASH_KEY gets a test-only default
    // so the suite does not depend on that secret being configured.
    env: {
      CODE_HASH_KEY: 'test-only-code-hash-key-not-a-real-secret',
      ...loadEnv('test', process.cwd(), ''),
    },
    // The files share one database and clean up shared rows (fake Nessie
    // merchants), so they run one at a time rather than racing each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

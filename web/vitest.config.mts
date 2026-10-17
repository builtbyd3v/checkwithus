// Unit tests: no network, no database. `npm test`.
// Integration tests (*.int.test.ts) have their own config: vitest.int.config.mts.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export const alias = {
  '@': fileURLToPath(new URL('.', import.meta.url)),
  // `server-only` throws outside a React Server Components build by design.
  // Tests run server code directly in Node, which is exactly where it belongs.
  'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '**/*.int.test.ts'],
  },
});

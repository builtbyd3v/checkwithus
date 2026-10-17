import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      // `server-only` throws outside a React Server Components build by design.
      // Tests run server code directly in Node, which is exactly where it belongs.
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});

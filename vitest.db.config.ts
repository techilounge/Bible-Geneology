import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Integration tests that need a real Postgres. Kept separate from the unit run
 * so `npm run test` stays fast and dependency-free; CI runs both.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    // Shared fixtures and role switching make these order-dependent within a
    // file and unsafe to interleave across files.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});

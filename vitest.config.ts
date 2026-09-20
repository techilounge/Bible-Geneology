import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/db/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**'],
      // The Supabase clients are I/O wrappers exercised by the database
      // suite under vitest.db.config.ts against a real Postgres, where a
      // unit test would only assert that a mock was called.
      exclude: ['lib/supabase/**', 'lib/**/index.ts', 'lib/**/__tests__/**'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 85,
        statements: 90,

        // The chronology engine and the relationship graph decide what the
        // product asserts about Scripture, so every branch in them is
        // tested. Requirement section 18 and docs/TESTING_STRATEGY.md
        // section 2. The handful of guards that strict indexing forces but
        // no input can reach carry a `v8 ignore` comment saying why.
        'lib/chronology/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
        'lib/graph/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});

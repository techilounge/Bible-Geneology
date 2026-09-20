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

        // The discovery generators write the sentences the product shows
        // as findings, and the Phase 11 gate is that every one of them is
        // reproducible from canonical data. An untested branch here is a
        // claim nobody has read.
        'lib/discovery/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },

        // The quiz engine decides whether an answer is right, and the
        // progress rules decide what a player has earned. Both are held
        // to the engine standard for the same reason: an untested branch
        // is a wrong answer nobody has read.
        'lib/quiz/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
        'lib/progress/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
        'lib/learning/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
        'lib/admin/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
        'lib/account/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 99,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // `server-only` throws unless the bundler is resolving under the
      // react-server condition, which Vitest is not. The guard that matters
      // is Next's, at build time, where a client import of a server module
      // actually fails the build; here it would only stop the module being
      // testable at all.
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url),
      ),
    },
  },
});

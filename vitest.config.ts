import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**'],
      thresholds: {
        // Raised to 100% for lib/chronology and lib/graph in Phase 3,
        // once those directories contain code. See docs/TESTING_STRATEGY.md section 2.
        lines: 70,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});

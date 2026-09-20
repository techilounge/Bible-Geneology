import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Component tests run in their own config because they need jsdom and the
 * React plugin, and the engine suite must keep running in plain node. A
 * chronology test that needs a DOM would be a chronology test that has
 * quietly grown a dependency on one.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'ui',
    environment: 'jsdom',
    globals: true,
    include: ['components/**/*.test.tsx'],
    setupFiles: ['tests/ui/setup.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});

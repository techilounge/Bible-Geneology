import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from '@next/eslint-plugin-next';

/**
 * Layering is enforced here, not only in code review.
 * See docs/ARCHITECTURE.md section 2 for the dependency direction.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'data/generated/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { '@next/next': next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },

  // The domain layer is framework-independent. Requirement section 18:
  // the chronology engine must contain no UI code and no I/O.
  {
    files: [
      'lib/chronology/**',
      'lib/graph/**',
      'lib/discovery/**',
      'lib/quiz/**',
      'lib/learning/**',
      'lib/progress/**',
      'lib/domain/**',
      'lib/account/**',
      'lib/admin/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'next',
                'next/*',
                '@supabase/*',
                '@/app/*',
                '@/components/*',
                '@/lib/services/*',
                '@/lib/supabase/*',
              ],
              message:
                'The domain layer must stay free of UI and I/O. See docs/ARCHITECTURE.md section 2.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'The domain layer performs no I/O.' },
        { name: 'window', message: 'The domain layer is framework-independent.' },
        { name: 'document', message: 'The domain layer is framework-independent.' },
      ],
    },
  },

  // The service worker runs in a worker, not a page or a Node process, so
  // it has its own globals and is plain JavaScript rather than a module.
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        console: 'readonly',
      },
    },
  },

  // The presentation layer may not reach past services into the database.
  {
    files: ['app/**', 'components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/supabase/admin'],
              message:
                'The service-role client is server-only and never imported from a route or component. See docs/SECURITY.md section 3.',
            },
          ],
        },
      ],
    },
  },
);

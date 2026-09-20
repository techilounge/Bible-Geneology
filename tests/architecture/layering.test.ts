import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The reliability hierarchy, asserted rather than trusted.
 *
 * Requirement section 18: the chronology engine contains no UI code and no
 * I/O. ESLint enforces this too, through the `no-restricted-imports` zones in
 * eslint.config.mjs, but a lint rule is one config edit away from being
 * switched off and this is the property the whole layering rests on. A test
 * fails loudly and in CI.
 */
const ENGINE = ['lib/chronology', 'lib/graph', 'lib/domain'];

const FORBIDDEN_IMPORTS = [
  /from\s+['"]react['"]/,
  /from\s+['"]react-dom['"]/,
  /from\s+['"]next(\/[^'"]*)?['"]/,
  /from\s+['"]@supabase\//,
  /from\s+['"]@\/app\//,
  /from\s+['"]@\/components\//,
  /from\s+['"]@\/lib\/services\//,
  /from\s+['"]@\/lib\/supabase\//,
  /from\s+['"]node:(fs|http|https|net|child_process)['"]/,
];

const FORBIDDEN_GLOBALS = [/\bwindow\./, /\bdocument\./, /\bfetch\(/, /\bprocess\.env\b/];

function engineSources(): Array<[string, string]> {
  return ENGINE.flatMap((dir) =>
    globSync(join(dir, '**/*.ts'))
      .filter((path) => !path.includes('__tests__'))
      .map((path) => [path, readFileSync(path, 'utf8')] as [string, string]),
  );
}

describe('the engine has no UI and no I/O', () => {
  const sources = engineSources();

  it('finds the engine sources to check', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN_IMPORTS.map((p) => [p.source, p] as const))(
    'imports nothing matching %s',
    (_label, pattern) => {
      const offenders = sources
        .filter(([, text]) => pattern.test(text))
        .map(([path]) => path);
      expect(offenders).toEqual([]);
    },
  );

  it.each(FORBIDDEN_GLOBALS.map((p) => [p.source, p] as const))(
    'references no browser or process global matching %s',
    (_label, pattern) => {
      const offenders = sources
        .filter(([, text]) => pattern.test(text))
        .map(([path]) => path);
      expect(offenders).toEqual([]);
    },
  );
});

describe('the presentation layer cannot reach the service-role client', () => {
  it('no route or component imports lib/supabase/admin', () => {
    const offenders = ['app', 'components']
      .flatMap((dir) => globSync(join(dir, '**/*.{ts,tsx}')))
      .filter((path) =>
        /from\s+['"]@\/lib\/supabase\/admin['"]/.test(readFileSync(path, 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});

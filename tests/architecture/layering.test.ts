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
const ENGINE = [
  'lib/chronology',
  'lib/graph',
  'lib/discovery',
  'lib/quiz',
  'lib/learning',
  'lib/progress',
  'lib/domain',
];

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

describe('the verification tooling stays out of the application', () => {
  /**
   * lib/verification reads two Bible translations out of node_modules.
   * They are devDependencies, so a page that imported it would build
   * locally and fail wherever production dependencies alone are installed
   * — and would ship several megabytes of verse text to do it.
   */
  it('no route or component imports lib/verification', () => {
    const offenders = ['app', 'components']
      .flatMap((dir) => globSync(join(dir, '**/*.{ts,tsx}')))
      .filter((path) =>
        /from\s+['"]@\/lib\/verification/.test(readFileSync(path, 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});

/**
 * The Phase 8 gate: no arithmetic on year values exists in the route's
 * components.
 *
 * The reason is the reliability hierarchy in requirement section 18. A
 * component that subtracts one year from another has become a second,
 * untested chronology engine, and the day it disagrees with the first one
 * the product is quietly lying. Every number on these pages comes out of
 * `lib/chronology`, which is tested to 100% of its branches.
 *
 * Comments are stripped before scanning, because a comment explaining that
 * a value is birth plus lifespan is documentation, not a calculation.
 */
const TIME_SURFACES = [
  'app/compare',
  'app/timeline',
  'app/who-was-alive',
  'components/compare',
  'components/timeline',
  'components/year',
];

const YEAR_ARITHMETIC = [
  /\b\w*[Yy]ears?\b\s*[-+]\s*/,
  /[-+]\s*\b\w*[Yy]ears?\b/,
  /\bages?\b\s*[-+]\s*/,
  /[-+]\s*\bages?\b/,
];

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('no route or component does chronology arithmetic', () => {
  const sources = TIME_SURFACES.flatMap((dir) =>
    globSync(join(dir, '**/*.tsx'))
      .filter((path) => !path.endsWith('.test.tsx'))
      .map((path) => [path, withoutComments(readFileSync(path, 'utf8'))] as const),
  );

  it('finds the time-drawing surfaces to check', () => {
    expect(sources.length).toBeGreaterThanOrEqual(5);
  });

  it.each(YEAR_ARITHMETIC.map((p) => [p.source, p] as const))(
    'contains nothing matching %s',
    (_label, pattern) => {
      const offenders = sources
        .filter(([, text]) => pattern.test(text))
        .map(([path, text]) => `${path}: ${pattern.exec(text)?.[0] ?? ''}`);
      expect(offenders).toEqual([]);
    },
  );
});

/**
 * The Phase 10 gate: no relationship literal exists in any visualisation
 * component.
 *
 * Two ways a picture can start asserting things the dataset does not hold.
 * It can name a person — a hard-coded root, a special case for Adam — and
 * then the picture is data. Or it can name a relationship type, compare
 * against it, and decide for itself what descent means; then it is a
 * second reading of the data model, and the day it disagrees with
 * `lib/graph` the drawing is lying.
 *
 * Neither is possible if the component never sees a relationship record.
 * `buildFamilyTree` and `buildTreeOutline` hand over nodes, edges and an
 * already-nested outline, each edge carrying `isDescent`, so the drawing
 * has nothing left to decide.
 */
const RELATIONSHIP_TYPES = [
  'parent',
  'child',
  'spouse',
  'sibling',
  'ancestor',
  'descendant',
];

function componentSources(): Array<[string, string]> {
  return globSync(join('components', '**/*.tsx'))
    .filter((path) => !path.endsWith('.test.tsx'))
    .map((path) => [path, readFileSync(path, 'utf8')] as [string, string]);
}

describe('no visualisation component holds a relationship of its own', () => {
  const sources = componentSources();

  it('finds the components to check', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(RELATIONSHIP_TYPES)('contains no %s literal', (type) => {
    const pattern = new RegExp(`['"\`]${type}['"\`]`);
    const offenders = sources
      .filter(([, text]) => pattern.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('never compares a relationship type', () => {
    const offenders = sources
      .filter(([, text]) => /relationshipType\s*[=!]==?/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('names nobody from the dataset', () => {
    // A component that mentions a person by id has become data, and the
    // next person added to the dataset will not get whatever it does.
    const people = JSON.parse(
      readFileSync(join('data', 'canonical', 'people.json'), 'utf8'),
    ) as Array<{ id: string }>;

    const offenders: string[] = [];
    for (const [path, text] of sources) {
      for (const person of people) {
        if (new RegExp(`['"\`]${person.id}['"\`]`).test(text)) {
          offenders.push(`${path}: ${person.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

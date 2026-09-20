import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VerseLookup } from './check';

/**
 * Verification-time loading.
 *
 * This reads the two public-domain translations out of node_modules and the
 * canonical dataset off disk. It is tooling, not application code: nothing
 * under app/ or components/ imports it, which the architecture suite
 * asserts, and neither translation is a runtime dependency. Keeping it in
 * lib rather than in the script means the browser-free parts can be tested
 * and that the script and the golden test run exactly the same check.
 */
export const PRIMARY_SOURCE = 'web-bible';
export const CORROBORATING_SOURCE = 'kjv-1769';

/** OSIS-style book codes to where each source keeps that book. */
const BOOKS: Record<string, { web: string; kjv: number }> = {
  GEN: { web: 'genesis', kjv: 1 },
  ACT: { web: 'acts', kjv: 44 },
};

interface WebEntry {
  chapterNumber?: number;
  verseNumber?: number;
  value?: string;
}

export interface Reference {
  id: string;
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
}

/**
 * A number the dataset states, and where it says the number comes from.
 *
 * `statedInText` is the dataset's own claim about the figure, not a
 * finding: true means the dataset says Scripture gives this number, and
 * that is the claim the check tests. A derived or interpretive figure says
 * false and is never promoted on the strength of a text match.
 */
export interface Claim {
  subject: string;
  ownerId: string;
  value: number;
  references: string[];
  statedInText: boolean;
}

const cache = new Map<string, unknown>();

function readJson<T>(path: string): T {
  const cached = cache.get(path);
  if (cached !== undefined) return cached as T;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  cache.set(path, parsed);
  return parsed as T;
}

function canonical<T>(name: string): T {
  return readJson<T>(join(process.cwd(), 'data', 'canonical', name));
}

function webBook(name: string): WebEntry[] {
  return readJson<WebEntry[]>(
    join(process.cwd(), 'node_modules', 'world-english-bible', 'json', `${name}.json`),
  );
}

function kjvChapter(book: number, chapter: number): string[] {
  return readJson<string[]>(
    join(
      process.cwd(),
      'node_modules',
      'bible-kjv',
      'dist',
      'resources',
      String(book),
      `${chapter}.json`,
    ),
  );
}

/** True when both translations are installed and can be read. */
export function sourcesAvailable(): boolean {
  try {
    webBook('genesis');
    kjvChapter(1, 1);
    return true;
  } catch {
    return false;
  }
}

export function buildVerseTable(references: readonly Reference[]): Map<string, string> {
  const table = new Map<string, string>();

  for (const reference of references) {
    const where = BOOKS[reference.book];
    /* v8 ignore next -- @preserve: the dataset cites Genesis and Acts only. */
    if (!where) continue;
    const first = reference.verseStart ?? 1;
    const last = reference.verseEnd ?? first;

    const web = webBook(where.web)
      .filter(
        (entry) =>
          entry.chapterNumber === reference.chapter &&
          entry.verseNumber !== undefined &&
          entry.verseNumber >= first &&
          entry.verseNumber <= last &&
          typeof entry.value === 'string',
      )
      .map((entry) => entry.value)
      .join(' ')
      .trim();
    if (web.length > 0) table.set(`${PRIMARY_SOURCE}|${reference.id}`, web);

    const kjv = kjvChapter(where.kjv, reference.chapter)
      .slice(first - 1, last)
      .join(' ')
      .trim();
    if (kjv.length > 0) table.set(`${CORROBORATING_SOURCE}|${reference.id}`, kjv);
  }

  return table;
}

export function verseLookup(): VerseLookup {
  const table = buildVerseTable(canonical<Reference[]>('scripture-references.json'));
  return (sourceId, referenceId) => table.get(`${sourceId}|${referenceId}`) ?? null;
}

function walk(node: unknown, path: string, ownerId: string, into: Claim[]): void {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => walk(entry, `${path}[${index}]`, ownerId, into));
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const record = node as Record<string, unknown>;

  const single = typeof record.reference === 'string' ? [record.reference] : [];
  const many = Array.isArray(record.sourceReferences)
    ? (record.sourceReferences as string[])
    : [];
  const references = [...new Set([...single, ...many])];

  if (typeof record.value === 'number' && references.length > 0) {
    into.push({
      subject: `${ownerId}.${path || 'record'}`,
      ownerId,
      value: record.value,
      references,
      statedInText: record.confidence === 'EXPLICIT',
    });
  }

  for (const [key, child] of Object.entries(record)) {
    walk(child, path ? `${path}.${key}` : key, ownerId, into);
  }
}

/**
 * Every figure in the canonical dataset that carries a number and a
 * reference: the person chronology, the alternate chronology's overrides,
 * and the dated events.
 */
export function collectClaims(): Claim[] {
  const claims: Claim[] = [];

  for (const row of canonical<Record<string, unknown>[]>(
    'person-chronology.masoretic.json',
  )) {
    walk(row, '', String(row.personId), claims);
  }

  const overrides = canonical<{ records: Record<string, unknown>[] }>(
    'chronology-overrides.masoretic-gen11-26.json',
  );
  for (const row of overrides.records) {
    walk(row, '', String(row.personId), claims);
  }

  // Event chronology states its figures flat, and says in `rule` whether
  // the number is one the text gives. A `person-age` event is an age
  // Scripture states for someone; an `epoch` is a choice this project made
  // and an `unknown` states nothing, so neither is a claim about the text.
  const events = canonical<
    { eventId: string; rule: string; value: number | null; reference?: string }[]
  >('event-chronology.masoretic.json');
  for (const row of events) {
    if (typeof row.value !== 'number' || typeof row.reference !== 'string') continue;
    claims.push({
      subject: `${row.eventId}.value`,
      ownerId: row.eventId,
      value: row.value,
      references: [row.reference],
      statedInText: row.rule === 'person-age',
    });
  }

  return claims;
}

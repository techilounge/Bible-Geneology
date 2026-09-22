import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALTERNATE_CHRONOLOGY_ID,
  DEFAULT_CHRONOLOGY_ID,
} from '@/lib/config/chronology-defaults';
import {
  DerivationSchema,
  type EventChronology,
  type PersonChronology,
} from '@/lib/domain';
import { loadDerivedRecords } from './load';

/**
 * The provenance assertions from docs/TESTING_STRATEGY.md section 3, run over
 * the whole dataset rather than per pair.
 *
 * These are the structural expression of "AI is not the source of truth". A
 * number that reached the dataset without a citation, or a derivation whose
 * own arithmetic does not produce its result, fails here rather than shipping
 * and being discovered by a reader who knows the text better than we do.
 */
const CANONICAL = join(process.cwd(), 'data', 'canonical');
const GENERATED = join(process.cwd(), 'data', 'generated');

const CHRONOLOGIES = [DEFAULT_CHRONOLOGY_ID, ALTERNATE_CHRONOLOGY_ID];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const scriptureIds = new Set(
  readJson<Array<{ id: string }>>(join(CANONICAL, 'scripture-references.json')).map(
    (r) => r.id,
  ),
);
const assumptionIds = new Set(
  readJson<Array<{ id: string }>>(join(CANONICAL, 'assumptions.json')).map((a) => a.id),
);
const personIds = new Set(
  readJson<Array<{ id: string }>>(join(CANONICAL, 'people.json')).map((p) => p.id),
);
const eventIds = new Set(
  readJson<Array<{ id: string }>>(join(CANONICAL, 'events.json')).map((e) => e.id),
);

/**
 * The review status of each source figure for a chronology, before derivation:
 * the base file, with an alternate chronology's overrides applied on top. This
 * is the artefact a human actually reviews, and what the derived status is
 * propagated from.
 */
function sourceReviewStatus(chronologyId: string): Map<string, string> {
  const exists = (name: string) => existsSync(join(CANONICAL, name));
  const overrideName = `chronology-overrides.${chronologyId}.json`;
  const baseId = exists(overrideName)
    ? readJson<{ baseChronologyId: string }>(join(CANONICAL, overrideName))
        .baseChronologyId
    : chronologyId;

  const status = new Map(
    readJson<Array<{ personId: string; reviewStatus: string }>>(
      join(CANONICAL, `person-chronology.${baseId}.json`),
    ).map((r) => [r.personId, r.reviewStatus]),
  );

  if (exists(overrideName)) {
    const override = readJson<{
      records: Array<{ personId: string; reviewStatus?: string }>;
    }>(join(CANONICAL, overrideName));
    for (const patch of override.records) {
      if (patch.reviewStatus) status.set(patch.personId, patch.reviewStatus);
    }
  }

  return status;
}

describe.each(CHRONOLOGIES)('provenance: %s', (chronologyId) => {
  const records = loadDerivedRecords(chronologyId);
  const events = readJson<EventChronology[]>(
    join(GENERATED, `event-chronology.${chronologyId}.json`),
  );

  it('every stated year or lifespan cites at least one reference', () => {
    const uncited = records.filter(
      (r) =>
        (r.birthYear !== null || r.deathYear !== null || r.lifespan !== null) &&
        r.sourceReferences.length === 0,
    );
    expect(uncited.map((r) => r.personId)).toEqual([]);
  });

  it('every cited reference resolves to a scripture reference we hold', () => {
    const dangling: string[] = [];
    for (const record of records) {
      for (const ref of record.sourceReferences) {
        if (!scriptureIds.has(ref)) dangling.push(`${record.personId}: ${ref}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('every DERIVED birth year carries a derivation whose steps produce it', () => {
    const bad: string[] = [];
    for (const record of records) {
      if (record.birthConfidence !== 'DERIVED' || record.birthYear === null) continue;
      // The epoch is derived by definition and has no chain behind it.
      if (record.birthYear === 0 && record.derivation === null) continue;

      if (record.derivation === null) {
        bad.push(`${record.personId}: no derivation`);
        continue;
      }
      const parsed = DerivationSchema.safeParse(record.derivation);
      if (!parsed.success) {
        bad.push(`${record.personId}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
        continue;
      }
      if (record.derivation.result !== record.birthYear) {
        bad.push(
          `${record.personId}: derivation result ${record.derivation.result} is not the birth year ${record.birthYear}`,
        );
      }
    }
    expect(bad).toEqual([]);
  });

  it('every derivation step cites a reference that resolves', () => {
    const dangling: string[] = [];
    const walk = (subject: string, derivation: PersonChronology['derivation']) => {
      for (const step of derivation?.steps ?? []) {
        if (!scriptureIds.has(step.reference)) {
          dangling.push(`${subject}: ${step.reference}`);
        }
      }
    };
    for (const record of records) walk(record.personId, record.derivation);
    for (const event of events) walk(event.eventId, event.derivation);
    expect(dangling).toEqual([]);
  });

  it('every derivation names assumptions we hold', () => {
    const dangling: string[] = [];
    for (const record of records) {
      for (const id of record.derivation?.assumptions ?? []) {
        if (!assumptionIds.has(id)) dangling.push(`${record.personId}: ${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('a derived record is VERIFIED only atop a VERIFIED source figure', () => {
    // A derived record's status is propagated, not asserted (section 8): it is
    // the weakest status in the chain the value is computed from. The necessary
    // condition that is checkable from the source alone is that a VERIFIED
    // derived record must have a VERIFIED source figure of its own — the
    // derivation can only weaken a status, never strengthen one. The sufficient
    // half (a fully-VERIFIED chain does come out VERIFIED) lives in the
    // derivation's own unit tests, which hold the whole chain.
    const source = sourceReviewStatus(chronologyId);
    const laundered = records
      .filter((r) => r.reviewStatus === 'VERIFIED')
      .filter((r) => source.get(r.personId) !== 'VERIFIED');
    expect(laundered.map((r) => r.personId)).toEqual([]);
  });

  it('unknown stays unknown', () => {
    for (const record of records) {
      expect(record.birthYear === null).toBe(record.birthConfidence === 'UNKNOWN');
      expect(record.deathYear === null).toBe(record.deathConfidence === 'UNKNOWN');
      expect(record.lifespan === null).toBe(record.lifespanConfidence === 'UNKNOWN');
    }
  });

  it('every record belongs to a person we hold, exactly once', () => {
    const seen = new Set<string>();
    for (const record of records) {
      expect(personIds.has(record.personId)).toBe(true);
      expect(seen.has(record.personId)).toBe(false);
      seen.add(record.personId);
    }
  });

  it('every event record belongs to an event we hold', () => {
    for (const event of events) expect(eventIds.has(event.eventId)).toBe(true);
  });
});

describe('provenance: the canonical files hold no derived values', () => {
  it.each(CHRONOLOGIES.filter((c) => c === DEFAULT_CHRONOLOGY_ID))(
    'person-chronology.%s.json has no birthYear or deathYear key',
    (chronologyId) => {
      const text = readFileSync(
        join(CANONICAL, `person-chronology.${chronologyId}.json`),
        'utf8',
      );
      for (const key of ['birthYear', 'deathYear', 'birth_year', 'death_year']) {
        expect(text).not.toContain(`"${key}"`);
      }
    },
  );
});

import { type ChronologyResult, known, unknown } from '@/lib/domain';
import { getAgeAtYear } from './ages';
import { type Dataset, hasDates, isPresent, lookup } from './dataset';
import { ancestorsOf, descendantsOf, generationDepths } from '@/lib/graph/relationships';

export interface LivingPerson {
  personId: string;
  age: number;
  birthYear: number;
  /** The last year the chronology can place them alive, exclusive. */
  endYear: number;
  /**
   * True when the end above comes from a stated lifespan rather than a
   * recorded death, as Enoch's does.
   */
  openEnded: boolean;
}

/**
 * The last year a record can place someone alive, exclusive, or null.
 *
 * Usually the death year. For a record with a stated lifespan but no recorded
 * death — Enoch — it is birth plus lifespan, and the caller is told the end is
 * open. Excluding such a person entirely would throw away something the text
 * does say: Enoch was demonstrably alive during those years, and dropping him
 * off the year explorer would be as wrong as inventing a death for him.
 *
 * Note this is deliberately more permissive than getLifetimeOverlap, which
 * returns unknown for the same record. "He was alive in year X" is a fact the
 * chronology supports; "their lifetimes overlapped by N years" needs an end
 * date it does not have.
 */
function livingWindowEnd(record: {
  birthYear: number | null;
  deathYear: number | null;
  lifespan: number | null;
}): { end: number; openEnded: boolean } | null {
  if (record.birthYear === null) return null;
  if (record.deathYear !== null) return { end: record.deathYear, openEnded: false };
  if (record.lifespan !== null)
    return { end: record.birthYear + record.lifespan, openEnded: true };
  return null;
}

/**
 * Everyone alive in a given epoch year, with their age.
 *
 * Half-open, consistently with overlap: someone born in this exact year counts
 * as alive at age 0, someone whose window ends in this exact year does not.
 */
export function getPeopleAliveAtYear(dataset: Dataset, year: number): LivingPerson[] {
  const living: LivingPerson[] = [];

  for (const record of dataset.chronology.values()) {
    const window = livingWindowEnd(record);
    if (window === null || record.birthYear === null) continue;
    if (record.birthYear <= year && year < window.end) {
      living.push({
        personId: record.personId,
        age: year - record.birthYear,
        birthYear: record.birthYear,
        endYear: window.end,
        openEnded: window.openEnded,
      });
    }
  }

  return living.sort(
    (a, b) => a.birthYear - b.birthYear || a.personId.localeCompare(b.personId),
  );
}

export function getPeopleAliveAtBirth(
  dataset: Dataset,
  personId: string,
): ChronologyResult<LivingPerson[]> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');
  const record = lookup(dataset, personId);
  if (record?.birthYear == null) return unknown('no-data');
  return known(
    getPeopleAliveAtYear(dataset, record.birthYear).filter(
      (p) => p.personId !== personId,
    ),
    'DERIVED',
  );
}

export function getPeopleAliveAtDeath(
  dataset: Dataset,
  personId: string,
): ChronologyResult<LivingPerson[]> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');
  const record = lookup(dataset, personId);
  if (record?.deathYear == null) return unknown('unknown-in-chronology');
  return known(
    getPeopleAliveAtYear(dataset, record.deathYear).filter(
      (p) => p.personId !== personId,
    ),
    'DERIVED',
  );
}

export function getLivingAncestorsAtYear(
  dataset: Dataset,
  personId: string,
  year: number,
): ChronologyResult<LivingPerson[]> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');
  const ancestors = ancestorsOf(dataset.relationships, personId);
  const living = getPeopleAliveAtYear(dataset, year).filter((p) =>
    ancestors.has(p.personId),
  );
  return known(living, 'DERIVED');
}

export function getLivingDescendantsAtYear(
  dataset: Dataset,
  personId: string,
  year: number,
): ChronologyResult<LivingPerson[]> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');
  const descendants = descendantsOf(dataset.relationships, personId);
  const living = getPeopleAliveAtYear(dataset, year).filter((p) =>
    descendants.has(p.personId),
  );
  return known(living, 'DERIVED');
}

export interface ConcurrentGenerations {
  year: number;
  generations: number;
  personIds: string[];
}

/**
 * The greatest number of distinct generations alive in any single year.
 *
 * Only years where something changes need checking — a birth or a death — so
 * this scans the event years rather than every year in the range.
 */
export function getMaximumConcurrentGenerations(
  dataset: Dataset,
): ChronologyResult<ConcurrentGenerations> {
  const depths = generationDepths(dataset.relationships);
  const dated = [...dataset.chronology.values()].filter(hasDates);
  if (dated.length === 0) return unknown('no-data');

  const candidateYears = new Set<number>();
  for (const record of dated) {
    candidateYears.add(record.birthYear);
    candidateYears.add(record.deathYear);
  }
  // Open-ended records shift the counts too, so their window ends count as
  // candidate years even though they are not deaths.
  for (const record of dataset.chronology.values()) {
    if (
      record.birthYear !== null &&
      record.deathYear === null &&
      record.lifespan !== null
    ) {
      candidateYears.add(record.birthYear);
      candidateYears.add(record.birthYear + record.lifespan);
    }
  }

  let best: ConcurrentGenerations = { year: 0, generations: 0, personIds: [] };

  for (const year of [...candidateYears].sort((a, b) => a - b)) {
    const living = getPeopleAliveAtYear(dataset, year);
    const generations = new Set<number>();
    for (const person of living) {
      const depth = depths.get(person.personId);
      if (depth !== undefined) generations.add(depth);
    }
    if (generations.size > best.generations) {
      best = {
        year,
        generations: generations.size,
        personIds: living.map((p) => p.personId),
      };
    }
  }

  return best.generations === 0 ? unknown('no-data') : known(best, 'DERIVED');
}

/** Convenience for the year explorer: ages of everyone alive, ready to render. */
export function agesAtYear(dataset: Dataset, year: number) {
  return getPeopleAliveAtYear(dataset, year).map((person) => ({
    ...person,
    ageResult: getAgeAtYear(dataset, person.personId, year),
  }));
}

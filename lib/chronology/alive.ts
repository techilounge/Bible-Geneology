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
/**
 * Where a life's bar ends, and whether that end is recorded.
 *
 * Exported because the timeline needs the same answer. Two surfaces deciding
 * independently where Enoch's bar stops is exactly how they end up
 * disagreeing.
 */
export function livingWindowEnd(record: {
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
    // Named `span` rather than `window`: this layer must never touch the
    // browser global, and the architecture test greps for it by name.
    const span = livingWindowEnd(record);
    if (span === null || record.birthYear === null) continue;
    if (record.birthYear <= year && year < span.end) {
      living.push({
        personId: record.personId,
        age: year - record.birthYear,
        birthYear: record.birthYear,
        endYear: span.end,
        openEnded: span.openEnded,
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

/**
 * A year in which the set of living people changes.
 *
 * The year explorer needs somewhere to jump to, and "the next year in which
 * anything happens" is a better answer than "the next year". Between Jared's
 * death and Methuselah's there are centuries in which the list does not
 * change at all, and stepping through them one at a time tells the reader
 * nothing.
 */
export interface YearChange {
  year: number;
  /** People whose recorded life begins in this year. */
  births: string[];
  /**
   * People whose living window ends in this year. For a record with a stated
   * lifespan and no recorded death this is not a death, and the caller is
   * told so, because saying Enoch died in 987 AM is a claim the text does not
   * make.
   */
  ends: string[];
  /** True when at least one of the ends above is a recorded death. */
  hasRecordedDeath: boolean;
}

/**
 * Every year in which someone is born or a living window closes, in order.
 *
 * Derived from the chronology alone. Nothing here rounds, estimates or fills
 * a gap: a person the chronology cannot place contributes no year.
 */
export function changeYears(dataset: Dataset): YearChange[] {
  const byYear = new Map<number, YearChange>();

  const at = (year: number): YearChange => {
    const existing = byYear.get(year);
    if (existing) return existing;
    const created: YearChange = { year, births: [], ends: [], hasRecordedDeath: false };
    byYear.set(year, created);
    return created;
  };

  for (const record of dataset.chronology.values()) {
    const span = livingWindowEnd(record);
    if (span === null || record.birthYear === null) continue;
    at(record.birthYear).births.push(record.personId);
    const end = at(span.end);
    end.ends.push(record.personId);
    if (!span.openEnded) end.hasRecordedDeath = true;
  }

  const changes = [...byYear.values()].sort((a, b) => a.year - b.year);
  for (const change of changes) {
    change.births.sort();
    change.ends.sort();
  }
  return changes;
}

/**
 * The next year of change strictly after (or before) the given year.
 *
 * Returns null at the ends of the range rather than wrapping around, because
 * a control that silently jumps from the last death back to Adam's birth
 * would read as a bug.
 */
export function nextChange(
  changes: readonly YearChange[],
  from: number,
  direction: 'forward' | 'back',
): YearChange | null {
  if (direction === 'forward') {
    return changes.find((change) => change.year > from) ?? null;
  }
  for (let i = changes.length - 1; i >= 0; i -= 1) {
    const change = changes[i];
    /* v8 ignore next -- @preserve: noUncheckedIndexedAccess forces this guard; the index is always in range. */
    if (!change) continue;
    if (change.year < from) return change;
  }
  return null;
}

export interface BusiestYear {
  year: number;
  count: number;
}

/**
 * The year in which the chronology can place the most people alive.
 *
 * Only years of change need checking: between one birth or death and the
 * next, the count cannot move. Ties go to the earliest year, so the answer
 * is stable rather than dependent on iteration order.
 *
 * It is a fact about this chronology and not about history, and the page
 * that uses it says so. It exists because a year explorer has to open on
 * some year, and opening on the fullest one is more use than opening on the
 * epoch, where the answer is Adam.
 */
export function busiestYear(dataset: Dataset): ChronologyResult<BusiestYear> {
  let best: BusiestYear | null = null;

  for (const change of changeYears(dataset)) {
    const count = getPeopleAliveAtYear(dataset, change.year).length;
    if (best === null || count > best.count) best = { year: change.year, count };
  }

  if (best === null || best.count === 0) return unknown('no-data');
  return known(best, 'DERIVED');
}

import { type ChronologyResult, known, unknown } from '@/lib/domain';
import { type Dataset, hasDates, isPresent, lookup } from './dataset';

/**
 * Lifetime overlap.
 *
 * A lifetime is the half-open interval [birth, death) over integer epoch
 * years, fixed once in lib/config/chronology-defaults.ts:
 *
 *   overlapStart = max(birthA, birthB)
 *   overlapEnd   = min(deathA, deathB)
 *   overlapYears = max(0, overlapEnd - overlapStart)
 *
 * If one person dies in the same year another is born, the result is zero
 * years and `overlaps` is false, flagged with `sameYearBoundary` so the UI can
 * say the chronology cannot resolve it rather than a bare "no".
 *
 * The inclusive alternative would add a phantom year to every overlap and make
 * this disagree with getAgeAtPersonBirth by one. A single convention that
 * keeps ages and overlaps consistent is worth more than the extra year.
 */
export interface Overlap {
  personAId: string;
  personBId: string;
  overlaps: boolean;
  years: number;
  overlapStart: number | null;
  overlapEnd: number | null;
  /** True when the intervals touch at exactly one year boundary. */
  sameYearBoundary: boolean;
  /**
   * Years between the earlier death and the later birth, when the two do
   * not overlap; 0 when they do.
   *
   * Here rather than in the page that prints it. "Noah died two years
   * before Abraham was born" is a chronological claim, and a claim belongs
   * where it can be tested.
   */
  gapYears: number;
}

export function getLifetimeOverlap(
  dataset: Dataset,
  personAId: string,
  personBId: string,
): ChronologyResult<Overlap> {
  if (personAId === personBId) {
    return unknown('not-applicable');
  }
  if (!isPresent(dataset, personAId) || !isPresent(dataset, personBId)) {
    return unknown('not-applicable');
  }

  const a = lookup(dataset, personAId);
  const b = lookup(dataset, personBId);
  if (!hasDates(a) || !hasDates(b)) {
    // Enoch has no recorded death, so no overlap involving him is computable.
    // Substituting a death year to make the chart tidier is exactly what
    // requirement section 7 forbids.
    return unknown('unknown-in-chronology');
  }

  const overlapStart = Math.max(a.birthYear, b.birthYear);
  const overlapEnd = Math.min(a.deathYear, b.deathYear);
  const years = Math.max(0, overlapEnd - overlapStart);

  return known(
    {
      personAId,
      personBId,
      overlaps: years > 0,
      years,
      overlapStart: years > 0 ? overlapStart : null,
      overlapEnd: years > 0 ? overlapEnd : null,
      sameYearBoundary: overlapEnd === overlapStart,
      gapYears: Math.max(0, overlapStart - overlapEnd),
    },
    'DERIVED',
  );
}

export interface LifespanComparison {
  longerPersonId: string | null;
  differenceYears: number;
  lifespans: Record<string, number>;
}

export function compareLifespans(
  dataset: Dataset,
  personAId: string,
  personBId: string,
): ChronologyResult<LifespanComparison> {
  const a = lookup(dataset, personAId);
  const b = lookup(dataset, personBId);
  if (!isPresent(dataset, personAId) || !isPresent(dataset, personBId)) {
    return unknown('not-applicable');
  }
  if (a?.lifespan == null || b?.lifespan == null) {
    return unknown('unknown-in-chronology');
  }

  const difference = Math.abs(a.lifespan - b.lifespan);
  const longer =
    a.lifespan === b.lifespan ? null : a.lifespan > b.lifespan ? personAId : personBId;

  return known(
    {
      longerPersonId: longer,
      differenceYears: difference,
      lifespans: { [personAId]: a.lifespan, [personBId]: b.lifespan },
    },
    'DERIVED',
  );
}

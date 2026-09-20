import { describe, expect, it } from 'vitest';
import {
  getAgeAtPersonBirth,
  getLifetimeOverlap,
  lookup,
  type Dataset,
} from '@/lib/chronology';
import {
  ALTERNATE_CHRONOLOGY_ID,
  DEFAULT_CHRONOLOGY_ID,
} from '@/lib/config/chronology-defaults';
import { loadDerived, loadDerivedEvents } from './load';

/**
 * THESE ASSERTIONS ARE IMMUTABLE.
 *
 * Changing one requires a written justification in the pull request saying
 * what about the chronology was wrong before, and review by the project
 * owner. They exist to detect drift in the data and in the engine, so a suite
 * that gets edited whenever it fails is worthless.
 *
 * The numbered assertions follow the table in docs/TESTING_STRATEGY.md
 * section 3, which is the build prompt's section 22 list corrected for the
 * decision of 2026-09-20 that Terah was 130 at Abraham's birth. Assertions 7
 * and 10 read "do not overlap" where the original prompt said they did;
 * 13 and 14 assert the inverse under the alternate chronology, so the
 * inversion is pinned from both sides and neither reading can drift
 * unnoticed.
 */
const masoretic = loadDerived(DEFAULT_CHRONOLOGY_ID);
const alternate = loadDerived(ALTERNATE_CHRONOLOGY_ID);

function overlapYears(dataset: Dataset, a: string, b: string): number {
  const result = getLifetimeOverlap(dataset, a, b);
  if (result.status !== 'known') {
    throw new Error(`${a} and ${b}: expected a known overlap, got ${result.status}`);
  }
  return result.value.overlaps ? result.value.years : 0;
}

function overlaps(dataset: Dataset, a: string, b: string): boolean {
  const result = getLifetimeOverlap(dataset, a, b);
  if (result.status !== 'known') {
    throw new Error(`${a} and ${b}: expected a known overlap, got ${result.status}`);
  }
  return result.value.overlaps;
}

function eventsFor(chronologyId: string): Record<string, number | null> {
  return Object.fromEntries(
    loadDerivedEvents(chronologyId).map((e) => [e.eventId, e.startYear]),
  );
}

function years(dataset: Dataset, personId: string) {
  const record = lookup(dataset, personId);
  if (!record) throw new Error(`${personId} has no record`);
  return record;
}

describe('golden: lifespans stated in the text', () => {
  it('1. Adam lived 930 years (GEN.5.5)', () => {
    expect(years(masoretic, 'adam').lifespan).toBe(930);
    expect(years(masoretic, 'adam').lifespanConfidence).toBe('EXPLICIT');
  });

  it('2. Methuselah lived 969 years (GEN.5.27)', () => {
    expect(years(masoretic, 'methuselah').lifespan).toBe(969);
    expect(years(masoretic, 'methuselah').lifespanConfidence).toBe('EXPLICIT');
  });
});

describe('golden: overlaps under the default chronology', () => {
  it('3. Adam and Methuselah overlap by 243 years', () => {
    expect(overlapYears(masoretic, 'adam', 'methuselah')).toBe(243);
  });

  it('4. Adam and Noah do not overlap', () => {
    expect(overlaps(masoretic, 'adam', 'noah')).toBe(false);
  });

  it('5. Adam and Lamech overlap by 56 years', () => {
    expect(overlapYears(masoretic, 'adam', 'lamech')).toBe(56);
  });

  it('6. Methuselah and Noah overlap by 600 years', () => {
    expect(overlapYears(masoretic, 'methuselah', 'noah')).toBe(600);
  });

  it('7. Noah and Abraham do NOT overlap', () => {
    // Noah dies in 2006 AM, Abraham is born in 2008 AM. The build prompt's
    // section 30 worked example says otherwise; it was written against the
    // 70-year reading and is placeholder copy, not data.
    expect(overlaps(masoretic, 'noah', 'abraham')).toBe(false);
  });

  it('8. Shem and Abraham overlap by 150 years', () => {
    expect(overlapYears(masoretic, 'shem', 'abraham')).toBe(150);
  });

  it('9. Shem and Isaac overlap by 50 years', () => {
    expect(overlapYears(masoretic, 'shem', 'isaac')).toBe(50);
  });

  it('10. Shem and Jacob do NOT overlap', () => {
    // Shem dies in 2158 AM, Jacob is born in 2168 AM.
    expect(overlaps(masoretic, 'shem', 'jacob')).toBe(false);
  });
});

describe('golden: derived ages', () => {
  it('11. Methuselah was 369 when Noah was born', () => {
    const age = getAgeAtPersonBirth(masoretic, 'methuselah', 'noah');
    expect(age.status).toBe('known');
    if (age.status === 'known') {
      expect(age.value.years).toBe(369);
      expect(age.value.posthumous).toBe(false);
    }
  });

  it('12. Terah and Abraham overlap by exactly 75 years', () => {
    // The derivation's own consistency check. The 130-year offset was derived
    // as Terah's 205 minus Abraham's 75 at the departure from Haran, so the
    // overlap must come back out at 75. Anything else means the chain is
    // assembled wrong rather than that the number is surprising.
    expect(overlapYears(masoretic, 'terah', 'abraham')).toBe(75);
  });
});

describe('golden: the alternate Genesis 11:26 reading', () => {
  it('13. Noah and Abraham DO overlap, by 58 years', () => {
    expect(overlapYears(alternate, 'noah', 'abraham')).toBe(58);
  });

  it('14. Shem and Jacob DO overlap, by 50 years', () => {
    expect(overlapYears(alternate, 'shem', 'jacob')).toBe(50);
  });

  it('differs from the default only from Abraham forward', () => {
    for (const personId of ['adam', 'noah', 'shem', 'terah']) {
      expect(years(alternate, personId).birthYear).toBe(
        years(masoretic, personId).birthYear,
      );
    }
    expect(years(alternate, 'abraham').birthYear).toBe(1948);
    expect(years(masoretic, 'abraham').birthYear).toBe(2008);
  });

  it('never claims Abraham’s birth is explicit', () => {
    const record = years(alternate, 'abraham');
    expect(record.birthConfidence).not.toBe('EXPLICIT');
    expect(record.reviewStatus).not.toBe('VERIFIED');
  });
});

/**
 * Two figures the text states independently of the begetting chain. If the
 * chain is assembled correctly they land on years the chain already produces,
 * and if it is not they will not. Neither is an assertion about what the text
 * means; both are arithmetic that either closes or does not.
 */
describe('golden: the chain closes on its own independent checks', () => {
  const events = eventsFor(DEFAULT_CHRONOLOGY_ID);

  it('the flood falls in the year Methuselah dies', () => {
    expect(events['the-flood']).toBe(1656);
    expect(years(masoretic, 'methuselah').deathYear).toBe(1656);
  });

  it('Abraham departs Haran in the year Terah dies, as Acts 7:4 requires', () => {
    expect(events['abraham-departs-haran']).toBe(2083);
    expect(years(masoretic, 'terah').deathYear).toBe(2083);
  });

  it('Babel has no year, because the text gives none', () => {
    expect(events['tower-of-babel']).toBeNull();
  });
});

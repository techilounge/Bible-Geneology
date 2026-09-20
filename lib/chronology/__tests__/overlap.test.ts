import { describe, expect, it } from 'vitest';
import type { PersonChronology } from '@/lib/domain';
import { buildDataset } from '../dataset';
import { compareLifespans, getLifetimeOverlap } from '../overlap';
import { fixtureDataset } from './fixtures';

const dataset = fixtureDataset();

describe('getLifetimeOverlap', () => {
  it('computes an overlap between two dated people', () => {
    // ancestor 0-100, parent 50-150 => 50 years
    const result = getLifetimeOverlap(dataset, 'ancestor', 'parent');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.overlaps).toBe(true);
    expect(result.value.years).toBe(50);
    expect(result.value.overlapStart).toBe(50);
    expect(result.value.overlapEnd).toBe(100);
  });

  it('is symmetric', () => {
    const forward = getLifetimeOverlap(dataset, 'ancestor', 'parent');
    const backward = getLifetimeOverlap(dataset, 'parent', 'ancestor');
    expect(forward.status).toBe('known');
    expect(backward.status).toBe('known');
    if (forward.status !== 'known' || backward.status !== 'known') return;
    expect(forward.value.years).toBe(backward.value.years);
  });

  it('reports no overlap when one dies in the year the other is born', () => {
    // ancestor dies at 100, child is born at 100. Half-open [birth, death):
    // zero years, no overlap, flagged so the UI can explain the boundary
    // rather than stating a flat no.
    const result = getLifetimeOverlap(dataset, 'ancestor', 'child');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.overlaps).toBe(false);
    expect(result.value.years).toBe(0);
    expect(result.value.sameYearBoundary).toBe(true);
    expect(result.value.overlapStart).toBeNull();
  });

  it('does not flag a genuine non-overlap as a year boundary', () => {
    // cousin 50-90 and child 100-150 never touch.
    const result = getLifetimeOverlap(dataset, 'cousin', 'child');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.overlaps).toBe(false);
    expect(result.value.sameYearBoundary).toBe(false);
  });

  it('counts two people born in the same year as overlapping', () => {
    const result = getLifetimeOverlap(dataset, 'parent', 'cousin');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.overlaps).toBe(true);
    expect(result.value.years).toBe(40);
  });

  it('rejects a person compared with themselves', () => {
    const result = getLifetimeOverlap(dataset, 'ancestor', 'ancestor');
    expect(result).toEqual({ status: 'unknown', reason: 'not-applicable' });
  });

  it('returns unknown when one person has no recorded death', () => {
    // The Enoch case. Substituting birth plus lifespan to produce a tidier
    // chart is exactly what the data rules forbid.
    const result = getLifetimeOverlap(dataset, 'ancestor', 'openended');
    expect(result).toEqual({ status: 'unknown', reason: 'unknown-in-chronology' });
  });

  it('returns unknown when one person has no dates at all', () => {
    const result = getLifetimeOverlap(dataset, 'ancestor', 'undated');
    expect(result).toEqual({ status: 'unknown', reason: 'unknown-in-chronology' });
  });

  it('distinguishes absent from undated', () => {
    // 'absent' has no record in this chronology; 'undated' has one with null
    // years. Collapsing these would make the UI say "dates unknown" about
    // someone the chronology does not contain.
    const absent = getLifetimeOverlap(dataset, 'ancestor', 'absent');
    const undated = getLifetimeOverlap(dataset, 'ancestor', 'undated');
    expect(absent).toEqual({ status: 'unknown', reason: 'not-applicable' });
    expect(undated).toEqual({ status: 'unknown', reason: 'unknown-in-chronology' });
    expect(absent).not.toEqual(undated);
  });
});

describe('compareLifespans', () => {
  it('names the longer life and the difference', () => {
    const result = compareLifespans(dataset, 'ancestor', 'child');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.longerPersonId).toBe('ancestor');
    expect(result.value.differenceYears).toBe(50);
  });

  it('reports no winner when two lifespans are equal', () => {
    const result = compareLifespans(dataset, 'ancestor', 'parent');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.longerPersonId).toBeNull();
    expect(result.value.differenceYears).toBe(0);
  });

  it('compares lifespans even when a death year is unknown', () => {
    // openended has an explicit lifespan but no death year, which is enough
    // to compare lifespans though not enough to compute an overlap.
    const result = compareLifespans(dataset, 'ancestor', 'openended');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.longerPersonId).toBe('openended');
  });

  it('returns unknown when a lifespan is unknown', () => {
    expect(compareLifespans(dataset, 'ancestor', 'undated')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });
});

describe('compareLifespans: the remaining absences', () => {
  it('is symmetric', () => {
    const forwards = compareLifespans(dataset, 'ancestor', 'child');
    const backwards = compareLifespans(dataset, 'child', 'ancestor');
    if (forwards.status !== 'known' || backwards.status !== 'known') {
      throw new Error('expected known results');
    }
    expect(backwards.value.longerPersonId).toBe(forwards.value.longerPersonId);
    expect(backwards.value.differenceYears).toBe(forwards.value.differenceYears);
  });

  it('is unknown when one person is not in this chronology at all', () => {
    expect(compareLifespans(dataset, 'ancestor', 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });
});

describe('the gap between two lifetimes that do not overlap', () => {
  it('measures from the earlier death to the later birth', () => {
    // ancestor 0-100, child 100-150: they touch at one boundary, so the
    // gap is zero even though the overlap is too.
    const touching = getLifetimeOverlap(dataset, 'ancestor', 'child');
    if (touching.status !== 'known') throw new Error('fixture missing');
    expect(touching.value.gapYears).toBe(0);
    expect(touching.value.sameYearBoundary).toBe(true);
  });

  it('is zero when the two do overlap', () => {
    const overlapping = getLifetimeOverlap(dataset, 'ancestor', 'parent');
    if (overlapping.status !== 'known') throw new Error('fixture missing');
    expect(overlapping.value.overlaps).toBe(true);
    expect(overlapping.value.gapYears).toBe(0);
  });

  it('counts the years between a death and a later birth', () => {
    const apart = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [
        { ...(dataset.chronology.get('ancestor') as PersonChronology) },
        {
          ...(dataset.chronology.get('child') as PersonChronology),
          birthYear: 140,
          deathYear: 200,
        },
      ],
      relationships: [],
    });
    const result = getLifetimeOverlap(apart, 'ancestor', 'child');
    if (result.status !== 'known') throw new Error('fixture missing');
    // ancestor dies in 100, child is born in 140.
    expect(result.value.overlaps).toBe(false);
    expect(result.value.sameYearBoundary).toBe(false);
    expect(result.value.gapYears).toBe(40);
  });
});

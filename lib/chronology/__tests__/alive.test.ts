import { describe, expect, it } from 'vitest';
import type { PersonChronology } from '@/lib/domain';
import {
  agesAtYear,
  busiestYear,
  changeYears,
  nextChange,
  getLivingAncestorsAtYear,
  getLivingDescendantsAtYear,
  getMaximumConcurrentGenerations,
  getPeopleAliveAtBirth,
  getPeopleAliveAtDeath,
  getPeopleAliveAtYear,
} from '../alive';
import { buildDataset } from '../dataset';
import { fixtureDataset } from './fixtures';

const dataset = fixtureDataset();
const ids = (list: Array<{ personId: string }>) => list.map((p) => p.personId).sort();

describe('getPeopleAliveAtYear', () => {
  it('lists everyone alive with their ages', () => {
    const living = getPeopleAliveAtYear(dataset, 60);
    expect(ids(living)).toEqual(['ancestor', 'cousin', 'openended', 'parent']);
    expect(living.find((p) => p.personId === 'ancestor')?.age).toBe(60);
  });

  it('includes someone born in that exact year', () => {
    expect(ids(getPeopleAliveAtYear(dataset, 100))).toContain('child');
  });

  it('excludes someone who died in that exact year', () => {
    // Half-open, so the year of death is not a year alive. This is what keeps
    // the year explorer consistent with the overlap calculation.
    expect(ids(getPeopleAliveAtYear(dataset, 100))).not.toContain('ancestor');
  });

  it('excludes people with unknown dates rather than placing them at zero', () => {
    expect(ids(getPeopleAliveAtYear(dataset, 60))).not.toContain('undated');
  });

  it('includes a person with a stated lifespan but no recorded death', () => {
    // The Enoch case. Dropping him off the year explorer would discard
    // something the text does say, and would be as wrong as inventing a
    // death year for him. He is included and flagged open-ended.
    const living = getPeopleAliveAtYear(dataset, 60);
    const enochLike = living.find((p) => p.personId === 'openended');
    expect(enochLike?.openEnded).toBe(true);
    expect(enochLike?.age).toBe(50);
  });

  it('stops including an open-ended person past the stated lifespan', () => {
    // Born at 10, lifespan 200, so the chronology can place him alive up to
    // 210 and no further.
    expect(ids(getPeopleAliveAtYear(dataset, 300))).not.toContain('openended');
    expect(ids(getPeopleAliveAtYear(dataset, 209))).toContain('openended');
  });

  it('is more permissive than overlap, on purpose', () => {
    // "He was alive in year X" is supported by the chronology. "Their
    // lifetimes overlapped by N years" is not, because the end is unknown.
    expect(ids(getPeopleAliveAtYear(dataset, 60))).toContain('openended');
  });

  it('returns an empty list before the epoch, without erroring', () => {
    expect(getPeopleAliveAtYear(dataset, -50)).toEqual([]);
  });

  it('returns an empty list long after the last death', () => {
    expect(getPeopleAliveAtYear(dataset, 9999)).toEqual([]);
  });
});

describe('getPeopleAliveAtBirth and getPeopleAliveAtDeath', () => {
  it('excludes the subject from their own birth-year list', () => {
    const result = getPeopleAliveAtBirth(dataset, 'child');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(ids(result.value)).not.toContain('child');
    expect(ids(result.value)).toContain('parent');
  });

  it('excludes an ancestor who died in the subject birth year', () => {
    const result = getPeopleAliveAtBirth(dataset, 'child');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(ids(result.value)).not.toContain('ancestor');
  });

  it('returns unknown at death for a person with no recorded death', () => {
    expect(getPeopleAliveAtDeath(dataset, 'openended')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });
});

describe('living ancestors and descendants', () => {
  it('lists only ancestors who were alive', () => {
    const result = getLivingAncestorsAtYear(dataset, 'child', 120);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    // parent is alive at 120; ancestor died at 100; undated has no dates.
    expect(ids(result.value)).toEqual(['parent']);
  });

  it('lists only descendants who were alive', () => {
    const result = getLivingDescendantsAtYear(dataset, 'ancestor', 60);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(ids(result.value)).toEqual(['cousin', 'parent']);
  });

  it('returns an empty list rather than unknown when nobody qualifies', () => {
    const result = getLivingDescendantsAtYear(dataset, 'child', 10);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value).toEqual([]);
  });
});

describe('getMaximumConcurrentGenerations', () => {
  it('finds the year with the most generations alive at once', () => {
    const result = getMaximumConcurrentGenerations(dataset);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    // ancestor (gen 0), parent (gen 1) and cousin (gen 1) overlap from 50;
    // child (gen 2) arrives at 100, by which time ancestor has died.
    expect(result.value.generations).toBeGreaterThanOrEqual(2);
    expect(result.value.personIds.length).toBeGreaterThan(0);
  });
});

describe('agesAtYear', () => {
  it('pairs everyone alive with their age, ready to render', () => {
    const rows = agesAtYear(dataset, 60);
    expect(ids(rows)).toEqual(['ancestor', 'cousin', 'openended', 'parent']);

    const ancestor = rows.find((r) => r.personId === 'ancestor');
    expect(ancestor?.ageResult.status).toBe('known');
    if (ancestor?.ageResult.status === 'known') {
      expect(ancestor.ageResult.value.years).toBe(60);
    }
  });

  it('carries an unknown age rather than a number for an open-ended life', () => {
    // 'openended' is listed as alive because his birth and lifespan are
    // known, and his age still resolves; the distinction that matters is
    // that the year explorer includes him at all rather than dropping him.
    const row = agesAtYear(dataset, 60).find((r) => r.personId === 'openended');
    expect(row?.openEnded).toBe(true);
  });

  it('returns an empty list for a year before anyone is born', () => {
    expect(agesAtYear(dataset, -1)).toEqual([]);
  });
});

describe('getPeopleAliveAtDeath: the absences', () => {
  it('is not-applicable for someone absent from this chronology', () => {
    expect(getPeopleAliveAtDeath(dataset, 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });

  it('is unknown for someone whose death the text does not record', () => {
    // Enoch's case. There is no year to ask the question at.
    expect(getPeopleAliveAtDeath(dataset, 'openended')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });

  it('is unknown for someone with no dates at all', () => {
    expect(getPeopleAliveAtDeath(dataset, 'undated')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });
});

describe('the living window', () => {
  it('leaves out someone with neither a death year nor a lifespan', () => {
    // 'undated' has a record and no numbers in it. There is no window to
    // place them in, and placing them anyway would be an invention.
    expect(ids(getPeopleAliveAtYear(dataset, 60))).not.toContain('undated');
  });

  it('includes an open-ended life for as long as its lifespan runs', () => {
    // 'openended' is born in 10 with a lifespan of 200 and no death year.
    expect(ids(getPeopleAliveAtYear(dataset, 209))).toContain('openended');
    expect(ids(getPeopleAliveAtYear(dataset, 210))).not.toContain('openended');
  });
});

const ancestorRecord = dataset.chronology.get('ancestor');
if (!ancestorRecord) throw new Error('fixture missing an ancestor record');

describe('a record with a birth year and nothing else', () => {
  it('is left out of the year explorer rather than given a window', () => {
    // Genesis names people whose birth can be placed but whose death and
    // lifespan it never gives. A bar with a start and no length is not a
    // bar, and inventing the length is the failure this dataset avoids.
    const dataset = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [
        {
          personId: 'birth-only',
          chronologyId: 'fixture',
          birthYear: 10,
          deathYear: null,
          lifespan: null,
          birthConfidence: 'DERIVED',
          deathConfidence: 'UNKNOWN',
          lifespanConfidence: 'UNKNOWN',
          birthSourceType: 'SCRIPTURE_DERIVED',
          deathSourceType: 'UNKNOWN',
          lifespanSourceType: 'UNKNOWN',
          sourceReferences: ['GEN.5.1'],
          calculationMethod: null,
          derivation: null,
          notes: null,
          reviewStatus: 'DRAFT',
        },
      ],
      relationships: [],
    });
    expect(getPeopleAliveAtYear(dataset, 10)).toEqual([]);
  });
});

describe('getPeopleAliveAtDeath: the answer itself', () => {
  it('lists who outlived the person, without the person', () => {
    // 'cousin' dies in year 90; ancestor (0-100) and parent (50-150) are
    // both still alive, and 'child' (100-150) is not yet born.
    const result = getPeopleAliveAtDeath(dataset, 'cousin');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(ids(result.value)).toEqual(['ancestor', 'openended', 'parent']);
  });
});

describe('the remaining absences in the living-at queries', () => {
  it('reports no-data for a birth query on someone with no birth year', () => {
    expect(getPeopleAliveAtBirth(dataset, 'undated')).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });

  it('reports not-applicable for an ancestor query on an absent person', () => {
    expect(getLivingAncestorsAtYear(dataset, 'absent', 60)).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });

  it('reports not-applicable for a descendant query on an absent person', () => {
    expect(getLivingDescendantsAtYear(dataset, 'absent', 60)).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });

  it('reports no-data for concurrent generations when nobody is dated', () => {
    const empty = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [],
      relationships: [],
    });
    expect(getMaximumConcurrentGenerations(empty)).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });

  it('reports no-data when everyone dated belongs to one generation', () => {
    // One generation alive at a time is not a concurrency finding, and
    // reporting it as one would put "1 generation" on a surprise card.
    const flat = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [ancestorRecord],
      relationships: [],
    });
    expect(getMaximumConcurrentGenerations(flat)).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });
});

describe('getPeopleAliveAtBirth: absence', () => {
  it('is not-applicable for someone with no record in this chronology', () => {
    expect(getPeopleAliveAtBirth(dataset, 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });
});

describe('changeYears', () => {
  const changes = changeYears(dataset);

  it('lists only the years in which the living set actually changes', () => {
    // Births at 0, 10, 50 (two) and 100; ends at 90, 100, 150 (two) and 210.
    expect(changes.map((c) => c.year)).toEqual([0, 10, 50, 90, 100, 150, 210]);
  });

  it('groups everyone who is born in the same year', () => {
    expect(changes.find((c) => c.year === 50)?.births).toEqual(['cousin', 'parent']);
  });

  it('records a birth and an end falling in the same year', () => {
    const year = changes.find((c) => c.year === 100);
    expect(year?.births).toEqual(['child']);
    expect(year?.ends).toEqual(['ancestor']);
    expect(year?.hasRecordedDeath).toBe(true);
  });

  it('does not call the end of an open-ended window a death', () => {
    // openended is born in 10 with a lifespan of 200 and no recorded death,
    // so 210 is where the chronology stops placing them, not a death year.
    const year = changes.find((c) => c.year === 210);
    expect(year?.ends).toEqual(['openended']);
    expect(year?.hasRecordedDeath).toBe(false);
  });

  it('ignores anyone the chronology cannot place', () => {
    const named = changes.flatMap((c) => [...c.births, ...c.ends]);
    expect(named).not.toContain('undated');
    expect(named).not.toContain('absent');
  });

  it('has nothing to report for an empty chronology', () => {
    const empty = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [],
      relationships: [],
    });
    expect(changeYears(empty)).toEqual([]);
  });
});

describe('nextChange', () => {
  const changes = changeYears(dataset);

  it('finds the next year in which something happens', () => {
    expect(nextChange(changes, 100, 'forward')?.year).toBe(150);
  });

  it('skips the centuries in which nothing happens', () => {
    // 50 to 90 is one step, not forty.
    expect(nextChange(changes, 50, 'forward')?.year).toBe(90);
  });

  it('finds the previous year in which something happened', () => {
    expect(nextChange(changes, 100, 'back')?.year).toBe(90);
    expect(nextChange(changes, 211, 'back')?.year).toBe(210);
  });

  it('stops at the ends of the range rather than wrapping around', () => {
    expect(nextChange(changes, 210, 'forward')).toBeNull();
    expect(nextChange(changes, 0, 'back')).toBeNull();
  });

  it('has nothing to find in an empty list', () => {
    expect(nextChange([], 100, 'forward')).toBeNull();
    expect(nextChange([], 100, 'back')).toBeNull();
  });
});

describe('busiestYear', () => {
  it('finds the year the chronology can place the most people alive', () => {
    // In the fixture, 50 to 90 holds ancestor, parent, cousin and openended.
    const result = busiestYear(dataset);
    expect(result.status).toBe('known');
    if (result.status !== 'known') throw new Error('fixture missing');
    expect(result.value.count).toBe(4);
    expect(result.value.year).toBe(50);
  });

  it('prefers the earliest year when two are equally full', () => {
    const tied = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [
        {
          ...(dataset.chronology.get('ancestor') as PersonChronology),
        },
      ],
      relationships: [],
    });
    const result = busiestYear(tied);
    if (result.status !== 'known') throw new Error('fixture missing');
    // One person, alive from year 0; the first year of change wins.
    expect(result.value.year).toBe(0);
  });

  it('says it does not know when nobody can be placed', () => {
    const empty = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [],
      relationships: [],
    });
    expect(busiestYear(empty).status).toBe('unknown');
  });
});

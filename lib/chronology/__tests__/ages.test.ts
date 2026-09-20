import { describe, expect, it } from 'vitest';
import {
  datedPeople,
  getAgeAtPersonBirth,
  getAgeAtPersonDeath,
  getAgeAtYear,
  getPersonTimeline,
} from '../ages';
import { fixtureDataset } from './fixtures';

const dataset = fixtureDataset();

describe('getAgeAtYear', () => {
  it('gives the age during a lifetime', () => {
    const result = getAgeAtYear(dataset, 'ancestor', 30);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value).toEqual({ years: 30, posthumous: false });
  });

  it('gives age zero in the year of birth', () => {
    const result = getAgeAtYear(dataset, 'ancestor', 0);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.years).toBe(0);
  });

  it('returns unknown rather than a negative age before birth', () => {
    // Requirement section 57: never a negative age, never NaN.
    expect(getAgeAtYear(dataset, 'child', 50)).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });

  it('returns the age at death, flagged, for a year after death', () => {
    const result = getAgeAtYear(dataset, 'ancestor', 500);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value).toEqual({ years: 100, posthumous: true });
  });

  it('treats the year of death as posthumous, consistently with overlap', () => {
    const result = getAgeAtYear(dataset, 'ancestor', 100);
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.posthumous).toBe(true);
  });

  it('returns unknown for a person absent from the chronology', () => {
    expect(getAgeAtYear(dataset, 'absent', 10)).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });

  it('returns unknown for a person with no birth year', () => {
    expect(getAgeAtYear(dataset, 'undated', 10)).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });
});

describe('getAgeAtPersonBirth', () => {
  it('answers how old one person was when another was born', () => {
    const result = getAgeAtPersonBirth(dataset, 'ancestor', 'parent');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.years).toBe(50);
  });

  it('agrees with the overlap convention at the boundary', () => {
    // ancestor dies at 100, child born at 100: the age comes back posthumous,
    // and getLifetimeOverlap reports no overlap. The two must not disagree.
    const result = getAgeAtPersonBirth(dataset, 'ancestor', 'child');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.posthumous).toBe(true);
  });

  it('returns unknown when the other person has no birth year', () => {
    expect(getAgeAtPersonBirth(dataset, 'ancestor', 'undated')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });
});

describe('getAgeAtPersonDeath', () => {
  it('answers how old one person was when another died', () => {
    const result = getAgeAtPersonDeath(dataset, 'parent', 'ancestor');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.years).toBe(50);
  });

  it('returns unknown when the other person has no recorded death', () => {
    expect(getAgeAtPersonDeath(dataset, 'ancestor', 'openended')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });
});

describe('getPersonTimeline', () => {
  it('marks a record with no recorded death as open ended', () => {
    const result = getPersonTimeline(dataset, 'openended');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value.openEnded).toBe(true);
    expect(result.value.deathYear).toBeNull();
    expect(result.value.lifespan).toBe(200);
  });

  it('carries the derivation so the UI need not recompute it', () => {
    const result = getPersonTimeline(dataset, 'parent');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.derivation?.result).toBe(50);
  });
});

describe('datedPeople', () => {
  it('lists only the people the dataset can place on a timeline', () => {
    const ids = datedPeople(dataset)
      .map((p) => p.personId)
      .sort();
    expect(ids).toEqual(['ancestor', 'child', 'cousin', 'parent']);
  });

  it('leaves out someone with a lifespan but no recorded death', () => {
    // A bar of known length with no end is not a bar, and guessing the end
    // to draw one is the mistake the whole dataset is arranged to prevent.
    expect(datedPeople(dataset).map((p) => p.personId)).not.toContain('openended');
  });
});

describe('the absences each age function has to distinguish', () => {
  it('reports not-applicable when the other person is not in this chronology', () => {
    expect(getAgeAtPersonBirth(dataset, 'ancestor', 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
    expect(getAgeAtPersonDeath(dataset, 'ancestor', 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });

  it('reports unknown-in-chronology when the other person has no dates', () => {
    expect(getAgeAtPersonBirth(dataset, 'ancestor', 'undated')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });

  it('reports unknown-in-chronology when the other person has no recorded death', () => {
    expect(getAgeAtPersonDeath(dataset, 'ancestor', 'openended')).toEqual({
      status: 'unknown',
      reason: 'unknown-in-chronology',
    });
  });
});

describe('getPersonTimeline', () => {
  it('gives the bar a closed life should be drawn as', () => {
    const result = getPersonTimeline(dataset, 'ancestor');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.value).toEqual({
      personId: 'ancestor',
      birthYear: 0,
      deathYear: 100,
      lifespan: 100,
      openEnded: false,
    });
  });

  it('marks a life with no recorded death as open-ended rather than ending it', () => {
    const result = getPersonTimeline(dataset, 'openended');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.value.deathYear).toBeNull();
    expect(result.value.openEnded).toBe(true);
    expect(result.value.lifespan).toBe(200);
  });

  it('carries the derivation so the bar can explain its own start', () => {
    const result = getPersonTimeline(dataset, 'ancestor');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.derivation).toBeDefined();
  });

  it('is no-data for a person present but undated', () => {
    expect(getPersonTimeline(dataset, 'undated')).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });

  it('is not-applicable for a person absent from this chronology', () => {
    expect(getPersonTimeline(dataset, 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });
});

describe('a dated record with no derivation behind it', () => {
  it('still returns a timeline, without a derivation to show', () => {
    const record = dataset.chronology.get('ancestor');
    if (!record) throw new Error('fixture missing');
    const bare = fixtureDataset();
    (bare.chronology as Map<string, typeof record>).set('ancestor', {
      ...record,
      derivation: null,
    });
    const result = getPersonTimeline(bare, 'ancestor');
    expect(result.status).toBe('known');
    if (result.status === 'known') expect(result.derivation).toBeUndefined();
  });
});

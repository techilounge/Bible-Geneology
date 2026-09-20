import { describe, expect, it } from 'vitest';
import {
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

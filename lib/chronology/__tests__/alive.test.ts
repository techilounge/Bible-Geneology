import { describe, expect, it } from 'vitest';
import {
  getLivingAncestorsAtYear,
  getLivingDescendantsAtYear,
  getMaximumConcurrentGenerations,
  getPeopleAliveAtBirth,
  getPeopleAliveAtDeath,
  getPeopleAliveAtYear,
} from '../alive';
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

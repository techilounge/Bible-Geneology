import { describe, expect, it } from 'vitest';
import { DerivationSchema } from '@/lib/domain';
import { getChronologyExplanation } from '../explanation';
import { fixtureDataset } from './fixtures';

const dataset = fixtureDataset();

describe('getChronologyExplanation', () => {
  it('returns the derivation recorded when the value was computed', () => {
    const result = getChronologyExplanation(dataset, 'parent');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;

    expect(result.value.personId).toBe('parent');
    expect(result.value.field).toBe('birthYear');
    expect(result.value.unit).toBe('AM');
    expect(result.value.steps).toHaveLength(1);
    expect(result.value.assumptions).toEqual(['adam-created-at-year-zero']);
  });

  it('explains the same number the record states, never a recomputed one', () => {
    // The whole point of storing the derivation rather than re-deriving it
    // for display: the explanation and the date cannot disagree.
    const result = getChronologyExplanation(dataset, 'parent');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.value.result).toBe(dataset.chronology.get('parent')?.birthYear);
  });

  it('carries the derivation on the result as well as in the value', () => {
    const result = getChronologyExplanation(dataset, 'child');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.derivation).toBeDefined();
    expect(DerivationSchema.safeParse(result.derivation).success).toBe(true);
  });

  it('is unknown when the person has no dates to explain', () => {
    expect(getChronologyExplanation(dataset, 'undated')).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });

  it('is unknown when the person has no record in this chronology', () => {
    expect(getChronologyExplanation(dataset, 'absent')).toEqual({
      status: 'unknown',
      reason: 'not-applicable',
    });
  });

  it('is unknown rather than inventing a chain for a value that has none', () => {
    const bare = fixtureDataset();
    const record = bare.chronology.get('parent');
    if (!record) throw new Error('fixture missing');
    (bare.chronology as Map<string, typeof record>).set('parent', {
      ...record,
      derivation: null,
    });
    expect(getChronologyExplanation(bare, 'parent')).toEqual({
      status: 'unknown',
      reason: 'no-data',
    });
  });
});

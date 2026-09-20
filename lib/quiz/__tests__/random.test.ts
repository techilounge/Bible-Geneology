import { describe, expect, it } from 'vitest';
import { createRandom, nextQuizSeed } from '../random';

describe('seeded randomness', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRandom('seed');
    const b = createRandom('seed');
    const draw = (r: ReturnType<typeof createRandom>) =>
      [0, 1, 2, 3, 4].map(() => r.next(1000));
    expect(draw(a)).toEqual(draw(b));
  });

  it('produces a different stream for a different seed', () => {
    const a = [0, 1, 2, 3, 4].map(() => createRandom('one').next(1000));
    const b = [0, 1, 2, 3, 4].map(() => createRandom('two').next(1000));
    expect(a).not.toEqual(b);
  });

  it('stays inside the bound, and treats a bound of nothing as nothing', () => {
    const random = createRandom('bounds');
    for (let i = 0; i < 200; i += 1) {
      const value = random.next(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
    expect(random.next(0)).toBe(0);
    expect(createRandom('bounds').next(-3)).toBe(0);
  });

  it('shuffles into a permutation, not a new set', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = createRandom('shuffle').shuffle(items);
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('samples distinct items, and never more than it has', () => {
    const random = createRandom('sample');
    expect(new Set(random.sample(['a', 'b', 'c'], 2)).size).toBe(2);
    expect(random.sample(['a', 'b'], 5)).toHaveLength(2);
  });

  it('picks nothing from nothing', () => {
    expect(createRandom('pick').pick([])).toBeNull();
    expect(createRandom('pick').pick(['only'])).toBe('only');
  });

  it('derives the next seed from the current one', () => {
    expect(nextQuizSeed('start')).toBe(nextQuizSeed('start'));
    expect(nextQuizSeed('start')).not.toBe('start');
    expect(nextQuizSeed('start')).not.toBe(nextQuizSeed('other'));
  });
});

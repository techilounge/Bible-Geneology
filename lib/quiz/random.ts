import { hashSeed } from '@/lib/discovery';

/**
 * Seeded randomness, so a quiz link is a quiz.
 *
 * `Math.random` on the server would mean the question a player shares is
 * not the question their friend gets, and it would make the Phase 12 gate
 * untestable: a generator you cannot run twice cannot be checked twice.
 * The seed travels in the URL exactly as Surprise Me's does, and the hash
 * is shared with it so the two cannot drift apart.
 *
 * mulberry32, chosen because it is six lines long and the statistical
 * quality of the stream does not matter here. What matters is that the
 * same seed produces the same questions on every machine and every run.
 */
export interface Random {
  /** An integer in [0, bound). */
  next(bound: number): number;
  /** One item, or null when there is nothing to pick from. */
  pick<T>(items: readonly T[]): T | null;
  /** A copy in a shuffled order. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct items, or fewer when there are not enough. */
  sample<T>(items: readonly T[], count: number): T[];
}

export function createRandom(seed: string): Random {
  let state = hashSeed(seed);

  const float = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const next = (bound: number): number =>
    bound <= 0 ? 0 : Math.floor(float() * bound) % bound;

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = next(index + 1);
      const here = copy[index] as T;
      copy[index] = copy[swap] as T;
      copy[swap] = here;
    }
    return copy;
  };

  return {
    next,
    pick: <T>(items: readonly T[]): T | null =>
      items.length === 0 ? null : (items[next(items.length)] as T),
    shuffle,
    sample: <T>(items: readonly T[], count: number): T[] =>
      shuffle(items).slice(0, count),
  };
}

/**
 * The seed to offer next, derived from the current one so a session is
 * reproducible from where it started.
 */
export function nextQuizSeed(seed: string): string {
  return `${seed}.${(hashSeed(seed) % 997).toString(36)}`;
}

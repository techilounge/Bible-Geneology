/**
 * What a discovery is.
 *
 * A finding the dataset supports, generated from the chronology engine and
 * never written by hand. Requirement section 34 asks for deterministic
 * discoveries; `docs/COPY_CORRECTIONS.md` records what happens without
 * them, where the build prompt's own examples asserted overlaps the data
 * does not support. A discovery that can only be produced by the engine
 * cannot outlive the numbers it came from: change the chronology and the
 * sentence changes with it, or disappears.
 */
export type DiscoveryKind =
  | 'longest-lifespan'
  | 'shortest-lifespan'
  | 'largest-overlap'
  | 'living-ancestors-at-birth'
  | 'living-descendants-at-death'
  | 'most-concurrent-generations'
  | 'unexpected-contemporaries'
  | 'outlived-a-descendant'
  | 'events-during-a-lifetime'
  | 'shortest-connection-chain';

/** One line of the working, so a reader can check the finding themselves. */
export interface DiscoveryStep {
  label: string;
  value: string;
}

export interface Discovery {
  /** Stable across runs: derived from the kind and the people involved. */
  id: string;
  kind: DiscoveryKind;
  chronologyId: string;
  /** The finding, in one sentence. */
  headline: string;
  /**
   * What the finding ranged over. A superlative drawn from 26 dated people
   * is not a superlative about Scripture, and saying which is which is the
   * difference between a fact and an overstatement.
   */
  population: string;
  personIds: readonly string[];
  eventIds: readonly string[];
  calculation: readonly DiscoveryStep[];
  sourceReferences: readonly string[];
  /**
   * True when the finding rests on two lifetimes overlapping, so every
   * surface that shows it also shows that an overlap is not a meeting.
   */
  aboutOverlap: boolean;
}

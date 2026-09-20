import { numbersIn } from './numbers';

/**
 * Checking one figure against the text.
 *
 * Pure, and the verse text is injected rather than read, for the same
 * reason the rest of the engine takes a Dataset: a check that fetched its
 * own evidence could not be tested against evidence chosen by the test.
 *
 * The rule is deliberately strict. A figure counts as verified only when
 * the number appears in the cited verse in the primary source *and* in the
 * corroborating one. Two independent translations of the Masoretic text
 * agreeing on a number is evidence; one of them agreeing is a reading.
 */
export interface VerseLookup {
  /** Verse text for a reference id, or null when the source lacks it. */
  (sourceId: string, referenceId: string): string | null;
}

export type Outcome =
  /** The number is stated in the cited verse, in both sources. */
  | 'verified'
  /** Stated in the primary source, absent from the corroborating one. */
  | 'sources-disagree'
  /** Not stated in the cited verse in the primary source. */
  | 'not-stated'
  /** A cited reference could not be read from a source at all. */
  | 'reference-unreadable';

export interface FigureCheck {
  subject: string;
  value: number;
  references: readonly string[];
  outcome: Outcome;
  /** What each source states at those references, for the audit trail. */
  stated: Record<string, number[]>;
  quotes: Record<string, string>;
}

export interface CheckOptions {
  primarySourceId: string;
  corroboratingSourceId: string;
}

export function checkFigure(
  subject: string,
  value: number,
  references: readonly string[],
  lookup: VerseLookup,
  options: CheckOptions,
): FigureCheck {
  const sources = [options.primarySourceId, options.corroboratingSourceId];
  const stated: Record<string, number[]> = {};
  const quotes: Record<string, string> = {};
  let unreadable = false;

  for (const sourceId of sources) {
    const texts = references.map((reference) => lookup(sourceId, reference));
    if (texts.some((text) => text === null)) unreadable = true;
    const joined = texts.filter((text): text is string => text !== null);
    quotes[sourceId] = joined.join(' ').trim();
    stated[sourceId] = [...numbersIn(joined.join(' '))].sort((a, b) => a - b);
  }

  const inPrimary = stated[options.primarySourceId]?.includes(value) ?? false;
  const inCorroborating = stated[options.corroboratingSourceId]?.includes(value) ?? false;

  const outcome: Outcome = unreadable
    ? 'reference-unreadable'
    : inPrimary && inCorroborating
      ? 'verified'
      : inPrimary || inCorroborating
        ? 'sources-disagree'
        : 'not-stated';

  return { subject, value, references, outcome, stated, quotes };
}

/**
 * A record is promoted only when every figure it holds passed. One figure
 * left unverified leaves the whole record where it was, because a record is
 * the unit a reader trusts: "verified except for one number" is not a state
 * a product should be able to express.
 */
export function recordOutcome(checks: readonly FigureCheck[]): Outcome | 'no-figures' {
  if (checks.length === 0) return 'no-figures';
  const worst: Outcome[] = [
    'reference-unreadable',
    'not-stated',
    'sources-disagree',
    'verified',
  ];
  for (const outcome of worst) {
    if (checks.some((check) => check.outcome === outcome)) return outcome;
  }
  /* v8 ignore next -- @preserve: every outcome is in the list above. */
  return 'verified';
}

export interface DerivationStep {
  from: string;
  to: string;
  years: number;
  reference: string;
  runningTotal: number;
}

export interface DerivationCheck {
  subject: string;
  /** The running totals add up, step by step, to the stated result. */
  arithmetic: 'sound' | 'unsound';
  result: number;
  recomputed: number;
  /** Steps whose reference is not a figure the text check verified. */
  unverifiedReferences: string[];
}

/**
 * Re-runs a derivation rather than trusting its answer.
 *
 * Kelv's rule for Phase 2: a derived value is not verified because its
 * final number looks reasonable. It is verified when every explicit input
 * underneath it has been checked against the text and the arithmetic has
 * been run again. This does the second half, and takes the set of verified
 * references so it can say which inputs the first half did not cover.
 */
export function checkDerivationChain(
  subject: string,
  steps: readonly DerivationStep[],
  result: number,
  verifiedReferences: ReadonlySet<string>,
): DerivationCheck {
  let running = 0;
  let arithmetic: DerivationCheck['arithmetic'] = 'sound';

  for (const step of steps) {
    running += step.years;
    if (step.runningTotal !== running) arithmetic = 'unsound';
  }
  if (running !== result) arithmetic = 'unsound';

  const unverifiedReferences = [
    ...new Set(
      steps
        .map((step) => step.reference)
        .filter((reference) => !verifiedReferences.has(reference)),
    ),
  ];

  return { subject, arithmetic, result, recomputed: running, unverifiedReferences };
}

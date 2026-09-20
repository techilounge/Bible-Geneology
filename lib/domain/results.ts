import type { ConfidenceLevel } from './enums';
import type { Derivation } from './types';

/**
 * Every engine function that can fail to determine a value returns this union
 * rather than a bare number.
 *
 * This is how requirement section 57 — never show NaN, undefined, null or a
 * negative age — is made structural instead of a review habit. A component
 * cannot render a ChronologyResult without handling the unknown and disputed
 * cases, and no code path produces a bare number that could be NaN.
 */
export type ChronologyResult<T> =
  | {
      status: 'known';
      value: T;
      confidence: ConfidenceLevel;
      derivation?: Derivation;
    }
  | {
      status: 'unknown';
      reason: UnknownReason;
    }
  | {
      status: 'disputed';
      alternatives: Array<{ value: T; sourceId: string; confidence: ConfidenceLevel }>;
    };

/**
 * 'no-data'               the person exists in this chronology but the value is UNKNOWN
 * 'unknown-in-chronology' a dependency of the calculation is UNKNOWN
 * 'not-applicable'        the person has no record in this chronology at all
 *
 * The last is deliberately distinct from the first. When the Septuagint
 * chronology is added it includes a generation the Masoretic text does not, so
 * "not present in this chronology" and "present but undated" are different
 * things and the UI says different things about them. Collapsing them is the
 * mistake this union exists to prevent.
 */
export type UnknownReason = 'no-data' | 'unknown-in-chronology' | 'not-applicable';

export function known<T>(
  value: T,
  confidence: ConfidenceLevel,
  derivation?: Derivation,
): ChronologyResult<T> {
  return derivation
    ? { status: 'known', value, confidence, derivation }
    : { status: 'known', value, confidence };
}

export function unknown<T>(reason: UnknownReason): ChronologyResult<T> {
  return { status: 'unknown', reason };
}

export function isKnown<T>(
  result: ChronologyResult<T>,
): result is Extract<ChronologyResult<T>, { status: 'known' }> {
  return result.status === 'known';
}

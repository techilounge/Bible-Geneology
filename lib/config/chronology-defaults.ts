/**
 * Chronology-wide conventions that the engine and the UI must agree on.
 *
 * These are interpretive decisions, documented in docs/DATA_SOURCING.md section 4.
 * They live in one place so that no calculation and no component can quietly
 * adopt a different convention.
 */

/** Identifier of the chronology selected when the user has not chosen one. */
export const DEFAULT_CHRONOLOGY_ID = 'masoretic';

/** Label for the epoch used by the default chronology. */
export const EPOCH_LABEL = 'AM';

/**
 * A lifetime is the half-open interval [birth, death) over integer epoch years.
 *
 * Consequence: when one person dies in the same year another is born, the
 * overlap is zero years and the engine reports no overlap, flagged as a
 * same-year boundary rather than a plain negative. Documented as assumption
 * `overlap-half-open`.
 */
export const LIFETIME_INTERVAL = 'half-open' as const;

/** Shown wherever a calculated epoch year is displayed. Requirement section 10. */
export const CHRONOLOGY_DISCLAIMER =
  'Ancient biblical textual traditions contain differences in some genealogical ' +
  'ages. Changing the chronology may change calculated dates and lifetime overlaps.';

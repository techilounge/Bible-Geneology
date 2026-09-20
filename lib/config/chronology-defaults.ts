/**
 * Chronology-wide conventions that the engine and the UI must agree on.
 *
 * These are interpretive decisions, documented in docs/DATA_SOURCING.md section 4.
 * They live in one place so that no calculation and no component can quietly
 * adopt a different convention.
 */

/** Identifier of the chronology selected when the user has not chosen one. */
export const DEFAULT_CHRONOLOGY_ID = 'masoretic';

/**
 * The alternate Masoretic reading, kept because it is a real disagreement rather
 * than an error.
 *
 * The default derives Abraham's birth offset from his father as 130, from Terah's
 * lifespan (GEN.11.32), Abraham's age at the departure from Haran (GEN.12.4) and
 * the statement that the departure followed Terah's death (ACT.7.4): 205 - 75 = 130.
 *
 * This variant instead reads the 70 of GEN.11.26 as Abraham's birth offset. That
 * verse gives one age for three sons and does not state that Abram was the eldest,
 * so the reading is an interpretation. It is never marked VERIFIED as an explicit
 * statement of Abraham's birth age.
 *
 * The two variants disagree about whether Noah and Abraham were ever alive at the
 * same time, so nothing may assume one of them silently.
 */
export const ALTERNATE_CHRONOLOGY_ID = 'masoretic-gen11-26';

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

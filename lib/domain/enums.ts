import { z } from 'zod';

/**
 * The enumerated vocabularies, defined once and mirrored by the database enums
 * in supabase/migrations/0001_enums.sql.
 *
 * source_type and confidence_level are separate axes and must stay separate
 * (requirement section 6). Source type says what kind of thing backs a claim;
 * confidence says how firm the value is. A SCHOLARLY_ESTIMATE source can back
 * an APPROXIMATE value; the two are not interchangeable.
 */

export const CONFIDENCE_LEVELS = [
  'EXPLICIT',
  'DERIVED',
  'APPROXIMATE',
  'DISPUTED',
  'UNKNOWN',
] as const;

export const SOURCE_TYPES = [
  'SCRIPTURE_EXPLICIT',
  'SCRIPTURE_DERIVED',
  'TEXTUAL_TRADITION',
  'HISTORICAL_SOURCE',
  'SCHOLARLY_ESTIMATE',
  'APPROXIMATE',
  'DISPUTED',
  'UNKNOWN',
] as const;

export const REVIEW_STATUSES = [
  'DRAFT',
  'SOURCE_CHECKED',
  'VERIFIED',
  'DISPUTED',
  'DEPRECATED',
] as const;

/**
 * Stored directly: parent, spouse, sibling where a text names one, tribe,
 * teacher, disciple, successor, predecessor, associatedWith.
 *
 * Computed by the engine from parent edges: ancestor, descendant, and
 * sibling-by-shared-parent. They remain in the vocabulary so a record can be
 * stored when a text asserts a relationship whose intermediate generations are
 * not given, but a seed may not use them without a note explaining why it is
 * not derivable (requirement section 14).
 */
export const RELATIONSHIP_TYPES = [
  'parent',
  'child',
  'spouse',
  'sibling',
  'ancestor',
  'descendant',
  'successor',
  'predecessor',
  'teacher',
  'disciple',
  'relative',
  'tribe',
  'associatedWith',
] as const;

export const DERIVABLE_RELATIONSHIP_TYPES = ['ancestor', 'descendant', 'child'] as const;

export const GENDERS = ['male', 'female', 'unknown'] as const;
export const DATE_TYPES = ['point', 'range', 'unknown'] as const;
export const APP_ROLES = ['user', 'editor', 'admin'] as const;

export const ConfidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export const RelationshipTypeSchema = z.enum(RELATIONSHIP_TYPES);
export const GenderSchema = z.enum(GENDERS);
export const DateTypeSchema = z.enum(DATE_TYPES);
export const AppRoleSchema = z.enum(APP_ROLES);

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export type Gender = (typeof GENDERS)[number];
export type DateType = (typeof DATE_TYPES)[number];
export type AppRole = (typeof APP_ROLES)[number];

/** Only VERIFIED records reach production calculations (requirement section 8). */
export function isProductionVisible(status: ReviewStatus): boolean {
  return status === 'VERIFIED';
}

/**
 * Review statuses ranked by how much trust they license, least first.
 *
 * DEPRECATED is the floor: nothing built on a superseded figure can be trusted
 * more than the figure itself. DISPUTED sits below the unreviewed states on
 * purpose — a contested reading is a stronger caution than one merely not yet
 * checked, and it is the label a reader most needs to see. VERIFIED is the
 * ceiling, and the only status section 8 lets reach production calculations.
 */
const REVIEW_STATUS_RANK: Readonly<Record<ReviewStatus, number>> = {
  DEPRECATED: 0,
  DISPUTED: 1,
  DRAFT: 2,
  SOURCE_CHECKED: 3,
  VERIFIED: 4,
};

export function reviewStatusRank(status: ReviewStatus): number {
  return REVIEW_STATUS_RANK[status];
}

/**
 * The weakest status among several: the trust a derived value inherits from
 * the chain of figures it rests on.
 *
 * A calculation is only as reviewed as its least-reviewed input, so a value
 * whose own figures are VERIFIED but which is computed from a DISPUTED ancestor
 * is DISPUTED, not VERIFIED. This is what stops the derivation quietly laundering
 * an unverified reading into a verified-looking date. With no arguments it is
 * VERIFIED: an empty chain constrains nothing, which makes it the identity for
 * folding a record's own status together with its dependencies'.
 */
export function weakestReviewStatus(...statuses: ReviewStatus[]): ReviewStatus {
  let weakest: ReviewStatus = 'VERIFIED';
  for (const status of statuses) {
    if (reviewStatusRank(status) < reviewStatusRank(weakest)) weakest = status;
  }
  return weakest;
}

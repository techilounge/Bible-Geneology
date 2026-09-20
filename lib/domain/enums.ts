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

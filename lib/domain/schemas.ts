import { z } from 'zod';
import {
  AppRoleSchema,
  ConfidenceLevelSchema,
  DateTypeSchema,
  GenderSchema,
  RelationshipTypeSchema,
  ReviewStatusSchema,
  SourceTypeSchema,
} from './enums';

/**
 * One schema definition serving three jobs: validating canonical JSON at build
 * time, validating API input at runtime, and deriving the TypeScript types.
 * Writing types separately from validators guarantees they diverge eventually.
 */

const Slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Identifiers are lowercase, hyphen-separated');

/** OSIS-style: GEN.5.21, GEN.5.21-27, ACT.7.4. */
const ScriptureRefId = z
  .string()
  .regex(
    /^[1-9A-Z]{3}\.\d+(\.\d+(-\d+)?)?$/,
    'Expected an OSIS-style reference like GEN.5.21',
  );

export const DerivationStepSchema = z.object({
  from: z.string(),
  to: z.string(),
  years: z.number().int(),
  reference: ScriptureRefId,
  runningTotal: z.number().int(),
});

export const DerivationSchema = z
  .object({
    method: z.string().min(1),
    unit: z.string().min(1),
    result: z.number().int(),
    steps: z.array(DerivationStepSchema).min(1),
    assumptions: z.array(Slug),
  })
  .refine(
    (d) => d.steps[d.steps.length - 1]?.runningTotal === d.result,
    'The final running total must equal the derivation result',
  )
  .refine((d) => {
    let total = 0;
    for (const step of d.steps) {
      total += step.years;
      if (step.runningTotal !== total) return false;
    }
    return true;
  }, 'Each running total must equal the sum of the years up to that step');

export const PersonSchema = z.object({
  id: Slug,
  canonicalName: z.string().min(1),
  slug: Slug,
  gender: GenderSchema.default('unknown'),
  description: z.string().nullable().default(null),
  eraId: Slug.nullable().default(null),
  sortOrder: z.number().int().nullable().default(null),
  primaryScriptureReferences: z.array(ScriptureRefId).default([]),
  reviewStatus: ReviewStatusSchema.default('DRAFT'),
});

export const ChronologySchema = z.object({
  id: Slug,
  name: z.string().min(1),
  description: z.string().min(1),
  epochLabel: z.string().min(1).default('AM'),
  isDefault: z.boolean().default(false),
  sourceId: Slug.nullable().default(null),
  notes: z.string().nullable().default(null),
});

/**
 * The refinements below are the runtime half of the database's
 * unknown_means_null constraint, so a bad record is rejected before it reaches
 * Postgres and gets a readable message instead of a constraint violation.
 */
export const PersonChronologySchema = z
  .object({
    personId: Slug,
    chronologyId: Slug,

    birthYear: z.number().int().nullable(),
    deathYear: z.number().int().nullable(),
    lifespan: z.number().int().nonnegative().nullable(),

    birthConfidence: ConfidenceLevelSchema,
    deathConfidence: ConfidenceLevelSchema,
    lifespanConfidence: ConfidenceLevelSchema,

    birthSourceType: SourceTypeSchema,
    deathSourceType: SourceTypeSchema,
    lifespanSourceType: SourceTypeSchema,

    /**
     * At least one. A chronology record without provenance cannot parse, which
     * is requirement section 5 enforced where it actually bites.
     */
    sourceReferences: z.array(ScriptureRefId).min(1),

    calculationMethod: z.string().nullable().default(null),
    derivation: DerivationSchema.nullable().default(null),
    notes: z.string().nullable().default(null),
    reviewStatus: ReviewStatusSchema.default('DRAFT'),
  })
  .refine(
    (v) => (v.birthConfidence === 'UNKNOWN') === (v.birthYear === null),
    'UNKNOWN birth confidence requires a null birth year, and vice versa',
  )
  .refine(
    (v) => (v.deathConfidence === 'UNKNOWN') === (v.deathYear === null),
    'UNKNOWN death confidence requires a null death year, and vice versa',
  )
  .refine(
    (v) => (v.lifespanConfidence === 'UNKNOWN') === (v.lifespan === null),
    'UNKNOWN lifespan confidence requires a null lifespan, and vice versa',
  )
  .refine(
    (v) => v.birthYear === null || v.deathYear === null || v.deathYear >= v.birthYear,
    'Death year cannot precede birth year',
  );

export const RelationshipSchema = z
  .object({
    sourcePersonId: Slug,
    targetPersonId: Slug,
    relationshipType: RelationshipTypeSchema,
    sourceReferences: z.array(ScriptureRefId).default([]),
    confidence: ConfidenceLevelSchema,
    sourceType: SourceTypeSchema,
    notes: z.string().nullable().default(null),
    reviewStatus: ReviewStatusSchema.default('DRAFT'),
  })
  .refine(
    (r) => r.sourcePersonId !== r.targetPersonId,
    'A person cannot hold a relationship to themselves',
  );

export const ScriptureReferenceSchema = z
  .object({
    id: ScriptureRefId,
    book: z.string().regex(/^[1-9A-Z]{3}$/),
    chapter: z.number().int().positive(),
    verseStart: z.number().int().positive().nullable().default(null),
    verseEnd: z.number().int().positive().nullable().default(null),
    canonicalKey: z.string().min(1),
    displayLabel: z.string().min(1),
  })
  .refine(
    (r) => r.verseEnd === null || r.verseStart === null || r.verseEnd >= r.verseStart,
    'Verse range must be ordered',
  );

export const SourceSchema = z.object({
  id: Slug,
  name: z.string().min(1),
  sourceType: SourceTypeSchema,
  citation: z.string().nullable().default(null),
  url: z.string().url().nullable().default(null),
  license: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

export const EventSchema = z.object({
  id: Slug,
  name: z.string().min(1),
  slug: Slug,
  description: z.string().nullable().default(null),
  eventType: z.string().nullable().default(null),
  relatedPersonIds: z.array(Slug).default([]),
  sourceReferences: z.array(ScriptureRefId).default([]),
  reviewStatus: ReviewStatusSchema.default('DRAFT'),
});

export const EventChronologySchema = z
  .object({
    eventId: Slug,
    chronologyId: Slug,
    startYear: z.number().int().nullable(),
    endYear: z.number().int().nullable(),
    dateType: DateTypeSchema,
    confidence: ConfidenceLevelSchema,
    sourceType: SourceTypeSchema,
    derivation: DerivationSchema.nullable().default(null),
    notes: z.string().nullable().default(null),
    reviewStatus: ReviewStatusSchema.default('DRAFT'),
  })
  .refine(
    (e) => (e.confidence === 'UNKNOWN') === (e.startYear === null),
    'UNKNOWN confidence requires a null start year, and vice versa',
  )
  .refine(
    (e) => e.endYear === null || e.startYear === null || e.endYear >= e.startYear,
    'Event end year cannot precede its start year',
  );

/** One interpretive choice, named, so a date can say what it depends on. */
export const AssumptionSchema = z.object({
  id: Slug,
  title: z.string().min(1),
  explanation: z.string().min(1),
  sourceReferences: z.array(ScriptureRefId).default([]),
});

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable().default(null),
  role: AppRoleSchema.default('user'),
  preferences: z.record(z.string(), z.unknown()).default({}),
});

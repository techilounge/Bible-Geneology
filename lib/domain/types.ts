import type { z } from 'zod';
import type {
  AssumptionSchema,
  ChronologySchema,
  DerivationSchema,
  DerivationStepSchema,
  EventChronologySchema,
  EventSchema,
  PersonChronologySchema,
  PersonSchema,
  ProfileSchema,
  RelationshipSchema,
  ScriptureReferenceSchema,
  SourceSchema,
} from './schemas';

/** Types are inferred from the schemas, never written twice. */
export type Person = z.infer<typeof PersonSchema>;
export type Chronology = z.infer<typeof ChronologySchema>;
export type PersonChronology = z.infer<typeof PersonChronologySchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type ScriptureReference = z.infer<typeof ScriptureReferenceSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type BiblicalEvent = z.infer<typeof EventSchema>;
export type EventChronology = z.infer<typeof EventChronologySchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Derivation = z.infer<typeof DerivationSchema>;
export type DerivationStep = z.infer<typeof DerivationStepSchema>;

/**
 * What the chronology engine receives. It is a parameter, never an import, so
 * the engine is identical whether the rows came from JSON on disk in a test or
 * from Postgres at runtime. That is what keeps it testable without a database.
 */
export interface ChronologyDataset {
  chronologyId: string;
  people: ReadonlyMap<string, Person>;
  personChronology: ReadonlyMap<string, PersonChronology>;
  relationships: readonly Relationship[];
  events: ReadonlyMap<string, BiblicalEvent>;
  eventChronology: ReadonlyMap<string, EventChronology>;
}

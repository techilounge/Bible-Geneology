import type {
  BiblicalEvent,
  EventChronology,
  Person,
  PersonChronology,
  Relationship,
} from '@/lib/domain';

/**
 * What every engine function receives. It is a parameter, never an import, so
 * the engine is identical whether the rows came from JSON on disk in a test or
 * from Postgres at runtime.
 */
export interface Dataset {
  chronologyId: string;
  people: ReadonlyMap<string, Person>;
  chronology: ReadonlyMap<string, PersonChronology>;
  relationships: readonly Relationship[];
  events: ReadonlyMap<string, BiblicalEvent>;
  eventChronology: ReadonlyMap<string, EventChronology>;
}

export interface DatasetInput {
  chronologyId: string;
  people: readonly Person[];
  chronology: readonly PersonChronology[];
  relationships: readonly Relationship[];
  events?: readonly BiblicalEvent[];
  eventChronology?: readonly EventChronology[];
}

export function buildDataset(input: DatasetInput): Dataset {
  return {
    chronologyId: input.chronologyId,
    people: new Map(input.people.map((p) => [p.id, p])),
    chronology: new Map(
      input.chronology
        .filter((c) => c.chronologyId === input.chronologyId)
        .map((c) => [c.personId, c]),
    ),
    relationships: input.relationships,
    events: new Map((input.events ?? []).map((e) => [e.id, e])),
    eventChronology: new Map(
      (input.eventChronology ?? [])
        .filter((e) => e.chronologyId === input.chronologyId)
        .map((e) => [e.eventId, e]),
    ),
  };
}

/**
 * A person's dated record, or null.
 *
 * Two distinct absences, deliberately not collapsed: the person may have no
 * record in this chronology at all, or may have a record whose years are
 * unknown. The Septuagint includes a generation the Masoretic text does not,
 * so "not present in this chronology" and "present but undated" are different
 * facts and get different wording in the UI.
 */
export function lookup(dataset: Dataset, personId: string): PersonChronology | null {
  return dataset.chronology.get(personId) ?? null;
}

export function isPresent(dataset: Dataset, personId: string): boolean {
  return dataset.chronology.has(personId);
}

export function hasDates(record: PersonChronology | null): record is PersonChronology & {
  birthYear: number;
  deathYear: number;
} {
  return record !== null && record.birthYear !== null && record.deathYear !== null;
}

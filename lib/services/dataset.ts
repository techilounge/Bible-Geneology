import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDataset, type Dataset } from '@/lib/chronology';
import {
  ALTERNATE_CHRONOLOGY_ID,
  DEFAULT_CHRONOLOGY_ID,
} from '@/lib/config/chronology-defaults';
import type {
  Assumption,
  BiblicalEvent,
  EventChronology,
  Person,
  PersonChronology,
  Relationship,
  ScriptureReference,
  Source,
} from '@/lib/domain';

/**
 * Reads the dataset from disk for the application.
 *
 * Git is the system of record through Phase 13 (ARCHITECTURE.md section 3),
 * so pages render from the canonical figures plus the derived chronology.
 * When Phase 13 moves reads to Supabase, this module is the seam that
 * changes; nothing above it takes a dependency on where the rows came from.
 *
 * `server-only` at the top is not decoration. These files include the whole
 * dataset, and a stray client import would ship it to the browser.
 */
const CANONICAL = join(process.cwd(), 'data', 'canonical');
const GENERATED = join(process.cwd(), 'data', 'generated');

function read<T>(dir: string, name: string): T {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T;
  } catch (error) {
    throw new Error(
      `Could not read ${name}. If it is under data/generated, run "npm run derive:chronology".`,
      { cause: error },
    );
  }
}

export interface PersonName {
  personId: string;
  name: string;
  nameType: string;
  language: string | null;
  notes: string | null;
}

export interface Era {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface Reference {
  reference: ScriptureReference;
  source: Source | null;
}

/**
 * Memoises a loader for the lifetime of the process in production, and not
 * at all in development.
 *
 * React's `cache` only memoises within a single render, which is the right
 * scope for request data and the wrong one for files that cannot change
 * while the process runs. In development it is the opposite: editing a
 * canonical JSON file and seeing nothing change is a bad half hour, so
 * development re-reads.
 */
function loadOnce<T>(load: () => T): () => T {
  if (process.env.NODE_ENV === 'development') return load;
  let value: T | undefined;
  let loaded = false;
  return () => {
    if (!loaded) {
      value = load();
      loaded = true;
    }
    return value as T;
  };
}

/**
 * Everything a page might need. The files are a few hundred kilobytes;
 * re-parsing them per component would be the kind of waste that only shows
 * up under load.
 */
export const getCanonical = loadOnce(() => ({
  people: read<Person[]>(CANONICAL, 'people.json'),
  personNames: read<PersonName[]>(CANONICAL, 'person-names.json'),
  relationships: read<Relationship[]>(CANONICAL, 'relationships.json'),
  events: read<BiblicalEvent[]>(CANONICAL, 'events.json'),
  references: read<ScriptureReference[]>(CANONICAL, 'scripture-references.json'),
  sources: read<Source[]>(CANONICAL, 'sources.json'),
  assumptions: read<Assumption[]>(CANONICAL, 'assumptions.json'),
  eras: read<Era[]>(CANONICAL, 'eras.json'),
}));

const datasets = new Map<string, Dataset>();

export const getDataset = (chronologyId: string = DEFAULT_CHRONOLOGY_ID): Dataset => {
  const cached = datasets.get(chronologyId);
  if (cached && process.env.NODE_ENV !== 'development') return cached;

  const canonical = getCanonical();
  const dataset = buildDataset({
    chronologyId,
    people: canonical.people,
    chronology: read<PersonChronology[]>(
      GENERATED,
      `person-chronology.${chronologyId}.json`,
    ),
    relationships: canonical.relationships,
    events: canonical.events,
    eventChronology: read<EventChronology[]>(
      GENERATED,
      `event-chronology.${chronologyId}.json`,
    ),
  });
  datasets.set(chronologyId, dataset);
  return dataset;
};

export const getChronologyIds = () =>
  [DEFAULT_CHRONOLOGY_ID, ALTERNATE_CHRONOLOGY_ID] as const;

export const getPersonBySlug = (slug: string): Person | null =>
  getCanonical().people.find((p) => p.slug === slug) ?? null;

export const getNamesFor = (personId: string): PersonName[] =>
  getCanonical().personNames.filter((n) => n.personId === personId);

/**
 * Resolves reference ids to the reference records, dropping nothing
 * silently: an id that does not resolve is a validation failure, and the
 * validator fails the build on it, so anything reaching here resolves.
 */
export const resolveReferences = (ids: readonly string[]): ScriptureReference[] => {
  const byId = new Map(getCanonical().references.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is ScriptureReference => r !== undefined);
};

export const getAssumptions = (ids: readonly string[]): Assumption[] => {
  const byId = new Map(getCanonical().assumptions.map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)).filter((a): a is Assumption => a !== undefined);
};

export const getEras = (): Era[] =>
  [...getCanonical().eras].sort((a, b) => a.sortOrder - b.sortOrder);

export const getEvent = (eventId: string): BiblicalEvent | null =>
  getCanonical().events.find((e) => e.id === eventId) ?? null;

/** Display name for a person id, for prose and link text. */
export const nameOf = (personId: string): string => {
  const person = getCanonical().people.find((p) => p.id === personId);
  return person?.canonicalName ?? personId;
};

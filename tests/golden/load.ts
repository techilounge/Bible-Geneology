import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDataset, type Dataset } from '@/lib/chronology';
import type {
  BiblicalEvent,
  EventChronology,
  Person,
  PersonChronology,
  Relationship,
} from '@/lib/domain';

/**
 * Loads the dataset the golden suite asserts against.
 *
 * The chronology comes from data/generated, not data/canonical, because the
 * point is to test the numbers the application will actually use — the
 * figures a human read from the text *plus* the engine's arithmetic over
 * them. Asserting against the canonical figures alone would test the
 * transcription and nothing else.
 */
const CANONICAL = join(process.cwd(), 'data', 'canonical');
const GENERATED = join(process.cwd(), 'data', 'generated');

function read<T>(path: string, hint?: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (error) {
    if (hint && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${path} is missing. ${hint}`, { cause: error });
    }
    throw error;
  }
}

export function loadDerived(chronologyId: string): Dataset {
  const records = read<PersonChronology[]>(
    join(GENERATED, `person-chronology.${chronologyId}.json`),
    'Run "npm run derive:chronology" before the golden suite.',
  );

  return buildDataset({
    chronologyId,
    people: read<Person[]>(join(CANONICAL, 'people.json')),
    chronology: records,
    relationships: read<Relationship[]>(join(CANONICAL, 'relationships.json')),
    events: read<BiblicalEvent[]>(join(CANONICAL, 'events.json')),
    eventChronology: read<EventChronology[]>(
      join(GENERATED, `event-chronology.${chronologyId}.json`),
      'Run "npm run derive:chronology" before the golden suite.',
    ),
  });
}

export function loadDerivedRecords(chronologyId: string): PersonChronology[] {
  return read<PersonChronology[]>(
    join(GENERATED, `person-chronology.${chronologyId}.json`),
    'Run "npm run derive:chronology" before the golden suite.',
  );
}

export function loadDerivedEvents(chronologyId: string): EventChronology[] {
  return read<EventChronology[]>(
    join(GENERATED, `event-chronology.${chronologyId}.json`),
    'Run "npm run derive:chronology" before the golden suite.',
  );
}

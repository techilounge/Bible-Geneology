import type {
  BiblicalEvent,
  EventChronology,
  Person,
  PersonChronology,
  Relationship,
} from '@/lib/domain';
import { buildDataset, type Dataset } from '../dataset';

/**
 * Synthetic fixtures. The numbers here are round and obviously invented,
 * chosen to exercise boundaries rather than to resemble the real dataset.
 *
 * Deliberately not the canonical Genesis figures: an engine test should fail
 * when the engine is wrong, not when the dataset changes, and the two suites
 * are kept separate for that reason. The real values are asserted by the
 * golden suite in tests/golden once they have been sourced.
 *
 * The shape of the fixture:
 *
 *   ancestor   0 ─────────── 100
 *   parent          50 ─────────── 150
 *   child                100 ─────── 150      born exactly when ancestor dies
 *   cousin          50 ──── 90                 shares a parent with nobody
 *   openended  10 ──?                          lifespan known, no recorded death
 *   undated    ?                               present, no dates at all
 *   (absent)                                   no record in this chronology
 */
function person(id: string, gender: Person['gender'] = 'male'): Person {
  return {
    id,
    canonicalName: id[0]?.toUpperCase() + id.slice(1),
    slug: id,
    gender,
    description: null,
    eraId: null,
    sortOrder: null,
    primaryScriptureReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT',
  };
}

function dated(
  personId: string,
  birthYear: number | null,
  deathYear: number | null,
  lifespan: number | null,
): PersonChronology {
  const u = (v: number | null) =>
    v === null ? ('UNKNOWN' as const) : ('DERIVED' as const);
  return {
    personId,
    chronologyId: 'fixture',
    birthYear,
    deathYear,
    lifespan,
    birthConfidence: u(birthYear),
    deathConfidence: u(deathYear),
    lifespanConfidence: lifespan === null ? 'UNKNOWN' : 'EXPLICIT',
    birthSourceType: birthYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    deathSourceType: deathYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    lifespanSourceType: lifespan === null ? 'UNKNOWN' : 'SCRIPTURE_EXPLICIT',
    sourceReferences: ['GEN.5.1'],
    calculationMethod: null,
    derivation:
      birthYear === null
        ? null
        : {
            method: 'fixture',
            unit: 'AM',
            result: birthYear,
            steps: [
              {
                from: 'origin',
                to: personId,
                years: birthYear,
                reference: 'GEN.5.1',
                runningTotal: birthYear,
              },
            ],
            assumptions: ['adam-created-at-year-zero'],
          },
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

function parent(source: string, target: string): Relationship {
  return {
    sourcePersonId: source,
    targetPersonId: target,
    relationshipType: 'parent',
    sourceReferences: ['GEN.5.1'],
    confidence: 'EXPLICIT',
    sourceType: 'SCRIPTURE_EXPLICIT',
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

const EVENTS: BiblicalEvent[] = [
  {
    id: 'mid-event',
    name: 'Mid event',
    slug: 'mid-event',
    description: null,
    eventType: null,
    relatedPersonIds: [],
    sourceReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT',
  },
  {
    id: 'undated-event',
    name: 'Undated event',
    slug: 'undated-event',
    description: null,
    eventType: null,
    relatedPersonIds: [],
    sourceReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT',
  },
];

const EVENT_DATES: EventChronology[] = [
  {
    eventId: 'mid-event',
    chronologyId: 'fixture',
    startYear: 60,
    endYear: 60,
    dateType: 'point',
    confidence: 'DERIVED',
    sourceType: 'SCRIPTURE_DERIVED',
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
  },
  {
    eventId: 'undated-event',
    chronologyId: 'fixture',
    startYear: null,
    endYear: null,
    dateType: 'unknown',
    confidence: 'UNKNOWN',
    sourceType: 'UNKNOWN',
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
  },
];

export function fixtureDataset(): Dataset {
  return buildDataset({
    chronologyId: 'fixture',
    people: [
      person('ancestor'),
      person('parent'),
      person('child'),
      person('cousin'),
      person('openended'),
      person('undated', 'female'),
      person('absent'),
    ],
    chronology: [
      dated('ancestor', 0, 100, 100),
      dated('parent', 50, 150, 100),
      dated('child', 100, 150, 50),
      dated('cousin', 50, 90, 40),
      dated('openended', 10, null, 200),
      dated('undated', null, null, null),
      // 'absent' deliberately has no record in this chronology.
    ],
    relationships: [
      parent('ancestor', 'parent'),
      parent('parent', 'child'),
      parent('ancestor', 'cousin'),
      parent('undated', 'child'),
    ],
    events: EVENTS,
    eventChronology: EVENT_DATES,
  });
}

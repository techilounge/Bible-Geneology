import type { Person, PersonChronology, Relationship } from '@/lib/domain';
import { buildDataset, type Dataset } from '@/lib/chronology';

/**
 * A synthetic dataset big enough to ask every kind of question of.
 *
 * Round, obviously invented numbers, for the same reason the chronology
 * fixtures use them: a generator test should fail when a generator is
 * wrong, not when the canonical dataset changes. The real dataset is
 * asserted in tests/golden.
 *
 * Eight people in a single line of descent, born a century apart and
 * living three centuries each, so lifetimes overlap in every combination
 * the modes need. Two extras share the name "Twin", which is how the
 * duplicate-label case gets exercised: the dataset really does hold two
 * men called Nahor.
 */
function person(id: string, name = id[0]?.toUpperCase() + id.slice(1)): Person {
  return {
    id,
    canonicalName: name,
    slug: id,
    gender: 'male',
    description: null,
    eraId: null,
    sortOrder: null,
    primaryScriptureReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT',
  };
}

function record(
  personId: string,
  birthYear: number | null,
  deathYear: number | null,
  lifespan: number | null,
): PersonChronology {
  return {
    personId,
    chronologyId: 'fixture',
    birthYear,
    deathYear,
    lifespan,
    birthConfidence: birthYear === null ? 'UNKNOWN' : 'DERIVED',
    deathConfidence: deathYear === null ? 'UNKNOWN' : 'DERIVED',
    lifespanConfidence: lifespan === null ? 'UNKNOWN' : 'EXPLICIT',
    birthSourceType: birthYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    deathSourceType: deathYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    lifespanSourceType: lifespan === null ? 'UNKNOWN' : 'SCRIPTURE_EXPLICIT',
    sourceReferences: [`GEN.5.${(birthYear ?? 0) % 30}`],
    calculationMethod: null,
    derivation: null,
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

const LINE = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

export function quizFixture(): Dataset {
  return buildDataset({
    chronologyId: 'fixture',
    people: [
      ...LINE.map((id) => person(id)),
      person('twin-one', 'Twin'),
      person('twin-two', 'Twin'),
      person('matriarch'),
      person('undated'),
    ],
    chronology: [
      // Born a century apart, each living a little less than the last, so
      // no two lifespans are equal and no two births coincide.
      ...LINE.map((id, index) =>
        record(id, index * 100, index * 100 + 300 - index, 300 - index),
      ),
      record('twin-one', 50, 260, 210),
      record('twin-two', 60, 265, 205),
      // Named as a second parent and given no dates of her own, which is
      // the shape most of the women in the real dataset have.
      record('matriarch', null, null, null),
      record('undated', null, null, null),
    ],
    relationships: [
      ...LINE.slice(1).map((id, index) => parent(LINE[index] as string, id)),
      parent('alpha', 'twin-one'),
      parent('alpha', 'twin-two'),
      parent('matriarch', 'charlie'),
    ],
  });
}

/**
 * Three dated people, two of them sharing a name and a birth year.
 *
 * Every mode that needs elbow room — three distractors, three distinct
 * birth years, two distinguishable names — runs out of it here, which is
 * how the "no question exists" paths are exercised.
 */
export function crowdedFixture(): Dataset {
  return buildDataset({
    chronologyId: 'fixture',
    people: [person('alpha'), person('twin-one', 'Twin'), person('twin-two', 'Twin')],
    chronology: [
      record('alpha', 0, 200, 200),
      record('twin-one', 10, 110, 100),
      record('twin-two', 10, 120, 110),
    ],
    relationships: [parent('alpha', 'twin-one'), parent('alpha', 'twin-two')],
  });
}

/**
 * A line of descent recorded without any Scripture reference behind it.
 *
 * The canonical dataset has none of these — the validator would fail the
 * build — but a question that cannot cite anything must not be asked, and
 * this is what proves it is not.
 */
export function unsourcedFixture(): Dataset {
  const unsourced = (source: string, target: string): Relationship => ({
    ...parent(source, target),
    sourceReferences: [],
  });
  const ids = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
  return buildDataset({
    chronologyId: 'fixture',
    people: ids.map((id) => person(id)),
    chronology: ids.map((id, index) =>
      record(id, index * 100, index * 100 + 300 - index, 300 - index),
    ),
    relationships: [unsourced('alpha', 'bravo'), unsourced('bravo', 'charlie')],
  });
}

/** A dataset with nobody in it, for the "no question exists" paths. */
export function emptyFixture(): Dataset {
  return buildDataset({
    chronologyId: 'fixture',
    people: [],
    chronology: [],
    relationships: [],
  });
}

/** Two people, both undated: present, and impossible to ask about. */
export function undatedFixture(): Dataset {
  return buildDataset({
    chronologyId: 'fixture',
    people: [person('alpha'), person('bravo')],
    chronology: [record('alpha', null, null, null), record('bravo', null, null, null)],
    relationships: [parent('alpha', 'bravo')],
  });
}

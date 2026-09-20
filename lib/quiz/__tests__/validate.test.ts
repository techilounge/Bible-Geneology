import { describe, expect, it } from 'vitest';
import { buildDataset, type Dataset } from '@/lib/chronology';
import type { Person, PersonChronology, Relationship } from '@/lib/domain';
import { generateQuestion } from '../generate';
import { markFromEngine } from '../validate';
import { QUIZ_MODES, type EngineCheck, type Question } from '../types';
import { crowdedFixture, quizFixture, unsourcedFixture } from './fixtures';

/**
 * The marker, asked directly.
 *
 * Every branch here is a case where the engine declines to mark a
 * question — two people the records cannot separate, a clue that fits
 * more than one person, an option nothing can be said about. Declining is
 * the behaviour that matters: an unmarkable question is dropped, never
 * shown with a guess attached.
 */
function person(id: string, name = id): Person {
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
    birthConfidence: 'DERIVED',
    deathConfidence: 'DERIVED',
    lifespanConfidence: 'EXPLICIT',
    birthSourceType: 'SCRIPTURE_DERIVED',
    deathSourceType: 'SCRIPTURE_DERIVED',
    lifespanSourceType: 'SCRIPTURE_EXPLICIT',
    sourceReferences: ['GEN.5.1'],
    calculationMethod: null,
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

function parentOf(source: string, target: string): Relationship {
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

/** Two people born in the same year, living equally long, same parent. */
const twins: Dataset = buildDataset({
  chronologyId: 'fixture',
  people: [person('root'), person('one'), person('two')],
  chronology: [
    record('root', 0, 300, 300),
    record('one', 100, 200, 100),
    record('two', 100, 200, 100),
  ],
  relationships: [parentOf('root', 'one'), parentOf('root', 'two')],
});

function question(check: EngineCheck, optionIds: readonly string[]): Question {
  return {
    id: 'test',
    mode: 'who-lived-longer',
    chronologyId: 'fixture',
    prompt: 'test',
    population: 'the 3 of 3 people this chronology gives both a birth and a death',
    options: optionIds.map((id) => ({ id, label: id })),
    answerIds: [],
    ordered: false,
    explanation: 'test',
    working: [],
    personIds: [],
    sourceReferences: [],
    check,
    aboutOverlap: false,
  };
}

describe('the marker declines rather than guesses', () => {
  it('will not say who lived longer when the two lived equally long', () => {
    expect(
      markFromEngine(
        twins,
        question({ kind: 'longer-lifespan', personAId: 'one', personBId: 'two' }, [
          'one',
          'two',
        ]),
      ),
    ).toBeNull();
  });

  it('will not answer about somebody with no record', () => {
    expect(
      markFromEngine(
        twins,
        question({ kind: 'alive-at-birth', personId: 'root', otherPersonId: 'ghost' }, [
          'yes',
          'no',
        ]),
      ),
    ).toBeNull();
    expect(
      markFromEngine(
        twins,
        question(
          { kind: 'age-at-other-birth', personId: 'root', otherPersonId: 'ghost' },
          ['1'],
        ),
      ),
    ).toBeNull();
  });

  it('will not give an age for somebody who was not alive at that birth', () => {
    const later = buildDataset({
      chronologyId: 'fixture',
      people: [person('early'), person('late')],
      chronology: [record('early', 0, 100, 100), record('late', 200, 300, 100)],
      relationships: [],
    });
    expect(
      markFromEngine(
        later,
        question(
          { kind: 'age-at-other-birth', personId: 'early', otherPersonId: 'late' },
          ['0'],
        ),
      ),
    ).toBeNull();
  });

  it('will not order two births it cannot separate', () => {
    expect(
      markFromEngine(twins, question({ kind: 'birth-order' }, ['one', 'two'])),
    ).toBeNull();
  });

  it('orders the births it can separate', () => {
    const marking = markFromEngine(
      twins,
      question({ kind: 'birth-order' }, ['one', 'root']),
    );
    expect(marking?.answerIds).toEqual(['root', 'one']);
  });

  it('will not treat an option that is not a year as a year', () => {
    expect(
      markFromEngine(
        twins,
        question({ kind: 'born-in-year', personId: 'one' }, ['100', 'not-a-year']),
      ),
    ).toBeNull();
  });

  it('will not identify a person when the clues fit two of them', () => {
    expect(
      markFromEngine(
        twins,
        question({ kind: 'identified-by', lifespan: 100, parentId: 'root' }, [
          'one',
          'two',
        ]),
      ),
    ).toBeNull();
  });

  it('identifies a person when the clues fit exactly one', () => {
    const marking = markFromEngine(
      twins,
      question({ kind: 'identified-by', lifespan: 300, parentId: 'root' }, ['root']),
    );
    expect(marking).toBeNull();

    const dataset = buildDataset({
      chronologyId: 'fixture',
      people: [person('root'), person('only')],
      chronology: [record('root', 0, 300, 300), record('only', 50, 150, 100)],
      relationships: [parentOf('root', 'only')],
    });
    expect(
      markFromEngine(
        dataset,
        question({ kind: 'identified-by', lifespan: 100, parentId: 'root' }, [
          'only',
          'root',
        ]),
      ),
    ).toEqual({ answerIds: ['only'], confirmedWrong: ['root'] });
  });
});

describe('a dataset with no elbow room', () => {
  const dataset = crowdedFixture();

  it('asks nothing that needs three distractors or three distinct births', () => {
    for (const mode of ['who-was-alive', 'put-them-in-order', 'who-am-i'] as const) {
      expect(generateQuestion(dataset, mode, 'crowded'), mode).toBeNull();
    }
  });

  it('still asks the questions it can, and never offers one name twice', () => {
    const asked = QUIZ_MODES.map((mode) =>
      generateQuestion(dataset, mode, 'crowded'),
    ).filter((entry): entry is Question => entry !== null);
    expect(asked.length).toBeGreaterThan(0);
    for (const entry of asked) {
      const labels = entry.options.map((option) => option.label);
      expect(new Set(labels).size, entry.id).toBe(labels.length);
    }
  });
});

describe('a question that could cite nothing is not asked', () => {
  it('refuses an ancestry question whose parent rows have no reference', () => {
    expect(
      generateQuestion(unsourcedFixture(), 'family-connection', 'unsourced'),
    ).toBeNull();
  });
});

describe('a second parent is ordered, not picked at random', () => {
  it('always names the same parent in the clue', () => {
    // 'charlie' has two recorded parents in the fixture.
    const first = generateQuestion(quizFixture(), 'who-am-i', 'parents');
    const again = generateQuestion(quizFixture(), 'who-am-i', 'parents');
    expect(first?.prompt).toBe(again?.prompt);
  });
});

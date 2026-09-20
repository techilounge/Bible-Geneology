import { describe, expect, it } from 'vitest';
import { generateQuestion, generateQuiz, isCorrectAnswer } from '../generate';
import { markFromEngine, validateQuestion } from '../validate';
import { QUIZ_MODES, type Question } from '../types';
import { emptyFixture, quizFixture, undatedFixture } from './fixtures';

/**
 * The Phase 12 exit gate over the synthetic fixture: every question that
 * is generated is marked by the engine before it is returned, and a
 * question the engine cannot mark is not returned at all.
 */
const dataset = quizFixture();
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function sample(): Question[] {
  return QUIZ_MODES.flatMap((mode) =>
    SEEDS.map((seed) => generateQuestion(dataset, mode, seed)).filter(
      (question): question is Question => question !== null,
    ),
  );
}

describe('generateQuestion', () => {
  it('produces a question for every mode', () => {
    for (const mode of QUIZ_MODES) {
      const questions = SEEDS.map((seed) => generateQuestion(dataset, mode, seed));
      expect(questions.filter(Boolean).length, mode).toBeGreaterThan(0);
    }
  });

  it('produces the same question for the same seed, every time', () => {
    for (const mode of QUIZ_MODES) {
      expect(generateQuestion(dataset, mode, 'stable')).toEqual(
        generateQuestion(dataset, mode, 'stable'),
      );
    }
  });

  it('gives the question an id built from its mode and seed', () => {
    for (const mode of QUIZ_MODES) {
      const question = generateQuestion(dataset, mode, 'ident');
      if (question) expect(question.id).toBe(`${mode}-ident`);
    }
  });

  it('never returns a question the engine disagrees with', () => {
    for (const question of sample()) {
      expect(validateQuestion(dataset, question), question.id).toBe(true);
    }
  });

  it('offers at least two options, one of which is the answer', () => {
    for (const question of sample()) {
      const ids = question.options.map((option) => option.id);
      expect(ids.length, question.id).toBeGreaterThanOrEqual(2);
      expect(question.answerIds.length, question.id).toBeGreaterThan(0);
      for (const answer of question.answerIds) expect(ids).toContain(answer);
    }
  });

  it('never offers the same label twice', () => {
    for (const question of sample()) {
      const labels = question.options.map((option) => option.label);
      expect(new Set(labels).size, question.id).toBe(labels.length);
    }
  });

  it('carries the working, the sources and the population every time', () => {
    for (const question of sample()) {
      expect(question.working.length, question.id).toBeGreaterThan(0);
      expect(question.sourceReferences.length, question.id).toBeGreaterThan(0);
      expect(question.population, question.id).toMatch(/\d+ of \d+ people/);
      expect(question.explanation.length, question.id).toBeGreaterThan(10);
    }
  });

  it('names only people the dataset holds', () => {
    for (const question of sample()) {
      for (const personId of question.personIds) {
        expect(dataset.people.has(personId), `${question.id} names ${personId}`).toBe(
          true,
        );
      }
    }
  });

  it('marks the overlap questions as being about an overlap', () => {
    const overlap = sample().filter((q) => q.mode === 'could-lifetimes-overlap');
    expect(overlap.length).toBeGreaterThan(0);
    for (const question of overlap) expect(question.aboutOverlap).toBe(true);
  });

  it('has nothing to ask about an empty dataset', () => {
    for (const mode of QUIZ_MODES) {
      expect(generateQuestion(emptyFixture(), mode, 'x'), mode).toBeNull();
    }
  });

  it('has nothing to ask when nobody has dates', () => {
    for (const mode of QUIZ_MODES) {
      expect(generateQuestion(undatedFixture(), mode, 'x'), mode).toBeNull();
    }
  });
});

describe('a round', () => {
  it('runs through the modes in order', () => {
    const round = generateQuiz(dataset, 'round', 4);
    expect(round.map((question) => question.mode)).toEqual(QUIZ_MODES.slice(0, 4));
  });

  it('is the same round for the same seed', () => {
    expect(generateQuiz(dataset, 'round', 8)).toEqual(generateQuiz(dataset, 'round', 8));
  });

  it('asks a different round for a different seed', () => {
    const a = generateQuiz(dataset, 'one', 8).map((q) => q.prompt);
    const b = generateQuiz(dataset, 'two', 8).map((q) => q.prompt);
    expect(a).not.toEqual(b);
  });

  it('can be asked for a single mode', () => {
    const round = generateQuiz(dataset, 'single', 3, ['who-lived-longer']);
    expect(round.map((q) => q.mode)).toEqual([
      'who-lived-longer',
      'who-lived-longer',
      'who-lived-longer',
    ]);
  });

  it('asks for nothing when asked for nothing', () => {
    expect(generateQuiz(dataset, 'none', 0)).toEqual([]);
    expect(generateQuiz(dataset, 'none', 3, [])).toEqual([]);
  });

  it('leaves out the questions the dataset cannot support', () => {
    expect(generateQuiz(undatedFixture(), 'round', 8)).toEqual([]);
  });
});

describe('marking an answer', () => {
  const ordered = generateQuestion(dataset, 'put-them-in-order', 'marking');
  const single = generateQuestion(dataset, 'who-lived-longer', 'marking');

  it('accepts the right answer and refuses the wrong one', () => {
    expect(single).not.toBeNull();
    if (!single) return;
    expect(isCorrectAnswer(single, single.answerIds)).toBe(true);
    const wrong = single.options.find((o) => !single.answerIds.includes(o.id));
    expect(isCorrectAnswer(single, wrong ? [wrong.id] : [])).toBe(false);
    expect(isCorrectAnswer(single, [])).toBe(false);
  });

  it('requires the right order where the order is the question', () => {
    expect(ordered).not.toBeNull();
    if (!ordered) return;
    expect(ordered.ordered).toBe(true);
    expect(isCorrectAnswer(ordered, ordered.answerIds)).toBe(true);
    expect(isCorrectAnswer(ordered, [...ordered.answerIds].reverse())).toBe(false);
    expect(isCorrectAnswer(ordered, ordered.answerIds.slice(0, 2))).toBe(false);
  });
});

describe('the validator is not a formality', () => {
  const question = generateQuestion(dataset, 'who-lived-longer', 'tamper');

  it('rejects a question whose answer has been changed', () => {
    expect(question).not.toBeNull();
    if (!question) return;
    const wrong = question.options.find((o) => !question.answerIds.includes(o.id));
    expect(wrong).toBeDefined();
    expect(validateQuestion(dataset, { ...question, answerIds: [wrong?.id ?? ''] })).toBe(
      false,
    );
  });

  it('rejects a question offering an option the engine cannot rule out', () => {
    const alive = generateQuestion(dataset, 'who-was-alive', 'tamper');
    expect(alive).not.toBeNull();
    if (!alive) return;
    // 'undated' has no dates, so the engine can say neither yes nor no.
    const tampered = {
      ...alive,
      options: [...alive.options, { id: 'undated', label: 'Undated' }],
    };
    expect(validateQuestion(dataset, tampered)).toBe(false);
    expect(markFromEngine(dataset, tampered)).toBeNull();
  });

  it('rejects an ordering the engine puts differently', () => {
    const order = generateQuestion(dataset, 'put-them-in-order', 'tamper');
    expect(order).not.toBeNull();
    if (!order) return;
    expect(
      validateQuestion(dataset, { ...order, answerIds: [...order.answerIds].reverse() }),
    ).toBe(false);
  });

  it('refuses to mark a question about somebody it has never heard of', () => {
    expect(question).not.toBeNull();
    if (!question) return;
    expect(
      markFromEngine(dataset, {
        ...question,
        check: { kind: 'longer-lifespan', personAId: 'nobody', personBId: 'alpha' },
      }),
    ).toBeNull();
  });
});

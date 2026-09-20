import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALTERNATE_CHRONOLOGY_ID,
  DEFAULT_CHRONOLOGY_ID,
} from '@/lib/config/chronology-defaults';
import {
  QUIZ_MODES,
  generateQuestion,
  generateQuiz,
  markFromEngine,
  type Question,
  type QuizMode,
} from '@/lib/quiz';
import type { ScriptureReference } from '@/lib/domain';
import { loadDerived } from './load';

/**
 * The Phase 12 exit gate, over the real dataset.
 *
 * Requirement section 37: every generated question's answer is validated
 * against the chronology engine at generation time, and a test generates
 * a large sample across all modes and asserts each answer matches an
 * engine call. That is what this file is. The sample is eight modes by a
 * hundred seeds, and every question in it is marked again here, through
 * `markFromEngine`, so the assertion does not rest on the generator
 * having called the validator.
 */
const dataset = loadDerived(DEFAULT_CHRONOLOGY_ID);
const SEEDS = Array.from({ length: 100 }, (_, index) => `seed-${index}`);

const references = new Set(
  (
    JSON.parse(
      readFileSync(
        join(process.cwd(), 'data', 'canonical', 'scripture-references.json'),
        'utf8',
      ),
    ) as ScriptureReference[]
  ).map((reference) => reference.id),
);

function sampleFor(mode: QuizMode): Question[] {
  return SEEDS.map((seed) => generateQuestion(dataset, mode, seed)).filter(
    (question): question is Question => question !== null,
  );
}

const sample = QUIZ_MODES.flatMap((mode) => sampleFor(mode));

describe('the sample itself', () => {
  it('produces a question for every seed in every mode', () => {
    for (const mode of QUIZ_MODES) {
      expect(sampleFor(mode).length, mode).toBe(SEEDS.length);
    }
    expect(sample.length).toBe(QUIZ_MODES.length * SEEDS.length);
  });
});

describe('every answer matches an engine call', () => {
  it.each(QUIZ_MODES)('%s', (mode) => {
    for (const question of sampleFor(mode)) {
      const marking = markFromEngine(dataset, question);
      expect(marking, `${question.id}: the engine could not mark it`).not.toBeNull();
      if (!marking) continue;

      if (question.ordered) {
        expect(marking.answerIds, question.prompt).toEqual([...question.answerIds]);
      } else {
        expect([...marking.answerIds].sort(), question.prompt).toEqual(
          [...question.answerIds].sort(),
        );
      }

      // Every option that is not the answer is ruled out by the engine,
      // not merely absent from it: a distractor that is also correct is
      // the failure a single-answer check cannot see.
      if (!question.ordered) {
        for (const option of question.options) {
          if (question.answerIds.includes(option.id)) continue;
          expect(
            marking.confirmedWrong,
            `${question.prompt} / ${option.label}`,
          ).toContain(option.id);
        }
      }
    }
  });
});

describe('every question is reproducible', () => {
  it('produces the identical question from the identical seed', () => {
    for (const mode of QUIZ_MODES) {
      for (const seed of SEEDS.slice(0, 20)) {
        expect(generateQuestion(dataset, mode, seed)).toEqual(
          generateQuestion(dataset, mode, seed),
        );
      }
    }
  });

  it('produces the identical round from the identical seed', () => {
    expect(generateQuiz(dataset, 'daily-2026-09-20')).toEqual(
      generateQuiz(dataset, 'daily-2026-09-20'),
    );
  });
});

describe('every question rests on records that exist', () => {
  it('names only people in the dataset', () => {
    for (const question of sample) {
      for (const personId of question.personIds) {
        expect(dataset.people.has(personId), `${question.id} names ${personId}`).toBe(
          true,
        );
      }
    }
  });

  it('cites only references the dataset holds', () => {
    for (const question of sample) {
      expect(question.sourceReferences.length, question.id).toBeGreaterThan(0);
      for (const reference of question.sourceReferences) {
        expect(references.has(reference), `${question.id} cites ${reference}`).toBe(true);
      }
    }
  });

  it('shows the working and names the population every time', () => {
    for (const question of sample) {
      expect(question.working.length, question.id).toBeGreaterThan(0);
      expect(question.population, question.id).toMatch(
        /\d+ of \d+ people this chronology gives both a birth and a death/,
      );
    }
  });
});

describe('nothing a question says turns an overlap into a meeting', () => {
  const banned = [
    /\bmust have met\b/i,
    /\bwould have met\b/i,
    /\bknew each other\b/i,
    /\bpassed down\b/i,
    /\bhanded down\b/i,
    /\blearned from\b/i,
    /\btaught\b/i,
  ];

  it.each(banned.map((pattern) => [pattern.source, pattern] as const))(
    'no prompt or explanation matches %s',
    (_label, pattern) => {
      const offenders = sample
        .filter(
          (question) =>
            pattern.test(question.prompt) || pattern.test(question.explanation),
        )
        .map((question) => question.id);
      expect(offenders).toEqual([]);
    },
  );

  it('says outright that shared years are not a meeting, where it matters', () => {
    const overlaps = sample.filter(
      (question) => question.mode === 'could-lifetimes-overlap',
    );
    expect(overlaps.length).toBeGreaterThan(0);
    for (const question of overlaps) expect(question.aboutOverlap).toBe(true);
  });
});

describe('the questions are not all the same question', () => {
  it('asks about a spread of people', () => {
    const named = new Set(sample.flatMap((question) => question.personIds));
    expect(named.size).toBeGreaterThan(20);
  });

  it('has both a yes and a no among the overlap questions', () => {
    const answers = new Set(
      sampleFor('could-lifetimes-overlap').flatMap((question) => question.answerIds),
    );
    expect(answers).toEqual(new Set(['yes', 'no']));
  });

  it('asks different questions of different seeds', () => {
    // "Put them in order" asks the same sentence every time; what varies
    // is who is in it, so the comparison is on the whole question rather
    // than on the prompt alone.
    for (const mode of QUIZ_MODES) {
      const asked = new Set(
        sampleFor(mode).map(
          (question) =>
            `${question.prompt}|${question.options.map((o) => o.id).join(',')}`,
        ),
      );
      expect(asked.size, mode).toBeGreaterThan(5);
    }
  });
});

describe('the alternate chronology asks its own questions', () => {
  const alternate = loadDerived(ALTERNATE_CHRONOLOGY_ID);

  it('marks its questions against its own figures', () => {
    for (const mode of QUIZ_MODES) {
      for (const seed of SEEDS.slice(0, 25)) {
        const question = generateQuestion(alternate, mode, seed);
        expect(question, `${mode}/${seed}`).not.toBeNull();
        if (question) {
          expect(question.chronologyId).toBe(ALTERNATE_CHRONOLOGY_ID);
          expect(markFromEngine(alternate, question)).not.toBeNull();
        }
      }
    }
  });

  it('gives a different answer somewhere, because the years differ', () => {
    // The two chronologies disagree about Abraham's birth year, so the
    // same seed can reach a different answer. If every question matched,
    // the questions would not be reading the chronology at all.
    const under = (source: typeof dataset) =>
      QUIZ_MODES.flatMap((mode) =>
        SEEDS.slice(0, 40).map(
          (seed) => generateQuestion(source, mode, seed)?.explanation ?? '',
        ),
      );
    expect(under(alternate)).not.toEqual(under(dataset));
  });
});

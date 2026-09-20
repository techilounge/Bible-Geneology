import type { Dataset } from '@/lib/chronology';
import { GENERATORS } from './generators';
import { createRandom } from './random';
import { QUIZ_MODES, type Question, type QuizMode } from './types';
import { validateQuestion } from './validate';

/**
 * Generating a question, and refusing to show one that cannot be marked.
 *
 * The generators pick from the dataset with a seeded random, so some seeds
 * land on a pair that cannot make a question: two people with equal
 * lifespans, a year nobody was born in, clues that fit two people. Rather
 * than loosening a generator until it always produces something, the seed
 * is nudged and tried again. A question that still fails after
 * `ATTEMPTS` tries does not exist for that seed, and the caller is told
 * so instead of being handed a guess.
 *
 * Validation runs here, before a question is returned, which is what
 * requirement section 37's gate means by validated at generation time.
 */
const ATTEMPTS = 24;

export function generateQuestion(
  dataset: Dataset,
  mode: QuizMode,
  seed: string,
): Question | null {
  const generate = GENERATORS[mode];
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const attemptSeed = attempt === 0 ? seed : `${seed}~${attempt}`;
    const question = generate({
      dataset,
      random: createRandom(`${mode}:${attemptSeed}`),
      seed,
    });
    if (question !== null && validateQuestion(dataset, question)) return question;
  }
  return null;
}

/**
 * A round: one question per mode, in the order requirement section 37
 * lists them, seeded so the same link is the same round.
 */
export function generateQuiz(
  dataset: Dataset,
  seed: string,
  count: number = QUIZ_MODES.length,
  modes: readonly QuizMode[] = QUIZ_MODES,
): Question[] {
  const questions: Question[] = [];
  for (let index = 0; index < count; index += 1) {
    const mode = modes[index % modes.length];
    if (mode === undefined) break;
    const question = generateQuestion(dataset, mode, `${seed}/${index}`);
    if (question !== null) questions.push(question);
  }
  return questions;
}

/**
 * Whether an answer is right, by the question's own recorded answer —
 * which the engine has already agreed with, or the question would not
 * exist. Order matters only where the mode says it does.
 */
export function isCorrectAnswer(question: Question, given: readonly string[]): boolean {
  if (question.ordered) {
    return (
      given.length === question.answerIds.length &&
      given.every((id, index) => id === question.answerIds[index])
    );
  }
  const answers = [...question.answerIds].sort();
  const sorted = [...given].sort();
  return (
    sorted.length === answers.length && sorted.every((id, index) => id === answers[index])
  );
}

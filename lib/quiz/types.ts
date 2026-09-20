import type { DiscoveryStep } from '@/lib/discovery';

/**
 * What a quiz question is.
 *
 * The eight modes in requirement section 37, with the same rule Phase 11
 * put on discoveries: a question is generated from the dataset or it does
 * not exist. Nothing here is an answer key. `check` says how the engine
 * should be asked to mark the question, and the mark comes from a
 * different engine function than the one that generated it — a validator
 * that re-runs the generator's own calculation would prove nothing.
 */
export type QuizMode =
  | 'who-lived-longer'
  | 'could-lifetimes-overlap'
  | 'who-was-alive'
  | 'put-them-in-order'
  | 'guess-the-age'
  | 'family-connection'
  | 'timeline-placement'
  | 'who-am-i';

export const QUIZ_MODES: readonly QuizMode[] = [
  'who-lived-longer',
  'could-lifetimes-overlap',
  'who-was-alive',
  'put-them-in-order',
  'guess-the-age',
  'family-connection',
  'timeline-placement',
  'who-am-i',
] as const;

export const MODE_LABELS: Readonly<Record<QuizMode, string>> = {
  'who-lived-longer': 'Who lived longer?',
  'could-lifetimes-overlap': 'Could their lifetimes overlap?',
  'who-was-alive': 'Who was alive?',
  'put-them-in-order': 'Put them in order',
  'guess-the-age': 'Guess the age',
  'family-connection': 'Family connection',
  'timeline-placement': 'Timeline placement',
  'who-am-i': 'Who am I?',
};

export const MODE_DESCRIPTIONS: Readonly<Record<QuizMode, string>> = {
  'who-lived-longer': 'Two recorded lifespans. Which one is the longer?',
  'could-lifetimes-overlap':
    'Two lifetimes. Did the chronology place them in the same years at all?',
  'who-was-alive': 'One year. Which of these people was living in it?',
  'put-them-in-order': 'Three people. Put them in the order they were born.',
  'guess-the-age': 'How old was one person when another was born?',
  'family-connection': 'Which of these is an ancestor of this person?',
  'timeline-placement': 'In which year does this chronology place a birth?',
  'who-am-i': 'Two clues from the records. Who do they point to?',
};

export interface QuizOption {
  /** Stable, and safe in a URL: the answer travels as a query parameter. */
  id: string;
  label: string;
}

/**
 * How to mark a question, expressed as a question for the engine rather
 * than as an answer. Requirement §37's exit gate is that the answer is
 * validated against the engine at generation time, and this is the shape
 * that makes the check independent of the generator.
 */
export type EngineCheck =
  | { kind: 'longer-lifespan'; personAId: string; personBId: string }
  | { kind: 'alive-at-birth'; personId: string; otherPersonId: string }
  | { kind: 'alive-in-year'; year: number }
  | { kind: 'birth-order' }
  | { kind: 'age-at-other-birth'; personId: string; otherPersonId: string }
  | { kind: 'ancestor-of'; personId: string }
  | { kind: 'born-in-year'; personId: string }
  | { kind: 'identified-by'; lifespan: number; parentId: string };

export interface Question {
  /** Deterministic: the mode and the seed that produced it. */
  id: string;
  mode: QuizMode;
  chronologyId: string;
  prompt: string;
  /**
   * What the question drew from, in the same words the discoveries use. A
   * superlative or a "which of these" over a subset is only honest if the
   * subset is named.
   */
  population: string;
  options: readonly QuizOption[];
  /** The correct option ids. Order matters only when `ordered` is true. */
  answerIds: readonly string[];
  ordered: boolean;
  /** Why that is the answer, generated from the same records. */
  explanation: string;
  working: readonly DiscoveryStep[];
  personIds: readonly string[];
  sourceReferences: readonly string[];
  check: EngineCheck;
  /**
   * True when the question is about two lifetimes sharing years, so the
   * page shows that sharing years is not evidence of a meeting.
   */
  aboutOverlap: boolean;
}

export type { DiscoveryStep as WorkingStep };

import type { QuizMode } from '@/lib/quiz';

/**
 * Progression, derived rather than stored.
 *
 * Everything here is a function of the attempt log, so nothing can drift
 * out of step with what a player actually did: no counter to increment,
 * no total to keep in sync. Phase 13 can replay a server-side log through
 * the same functions and get the same badges, which is the point of
 * keeping them pure.
 */
export interface Attempt {
  questionId: string;
  mode: QuizMode;
  correct: boolean;
  /** The calendar day the attempt happened on, as YYYY-MM-DD. */
  day: string;
}

export interface ModeTally {
  answered: number;
  correct: number;
}

export interface Progress {
  xp: number;
  level: number;
  /** XP still needed to reach the next level. */
  toNextLevel: number;
  answered: number;
  correct: number;
  streakDays: number;
  bestStreakDays: number;
  lastDay: string | null;
  longestCorrectRun: number;
  modes: Readonly<Record<QuizMode, ModeTally>>;
  achievements: readonly string[];
}

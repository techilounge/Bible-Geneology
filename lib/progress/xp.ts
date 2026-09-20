import { QUIZ_MODES, type QuizMode } from '@/lib/quiz';
import { earnedAchievements } from './achievements';
import type { Attempt, ModeTally, Progress } from './types';

/**
 * XP, levels and streaks.
 *
 * A wrong answer still earns something, because the product is a teaching
 * tool and a player who guesses badly and then reads the working has done
 * the thing we wanted. Requirement section 38 asks that gamification
 * support learning rather than dominate it, so the numbers here are
 * deliberately unexciting.
 */
export const XP_FOR_CORRECT = 10;
export const XP_FOR_ATTEMPT = 2;
export const XP_PER_LEVEL = 100;

export function xpFor(attempts: readonly Attempt[]): number {
  return attempts.reduce(
    (total, attempt) => total + (attempt.correct ? XP_FOR_CORRECT : XP_FOR_ATTEMPT),
    0,
  );
}

export function levelFor(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

/**
 * Consecutive calendar days ending on the most recent one played.
 *
 * Counted from the log's own days rather than from today, so reading a
 * player's progress never changes it. A page that wants to say "your
 * streak ends tonight" compares `lastDay` with today itself.
 */
export function streakFrom(days: readonly string[]): number {
  const unique = [...new Set(days)].sort();
  const last = unique[unique.length - 1];
  if (last === undefined) return 0;

  let streak = 1;
  for (let index = unique.length - 2; index >= 0; index -= 1) {
    const day = unique[index] as string;
    const next = unique[index + 1] as string;
    if (dayBefore(day, next)) streak += 1;
    else break;
  }
  return streak;
}

export function bestStreakFrom(days: readonly string[]): number {
  const unique = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  for (let index = 0; index < unique.length; index += 1) {
    const day = unique[index] as string;
    const previous = unique[index - 1];
    run = previous !== undefined && dayBefore(previous, day) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** True when `earlier` is the calendar day immediately before `later`. */
export function dayBefore(earlier: string, later: string): boolean {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return end - start === 86_400_000;
}

function longestRun(attempts: readonly Attempt[]): number {
  let best = 0;
  let run = 0;
  for (const attempt of attempts) {
    run = attempt.correct ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function tally(attempts: readonly Attempt[]): Record<QuizMode, ModeTally> {
  const modes = Object.fromEntries(
    QUIZ_MODES.map((mode) => [mode, { answered: 0, correct: 0 }]),
  ) as Record<QuizMode, ModeTally>;

  for (const attempt of attempts) {
    const entry = modes[attempt.mode];
    /* v8 ignore next -- @preserve: the mode union covers every key. */
    if (!entry) continue;
    entry.answered += 1;
    if (attempt.correct) entry.correct += 1;
  }
  return modes;
}

/** The whole of a player's progression, from the log alone. */
export function summarise(attempts: readonly Attempt[]): Progress {
  const days = attempts.map((attempt) => attempt.day);
  const xp = xpFor(attempts);
  const modes = tally(attempts);
  const longestCorrectRun = longestRun(attempts);
  const streakDays = streakFrom(days);

  const sortedDays = [...days].sort();
  const progress = {
    xp,
    level: levelFor(xp),
    toNextLevel: XP_PER_LEVEL - (xp % XP_PER_LEVEL),
    answered: attempts.length,
    correct: attempts.filter((attempt) => attempt.correct).length,
    streakDays,
    bestStreakDays: bestStreakFrom(days),
    lastDay: sortedDays[sortedDays.length - 1] ?? null,
    longestCorrectRun,
    modes,
  };

  return { ...progress, achievements: earnedAchievements(progress) };
}

export const EMPTY_PROGRESS: Progress = summarise([]);

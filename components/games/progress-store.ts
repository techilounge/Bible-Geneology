'use client';

import type { Attempt } from '@/lib/progress';

/**
 * Where progress lives until there are accounts.
 *
 * Requirement section 46: core exploration needs no account, and playing
 * is core. So the attempt log sits in this browser and nowhere else.
 * Phase 13 will write the same records to a table behind the same two
 * functions; the rules that turn them into XP and badges are pure and
 * already live in `lib/progress`, so they will not change when it does.
 *
 * Every access is guarded. Private windows, blocked site data and
 * storage quotas all throw here, and none of them should stop someone
 * playing: they just stop the score being kept.
 */
const KEY = 'bible-timeline-explorer.attempts.v1';
const LIMIT = 500;

export function readAttempts(): Attempt[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAttempt);
  } catch {
    return [];
  }
}

export function recordAttempt(attempt: Attempt): Attempt[] {
  const existing = readAttempts();
  const last = existing[existing.length - 1];
  // Refreshing a marked answer is not a second attempt at it.
  if (
    last &&
    last.questionId === attempt.questionId &&
    last.correct === attempt.correct
  ) {
    return existing;
  }
  const next = [...existing, attempt].slice(-LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Out of quota, or storage is blocked. The round still plays.
  }
  return next;
}

export function clearAttempts(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: there was nothing readable there either.
  }
}

function isAttempt(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.questionId === 'string' &&
    typeof candidate.mode === 'string' &&
    typeof candidate.correct === 'boolean' &&
    typeof candidate.day === 'string'
  );
}

/** Today, as the calendar day the streak rules count in. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

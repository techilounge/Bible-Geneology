import type { Attempt } from '@/lib/progress';
import { QUIZ_MODES } from '@/lib/quiz';

/**
 * The browser's attempt log, as it arrives from a form field.
 *
 * It is user input, so it is parsed rather than trusted: anything that is
 * not an attempt in a recognised mode is dropped, and the field is capped
 * so a hand-written post cannot ask the database to swallow a megabyte.
 */
export const MAX_ATTEMPTS = 500;

export function parseAttempts(raw: string): Attempt[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const attempts: Attempt[] = [];
  for (const value of parsed.slice(0, MAX_ATTEMPTS)) {
    if (typeof value !== 'object' || value === null) continue;
    const candidate = value as Record<string, unknown>;
    const { questionId, mode, correct, day } = candidate;
    if (typeof questionId !== 'string' || questionId.length === 0) continue;
    if (typeof correct !== 'boolean') continue;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (typeof mode !== 'string') continue;
    if (!(QUIZ_MODES as readonly string[]).includes(mode)) continue;
    attempts.push({ questionId, mode: mode as Attempt['mode'], correct, day });
  }
  return attempts;
}

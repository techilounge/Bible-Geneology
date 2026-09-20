import type { Attempt } from '@/lib/progress';

/**
 * Joining a browser's attempt log to an account's.
 *
 * Someone plays for a week signed out, then signs in. Losing that week
 * would be the obvious bug; silently doubling it would be the subtle one,
 * because signing in on the same browser twice would then keep adding the
 * same history again. So the merge is a set union over an identity, not a
 * concatenation.
 *
 * Two attempts count as the same when they are the same question,
 * answered the same way, on the same day. That is deliberately
 * conservative: a genuine second try at the same question on the same day
 * with the same outcome is indistinguishable from a re-upload of the
 * first, and undercounting a repeat is a smaller wrong than inflating a
 * score every time a person signs in.
 *
 * Pure, so the rules in `lib/progress` can be replayed over the result
 * and give the same badges either side of a sign-in.
 */
export function attemptKey(attempt: Attempt): string {
  return `${attempt.day}|${attempt.questionId}|${attempt.correct ? 'y' : 'n'}`;
}

/** The attempts held in the browser that the account does not have yet. */
export function attemptsToUpload(
  account: readonly Attempt[],
  browser: readonly Attempt[],
): Attempt[] {
  const known = new Set(account.map(attemptKey));
  const fresh: Attempt[] = [];
  for (const attempt of browser) {
    const key = attemptKey(attempt);
    if (known.has(key)) continue;
    known.add(key);
    fresh.push(attempt);
  }
  return fresh;
}

/**
 * Both logs as one, in the order the progress rules read them: oldest day
 * first, and stable within a day so a replay is reproducible.
 */
export function mergeAttempts(
  account: readonly Attempt[],
  browser: readonly Attempt[],
): Attempt[] {
  const merged = [...account, ...attemptsToUpload(account, browser)];
  return merged.sort(
    (a, b) => a.day.localeCompare(b.day) || attemptKey(a).localeCompare(attemptKey(b)),
  );
}

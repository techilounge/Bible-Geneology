import { describe, expect, it } from 'vitest';
import type { Attempt } from '@/lib/progress';
import { attemptKey, attemptsToUpload, mergeAttempts } from '../merge';

const attempt = (day: string, questionId: string, correct = true): Attempt => ({
  day,
  questionId,
  mode: 'who-lived-longer',
  correct,
});

describe('joining a browser log to an account', () => {
  it('keeps both sides', () => {
    const account = [attempt('2026-09-01', 'a')];
    const browser = [attempt('2026-09-02', 'b')];
    expect(mergeAttempts(account, browser).map((a) => a.questionId)).toEqual(['a', 'b']);
  });

  it('does not count the same attempt twice when somebody signs in again', () => {
    const shared = attempt('2026-09-01', 'a');
    expect(mergeAttempts([shared], [shared, shared])).toHaveLength(1);
    expect(attemptsToUpload([shared], [shared])).toEqual([]);
  });

  it('keeps a second try that was answered differently', () => {
    const wrong = attempt('2026-09-01', 'a', false);
    const right = attempt('2026-09-01', 'a', true);
    expect(attemptsToUpload([wrong], [right])).toEqual([right]);
    expect(attemptKey(wrong)).not.toBe(attemptKey(right));
  });

  it('keeps the same question answered again on another day', () => {
    expect(
      attemptsToUpload([attempt('2026-09-01', 'a')], [attempt('2026-09-02', 'a')]),
    ).toHaveLength(1);
  });

  it('de-duplicates within the browser log as well as against the account', () => {
    const one = attempt('2026-09-01', 'a');
    expect(attemptsToUpload([], [one, one, one])).toHaveLength(1);
  });

  it('orders the result oldest first, and the same way every time', () => {
    const merged = mergeAttempts(
      [attempt('2026-09-03', 'c'), attempt('2026-09-01', 'a')],
      [attempt('2026-09-02', 'b'), attempt('2026-09-01', 'z')],
    );
    expect(merged.map((a) => a.questionId)).toEqual(['a', 'z', 'b', 'c']);
    expect(mergeAttempts(merged, [])).toEqual(merged);
  });

  it('merges nothing into nothing', () => {
    expect(mergeAttempts([], [])).toEqual([]);
  });
});

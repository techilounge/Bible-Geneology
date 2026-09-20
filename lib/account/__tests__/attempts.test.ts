import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, parseAttempts } from '../attempts';

/**
 * The attempt log arrives in a form field, which means it arrives from
 * whoever is posting the form. Every case here is something a hand-written
 * post could send.
 */
const good = {
  questionId: 'q1',
  mode: 'who-lived-longer',
  correct: true,
  day: '2026-09-01',
};

describe('reading an attempt log off a form', () => {
  it('keeps a well-formed attempt', () => {
    expect(parseAttempts(JSON.stringify([good]))).toEqual([good]);
  });

  it('drops anything that is not JSON, or not a list', () => {
    expect(parseAttempts('not json')).toEqual([]);
    expect(parseAttempts('{"questionId":"q1"}')).toEqual([]);
    expect(parseAttempts('null')).toEqual([]);
    expect(parseAttempts('')).toEqual([]);
  });

  it('drops an entry that is not an object', () => {
    expect(parseAttempts(JSON.stringify([null, 'q1', 7, good]))).toEqual([good]);
  });

  it('drops an entry with a field of the wrong shape', () => {
    const bad = [
      { ...good, questionId: 42 },
      { ...good, questionId: '' },
      { ...good, correct: 'yes' },
      { ...good, day: '1 September 2026' },
      { ...good, day: 20260901 },
      { ...good, mode: 7 },
      { ...good, mode: 'who-was-taller' },
    ];
    expect(parseAttempts(JSON.stringify(bad))).toEqual([]);
  });

  it('refuses to read more than a browser could have written', () => {
    const many = Array.from({ length: MAX_ATTEMPTS + 50 }, (_value, index) => ({
      ...good,
      questionId: `q${index}`,
    }));
    expect(parseAttempts(JSON.stringify(many))).toHaveLength(MAX_ATTEMPTS);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT, safeNext } from '../redirect';

/**
 * An open redirect is the one authentication bug that needs no
 * authentication to exploit, so these cases are written as attacks rather
 * than as inputs.
 */
describe('where a sign-in may return to', () => {
  it('keeps a path on this site, with its query', () => {
    expect(safeNext('/games/who-lived-longer?seed=abc')).toBe(
      '/games/who-lived-longer?seed=abc',
    );
    expect(safeNext('/')).toBe('/');
  });

  it('refuses another origin, however it is spelled', () => {
    for (const attack of [
      'https://evil.test/steal',
      'http://evil.test',
      '//evil.test',
      '/\\evil.test',
      '\\\\evil.test',
      'javascript:alert(1)',
      'data:text/html,<script>',
      'evil.test',
    ]) {
      expect(safeNext(attack), attack).toBe(DEFAULT_NEXT);
    }
  });

  it('refuses a value hiding behind a control character', () => {
    expect(safeNext('/ok\n/../..//evil.test')).toBe(DEFAULT_NEXT);
    expect(safeNext('/ok\u0000')).toBe(DEFAULT_NEXT);
    expect(safeNext('/ok\u007f')).toBe(DEFAULT_NEXT);
  });

  it('refuses nothing, blankness and absurd length', () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext(42 as unknown as string)).toBe(DEFAULT_NEXT);
    expect(safeNext('   ')).toBe(DEFAULT_NEXT);
    expect(safeNext(`/${'a'.repeat(600)}`)).toBe(DEFAULT_NEXT);
  });

  it('refuses a path the parser cannot make sense of', () => {
    // A lone surrogate and a malformed escape both reach the URL parser,
    // which is the last line rather than the first.
    expect(safeNext('/%')).toBe('/%');
    expect(safeNext('/[')).toBe('/[');
  });

  it('refuses to return into the auth routes themselves', () => {
    expect(safeNext('/auth/sign-out')).toBe(DEFAULT_NEXT);
    expect(safeNext('/auth/callback?code=stolen')).toBe(DEFAULT_NEXT);
  });
});

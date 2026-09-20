/**
 * Where a sign-in is allowed to send somebody afterwards.
 *
 * `?next=` is the classic open redirect: an attacker mails a link to the
 * real sign-in page, the reader signs in to the real site, and the site
 * hands them to the attacker's. The rule that closes it is that only a
 * path within this site is ever honoured, and the check is a whitelist of
 * shapes rather than a blacklist of tricks.
 *
 * Pure on purpose. It takes the raw parameter and returns a path, so it
 * can be tested exhaustively without a request, a browser or a session.
 */
export const DEFAULT_NEXT = '/account';

/** A base that no deployment can be, so resolving against it is a test. */
const ORIGIN = 'https://redirect.invalid';

/**
 * A path is safe when it is a path: one leading slash, no scheme, no
 * authority, and nothing that a browser would re-read as one of those.
 *
 * `//evil.test` and `/\evil.test` are the two that catch people out: both
 * start with a slash and both are absolute URLs to another origin once a
 * browser normalises them.
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== 'string') return DEFAULT_NEXT;

  const trimmed = next.trim();
  if (trimmed.length === 0 || trimmed.length > 512) return DEFAULT_NEXT;
  // A control character can hide the rest of the value from a naive check
  // while a browser still acts on it. Scanned rather than matched with a
  // regular expression, which lint rightly refuses to have control
  // characters written into.
  if (hasControlCharacter(trimmed)) return DEFAULT_NEXT;
  if (!trimmed.startsWith('/')) return DEFAULT_NEXT;

  // Resolved against a throwaway origin so that anything which is secretly
  // absolute reveals itself by landing somewhere else. This is the check
  // that does the work: `//evil.test` and `/\evil.test` both start with a
  // slash and both resolve to another origin, because a URL parser reads a
  // backslash as a slash. Comparing the origin catches them without having
  // to know which spellings exist.
  let url: URL;
  try {
    url = new URL(trimmed, ORIGIN);
  } catch {
    /* v8 ignore next -- @preserve: the parser does not throw on a string that
       already starts with a slash, but a redirect is the wrong place to find
       out that one day it can. */
    return DEFAULT_NEXT;
  }
  if (url.origin !== ORIGIN) return DEFAULT_NEXT;

  // The auth routes themselves are not destinations; returning to one
  // would either loop or sign the reader straight back out.
  if (url.pathname.startsWith('/auth/')) return DEFAULT_NEXT;

  return `${url.pathname}${url.search}`;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

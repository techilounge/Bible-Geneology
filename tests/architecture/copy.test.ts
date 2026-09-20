import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Copy that the verified chronology contradicts, banned by name.
 *
 * The original build prompt's worked example and two of its "Surprise Me"
 * examples assert overlaps that Kelv's 130-year Terah decision makes false:
 * Noah into Abraham's lifetime, and Shem alive when Jacob was born. They
 * were written against the 70-year reading of Genesis 11:26.
 *
 * docs/COPY_CORRECTIONS.md records each original beside a true replacement.
 * This test is what stops one of them coming back, in a page, a seeded
 * discovery, or the canonical data.
 */
const SHIPPED = ['app', 'components', 'lib', 'data/canonical'];

const CONTRADICTED_BY_THE_DATA: Array<[string, RegExp]> = [
  [
    "Noah's lifetime extending into Abraham's",
    /Noah['’]s lifetime extend\w* into Abraham/i,
  ],
  ['Shem alive when Jacob was born', /Shem was alive when Jacob was born/i],
  ['that Noah and Abraham overlapped', /Noah and Abraham[^.]{0,60}overlapped/i],
  ['that Shem and Jacob overlapped', /Shem and Jacob[^.]{0,60}overlapped/i],
  ['the 58-year figure as a plain result', /overlapped by (approximately )?58 years/i],
];

/*
 * These patterns are narrow on purpose. Two of the canonical assumptions
 * have to say that Noah and Abraham's lifetimes overlap *under the
 * alternate reading* — that is the disagreement the alternate chronology
 * exists to record, and a pattern broad enough to catch the false
 * unconditional claim would catch the true conditional one as well. What
 * is banned here is the past-tense, unqualified assertion that the
 * original copy made. The overlaps themselves are guarded by the golden
 * suite, which tests the numbers rather than the prose.
 */

/**
 * Claims of contact, which no overlap supports (requirement section 21).
 *
 * The bare phrase "they met" is deliberately absent: the disclaimer that
 * does the work contains it, inside a negation, and banning the substring
 * would ban the sentence.
 */
const CLAIMS_OF_CONTACT: Array<[string, RegExp]> = [
  ['must have met or known', /\bmust have (met|known)\b/i],
  ['would have met, known or spoken', /\bwould have (met|known|spoken)\b/i],
  ['certainly met', /\bcertainly met\b/i],
  ['did meet', /\bdid meet\b/i],
  ['knew each other', /\bknew each other\b/i],
  ['were acquainted', /\bwere acquainted\b/i],
  ['handed down to', /\bhanded (it )?down to\b/i],
  ['passed down or on to', /\bpassed (it )?(down|on) to\b/i],
];

function shippedSources(): Array<[string, string]> {
  return SHIPPED.flatMap((dir) =>
    globSync(join(dir, '**/*.{ts,tsx,json}'))
      .filter((path) => !/\.test\.tsx?$|__tests__/.test(path))
      .map((path) => [path, readFileSync(path, 'utf8')] as [string, string]),
  );
}

describe('shipped copy agrees with the verified chronology', () => {
  const sources = shippedSources();

  it('finds the shipped sources to check', () => {
    expect(sources.length).toBeGreaterThan(30);
  });

  it.each(CONTRADICTED_BY_THE_DATA)('does not claim %s', (_label, pattern) => {
    const offenders = sources
      .filter(([, text]) => pattern.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it.each(CLAIMS_OF_CONTACT)('never says two people %s', (_label, pattern) => {
    const offenders = sources
      .filter(([, text]) => pattern.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

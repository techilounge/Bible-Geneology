import { describe, expect, it } from 'vitest';
import { checkFigure } from '@/lib/verification/check';
import {
  CORROBORATING_SOURCE,
  PRIMARY_SOURCE,
  collectClaims,
  sourcesAvailable,
  verseLookup,
} from '@/lib/verification/load';

/**
 * The Phase 2 verification pass, as a standing test.
 *
 * The pass itself ran once and promoted what it could. This keeps it true:
 * change a figure the dataset says Scripture states, and this fails unless
 * the verse states the new number too. It is the rule from requirement
 * section 3 — no chronological value comes from a model — turned into
 * something a build can check.
 *
 * The two translations are devDependencies rather than committed text, so
 * the suite says plainly when they are missing rather than passing an empty
 * check.
 */
const OPTIONS = {
  primarySourceId: PRIMARY_SOURCE,
  corroboratingSourceId: CORROBORATING_SOURCE,
};

describe('every figure the dataset calls explicit is stated in the text', () => {
  it('has both public-domain translations installed', () => {
    expect(
      sourcesAvailable(),
      'Install the devDependencies: the verification sources are not readable',
    ).toBe(true);
  });

  const lookup = verseLookup();
  const claims = collectClaims().filter((claim) => claim.statedInText);

  /**
   * An exact count, so a figure added to the dataset cannot slip past this
   * suite unnoticed. If this fails because a real figure was added, the fix
   * is to raise the number in the same commit that adds it — which is the
   * moment to check that the new figure is verified too.
   */
  it('checks every one of them, so none can be added unchecked', () => {
    expect(claims.length).toBe(64);
  });

  for (const claim of claims) {
    it(`${claim.subject} = ${claim.value}, in ${claim.references.join(' + ')}`, () => {
      const check = checkFigure(
        claim.subject,
        claim.value,
        claim.references,
        lookup,
        OPTIONS,
      );
      expect(
        check.outcome,
        `${PRIMARY_SOURCE} states [${check.stated[PRIMARY_SOURCE]?.join(', ') ?? ''}], ` +
          `${CORROBORATING_SOURCE} states [${check.stated[CORROBORATING_SOURCE]?.join(', ') ?? ''}]`,
      ).toBe('verified');
    });
  }
});

describe('a record is VERIFIED only with the provenance to back it', () => {
  it('names the source and the method on every promoted record', async () => {
    const rows = (await import('../../data/canonical/person-chronology.masoretic.json'))
      .default as { personId: string; reviewStatus: string; verification?: unknown }[];

    for (const row of rows.filter((r) => r.reviewStatus === 'VERIFIED')) {
      expect(row.verification, `${row.personId} is VERIFIED without provenance`).toEqual(
        expect.objectContaining({
          method: 'automated-source-check',
          primarySource: PRIMARY_SOURCE,
          corroboratingSource: CORROBORATING_SOURCE,
        }),
      );
    }
  });

  it('never records a person as having verified a source they did not inspect', async () => {
    const rows = (await import('../../data/canonical/person-chronology.masoretic.json'))
      .default as { personId: string; verifiedBy?: string | null }[];

    for (const row of rows) {
      if (row.verifiedBy === null || row.verifiedBy === undefined) continue;
      expect(row.verifiedBy, `${row.personId} names a human as the verifier`).toMatch(
        /^source-check:/,
      );
    }
  });
});

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  checkDerivationChain,
  checkFigure,
  recordOutcome,
  type DerivationCheck,
  type DerivationStep,
  type FigureCheck,
} from '../lib/verification/check';
import {
  CORROBORATING_SOURCE,
  PRIMARY_SOURCE,
  collectClaims,
  verseLookup,
} from '../lib/verification/load';

/**
 * The Phase 2 verification pass.
 *
 * Every figure in the canonical dataset that claims to be stated in
 * Scripture is read back out of two public-domain translations and
 * compared with what the dataset says. Nothing here decides what a verse
 * says; it reads the verse and reports.
 *
 * The primary source is the World English Bible, which is public domain
 * worldwide. The corroborating source is the King James Version of 1769.
 * They are independent translations of the same Masoretic Hebrew, so their
 * agreeing on a number is worth more than either alone. Neither text is
 * committed here: both are devDependencies, read at verification time, and
 * only the numbers a verse states and a short quoted fragment reach the
 * audit file.
 *
 *   npm run verify:source              report only
 *   npm run verify:source -- --promote report, then write the statuses
 */
const DIR = join(process.cwd(), 'data', 'canonical');
const OUT = join(process.cwd(), 'data', 'generated');
const OPTIONS = {
  primarySourceId: PRIMARY_SOURCE,
  corroboratingSourceId: CORROBORATING_SOURCE,
};

async function main(): Promise<void> {
  const promote = process.argv.includes('--promote');
  const lookup = verseLookup();
  const claims = collectClaims();

  const stated = claims.filter((claim) => claim.statedInText);
  const notStated = claims.filter((claim) => !claim.statedInText);

  const checks = stated.map((claim) =>
    checkFigure(claim.subject, claim.value, claim.references, lookup, OPTIONS),
  );

  const byOwner = new Map<string, FigureCheck[]>();
  stated.forEach((claim, index) => {
    const check = checks[index];
    if (!check) return;
    byOwner.set(claim.ownerId, [...(byOwner.get(claim.ownerId) ?? []), check]);
  });

  // Point 4 of the pass: re-run every derivation over verified inputs,
  // rather than accepting a derived number because it looks reasonable.
  const verifiedReferences = new Set(
    checks
      .filter((check) => check.outcome === 'verified')
      .flatMap((check) => check.references),
  );

  const derivedRecords = JSON.parse(
    await readFile(join(OUT, 'person-chronology.masoretic.json'), 'utf8'),
  ) as {
    personId: string;
    derivation: { result: number; steps: DerivationStep[] } | null;
  }[];

  const derivations: DerivationCheck[] = derivedRecords
    .filter((record) => record.derivation !== null)
    .map((record) =>
      checkDerivationChain(
        `${record.personId}.birthYear`,
        record.derivation?.steps ?? [],
        record.derivation?.result ?? 0,
        verifiedReferences,
      ),
    );

  // Informational only. A figure the dataset does not claim the text states
  // is never promoted because a number turns up in its verse, but recording
  // what the verse says is part of the audit trail: Genesis 37:2 does state
  // seventeen and Genesis 11:26 does state seventy. What is interpretive
  // about those two is what the number is taken to mean.
  const support = notStated.map((claim) =>
    checkFigure(claim.subject, claim.value, claim.references, lookup, OPTIONS),
  );

  const summary = {
    checkedAt: new Date().toISOString().slice(0, 10),
    primarySource: PRIMARY_SOURCE,
    corroboratingSource: CORROBORATING_SOURCE,
    figuresClaimedExplicit: checks.length,
    figuresNotClaimedExplicit: notStated.length,
    outcomes: checks.reduce<Record<string, number>>((into, check) => {
      into[check.outcome] = (into[check.outcome] ?? 0) + 1;
      return into;
    }, {}),
    records: [...byOwner].map(([ownerId, figures]) => ({
      ownerId,
      outcome: recordOutcome(figures),
      figures,
    })),
    notClaimedExplicit: notStated.map((claim, index) => ({
      subject: claim.subject,
      value: claim.value,
      references: claim.references,
      textualSupport: support[index]?.outcome ?? 'not-stated',
      stated: support[index]?.stated ?? {},
    })),
    derivations,
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(
    join(OUT, 'source-verification.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `Verification against ${PRIMARY_SOURCE}, corroborated by ${CORROBORATING_SOURCE}`,
  );
  console.log(`  figures the dataset calls explicit: ${checks.length}`);
  for (const [outcome, count] of Object.entries(summary.outcomes)) {
    console.log(`    ${outcome}: ${count}`);
  }
  console.log(`  figures it does not: ${notStated.length}`);

  const unsound = derivations.filter((check) => check.arithmetic === 'unsound');
  const uncovered = derivations.filter((check) => check.unverifiedReferences.length > 0);
  console.log(`  derivation chains re-run: ${derivations.length}`);
  console.log(`    arithmetic unsound: ${unsound.length}`);
  console.log(`    resting on an unverified input: ${uncovered.length}`);

  for (const check of checks) {
    if (check.outcome === 'verified') continue;
    console.log(`\n  ${check.outcome.toUpperCase()}  ${check.subject} = ${check.value}`);
    console.log(`    cites ${check.references.join(', ')}`);
    for (const [sourceId, numbers] of Object.entries(check.stated)) {
      console.log(`    ${sourceId} states [${numbers.join(', ')}]`);
      console.log(`      "${(check.quotes[sourceId] ?? '').slice(0, 200)}"`);
    }
  }
  for (const check of [...unsound, ...uncovered]) {
    console.log(
      `\n  DERIVATION  ${check.subject}: stated ${check.result}, recomputed ${check.recomputed}` +
        (check.unverifiedReferences.length > 0
          ? `, unverified inputs ${check.unverifiedReferences.join(', ')}`
          : ''),
    );
  }

  if (!promote) {
    console.log('\n  Report only. Pass --promote to write the review statuses.');
    return;
  }

  // Promotion is per record, and only where every figure that record states
  // passed. A chain the record's own birth year rests on must also have been
  // re-run soundly over verified inputs, so no record inherits confidence
  // from arithmetic nobody checked.
  const soundChain = new Set(
    derivations
      .filter(
        (check) =>
          check.arithmetic === 'sound' && check.unverifiedReferences.length === 0,
      )
      .map((check) => check.subject.split('.')[0]),
  );
  const brokenChain = new Set(
    derivations
      .filter(
        (check) => check.arithmetic !== 'sound' || check.unverifiedReferences.length > 0,
      )
      .map((check) => check.subject.split('.')[0]),
  );

  const passed = new Set(
    summary.records
      .filter((record) => record.outcome === 'verified')
      .map((record) => record.ownerId)
      .filter((ownerId) => !brokenChain.has(ownerId)),
  );
  const figureCount = new Map(
    summary.records.map((record) => [record.ownerId, record.figures.length]),
  );

  const rows = JSON.parse(
    await readFile(join(DIR, 'person-chronology.masoretic.json'), 'utf8'),
  ) as Record<string, unknown>[];

  let promoted = 0;
  const rewritten = rows.map((row) => {
    const personId = String(row.personId);
    const next: Record<string, unknown> = { ...row };

    // Kelv supplied these readings; he did not inspect the source this pass
    // checked them against, so he is recorded as the supplier and the pass
    // itself as the verifier. Idempotent: on a second run the verifier field
    // already holds this pass's label, and reading the supplier back out of
    // it would lose the person who actually supplied the reading.
    const priorVerifier = typeof row.verifiedBy === 'string' ? row.verifiedBy : null;
    const supplier = priorVerifier?.startsWith('source-check:') ? null : priorVerifier;
    delete next.verifiedBy;
    delete next.verifiedAt;
    next.suppliedBy = row.suppliedBy ?? supplier ?? null;
    next.suppliedAt =
      row.suppliedAt ?? (supplier === null ? null : row.verifiedAt) ?? null;

    if (passed.has(personId)) {
      promoted += 1;
      next.reviewStatus = 'VERIFIED';
      next.verifiedBy = `source-check:${PRIMARY_SOURCE}+${CORROBORATING_SOURCE}`;
      next.verifiedAt = summary.checkedAt;
      next.verification = {
        method: 'automated-source-check',
        tool: 'scripts/verify-source.ts',
        primarySource: PRIMARY_SOURCE,
        corroboratingSource: CORROBORATING_SOURCE,
        figuresChecked: figureCount.get(personId) ?? 0,
        derivationRerun: soundChain.has(personId) ? 'sound' : 'no-derivation',
      };
    } else {
      next.reviewStatus = 'SOURCE_CHECKED';
    }
    return next;
  });

  await writeFile(
    join(DIR, 'person-chronology.masoretic.json'),
    `${JSON.stringify(rewritten, null, 2)}\n`,
    'utf8',
  );

  console.log(`\n  promoted to VERIFIED: ${promoted}`);
  console.log(`  left at SOURCE_CHECKED: ${rewritten.length - promoted}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

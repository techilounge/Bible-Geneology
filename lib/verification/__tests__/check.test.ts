import { describe, expect, it } from 'vitest';
import {
  checkDerivationChain,
  checkFigure,
  recordOutcome,
  type VerseLookup,
} from '../check';

const OPTIONS = { primarySourceId: 'web', corroboratingSourceId: 'kjv' };

const verses: Record<string, Record<string, string>> = {
  web: {
    'GEN.5.5': 'All the days that Adam lived were nine hundred thirty years.',
    'GEN.11.32': 'The days of Terah were two hundred five years.',
    'ACT.7.4': 'Then he came out of the land of the Chaldaeans.',
  },
  kjv: {
    'GEN.5.5': 'And all the days that Adam lived were nine hundred and thirty years.',
    'GEN.11.32': 'And the days of Terah were two hundred and five years.',
    'ACT.7.4': 'Then came he out of the land of the Chaldaeans.',
  },
};

const lookup: VerseLookup = (sourceId, referenceId) =>
  verses[sourceId]?.[referenceId] ?? null;

describe('checkFigure', () => {
  it('verifies a number both sources state', () => {
    const check = checkFigure('adam.lifespan', 930, ['GEN.5.5'], lookup, OPTIONS);
    expect(check.outcome).toBe('verified');
    expect(check.stated.web).toContain(930);
    expect(check.stated.kjv).toContain(930);
  });

  it('keeps the quote, so the audit trail carries its own evidence', () => {
    const check = checkFigure('terah.lifespan', 205, ['GEN.11.32'], lookup, OPTIONS);
    expect(check.quotes.web).toContain('two hundred five years');
  });

  it('reports a number neither source states', () => {
    const check = checkFigure('terah.lifespan', 70, ['GEN.11.32'], lookup, OPTIONS);
    expect(check.outcome).toBe('not-stated');
  });

  it('reports a disagreement rather than taking the primary source’s word', () => {
    const oneSided: VerseLookup = (sourceId, referenceId) =>
      sourceId === 'kjv' ? 'and he lived seven years' : lookup(sourceId, referenceId);
    const check = checkFigure('someone.lifespan', 7, ['GEN.5.5'], oneSided, OPTIONS);
    expect(check.outcome).toBe('sources-disagree');
  });

  it('reports a reference no source can read', () => {
    const check = checkFigure('x.lifespan', 5, ['GEN.99.1'], lookup, OPTIONS);
    expect(check.outcome).toBe('reference-unreadable');
  });

  it('finds no number in a verse that states none', () => {
    const check = checkFigure('terah.death', 205, ['ACT.7.4'], lookup, OPTIONS);
    expect(check.outcome).toBe('not-stated');
    expect(check.stated.web).toEqual([]);
  });
});

describe('recordOutcome', () => {
  const check = (outcome: string) =>
    ({ outcome }) as unknown as Parameters<typeof recordOutcome>[0][number];

  it('says so when a record states no figures at all', () => {
    expect(recordOutcome([])).toBe('no-figures');
  });

  it('is verified only when every figure is', () => {
    expect(recordOutcome([check('verified'), check('verified')])).toBe('verified');
    expect(recordOutcome([check('verified'), check('not-stated')])).toBe('not-stated');
  });

  it('reports the worst outcome, not the most common one', () => {
    expect(
      recordOutcome([check('verified'), check('sources-disagree'), check('verified')]),
    ).toBe('sources-disagree');
    expect(
      recordOutcome([check('sources-disagree'), check('reference-unreadable')]),
    ).toBe('reference-unreadable');
  });
});

describe('checkDerivationChain', () => {
  const steps = [
    { from: 'a', to: 'b', years: 130, reference: 'GEN.5.3', runningTotal: 130 },
    { from: 'b', to: 'c', years: 105, reference: 'GEN.5.6', runningTotal: 235 },
  ];
  const verified = new Set(['GEN.5.3', 'GEN.5.6']);

  it('re-adds the chain and agrees with the stated result', () => {
    const check = checkDerivationChain('abraham.birth', steps, 235, verified);
    expect(check.arithmetic).toBe('sound');
    expect(check.recomputed).toBe(235);
    expect(check.unverifiedReferences).toEqual([]);
  });

  it('catches a running total that does not follow from the step before it', () => {
    const wrong = [steps[0]!, { ...steps[1]!, runningTotal: 236 }];
    expect(checkDerivationChain('x', wrong, 235, verified).arithmetic).toBe('unsound');
  });

  it('catches a stated result the steps do not reach', () => {
    expect(checkDerivationChain('x', steps, 999, verified).arithmetic).toBe('unsound');
  });

  it('names an input the text check did not cover', () => {
    const check = checkDerivationChain('x', steps, 235, new Set(['GEN.5.3']));
    expect(check.unverifiedReferences).toEqual(['GEN.5.6']);
  });
});

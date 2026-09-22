import { describe, expect, it } from 'vitest';
import type { EventChronology, PersonChronology, Relationship } from '@/lib/domain';
import { validateDerived, type DerivedInput } from './validate-derived';

/**
 * A gate nobody has seen fail is a gate nobody knows works. Each test breaks
 * a valid derived dataset in exactly one way and asserts the validator says
 * so — the same discipline as validate-dataset.test.ts, applied to the half
 * of requirement section 21 that only the computed years can violate.
 */
function person(patch: Partial<PersonChronology> = {}): PersonChronology {
  return {
    personId: 'adam',
    chronologyId: 'masoretic',
    birthYear: 0,
    deathYear: 930,
    lifespan: 930,
    birthConfidence: 'DERIVED',
    deathConfidence: 'DERIVED',
    lifespanConfidence: 'EXPLICIT',
    birthSourceType: 'SCRIPTURE_DERIVED',
    deathSourceType: 'SCRIPTURE_DERIVED',
    lifespanSourceType: 'SCRIPTURE_EXPLICIT',
    sourceReferences: ['GEN.5.5'],
    calculationMethod: null,
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
    ...patch,
  };
}

/**
 * Seth, with a derivation that tracks whatever birth year the caller asks
 * for. A fixture whose working silently disagreed with its own year would
 * trip the wrong check in half these tests.
 */
function seth(patch: Partial<PersonChronology> = {}): PersonChronology {
  const birthYear = patch.birthYear ?? 130;
  return person({
    personId: 'seth',
    birthYear,
    deathYear: birthYear + 912,
    lifespan: 912,
    sourceReferences: ['GEN.5.3'],
    derivation: {
      method: 'begetting-chain',
      unit: 'AM',
      result: birthYear,
      steps: [
        {
          from: 'adam',
          to: 'seth',
          years: birthYear,
          reference: 'GEN.5.3',
          runningTotal: birthYear,
        },
      ],
      assumptions: ['adam-created-at-year-zero'],
    },
    ...patch,
  });
}

function event(patch: Partial<EventChronology> = {}): EventChronology {
  return {
    eventId: 'the-flood',
    chronologyId: 'masoretic',
    startYear: 1656,
    endYear: 1656,
    dateType: 'point',
    confidence: 'DERIVED',
    sourceType: 'SCRIPTURE_DERIVED',
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
    ...patch,
  };
}

const PARENT: Relationship = {
  sourcePersonId: 'adam',
  targetPersonId: 'seth',
  relationshipType: 'parent',
  sourceReferences: ['GEN.5.3'],
  confidence: 'EXPLICIT',
  sourceType: 'SCRIPTURE_EXPLICIT',
  notes: null,
  reviewStatus: 'DRAFT',
};

function input(patch: Partial<DerivedInput> = {}): DerivedInput {
  return {
    chronologyId: 'masoretic',
    records: [person(), seth()],
    events: [event()],
    relationships: [PARENT],
    referenceIds: new Set(['GEN.5.3', 'GEN.5.5', 'GEN.7.6']),
    ...patch,
  };
}

const checks = (given: DerivedInput, severity: 'severe' | 'warning' = 'severe') =>
  validateDerived(given)
    .filter((f) => f.severity === severity)
    .map((f) => f.check);

describe('validateDerived', () => {
  it('passes a consistent chronology', () => {
    expect(validateDerived(input())).toEqual([]);
  });

  it('catches a death before a birth', () => {
    expect(
      checks(input({ records: [person({ deathYear: -1, lifespan: -1 })] })),
    ).toContain('death-before-birth');
  });

  it('catches a lifespan that disagrees with the years', () => {
    expect(checks(input({ records: [person({ lifespan: 900 })] }))).toContain(
      'lifespan-inconsistent',
    );
  });

  it('catches a negative lifespan', () => {
    expect(
      checks(
        input({
          records: [
            person({
              birthYear: 0,
              deathYear: null,
              deathConfidence: 'UNKNOWN',
              lifespan: -5,
            }),
          ],
        }),
      ),
    ).toContain('negative-lifespan');
  });

  it('catches a child born before their parent', () => {
    expect(
      checks(input({ records: [person({ birthYear: 500, deathYear: 1430 }), seth()] })),
    ).toContain('child-born-before-parent');
  });

  it('warns about an implausibly young parent rather than failing', () => {
    const given = input({ records: [person(), seth({ birthYear: 5 })] });
    expect(checks(given, 'warning')).toContain('implausible-parent-age');
    expect(checks(given)).not.toContain('implausible-parent-age');
  });

  it('warns about a birth after the parent has died', () => {
    // Possible for a father, and the text sometimes says so, which is why
    // this is a warning and not an error.
    const given = input({
      records: [person(), seth({ birthYear: 1000 })],
    });
    expect(checks(given, 'warning')).toContain('posthumous-birth');
  });

  it('catches a year paired with UNKNOWN confidence', () => {
    expect(
      checks(input({ records: [person({ birthConfidence: 'UNKNOWN' })] })),
    ).toContain('unknown-means-null');
  });

  it('catches a null year paired with a confident label', () => {
    expect(
      checks(
        input({
          records: [
            person({ deathYear: null, lifespan: null, lifespanConfidence: 'UNKNOWN' }),
          ],
        }),
      ),
    ).toContain('unknown-means-null');
  });

  it('catches a stated year with no provenance', () => {
    expect(checks(input({ records: [person({ sourceReferences: [] })] }))).toContain(
      'no-provenance',
    );
  });

  it('allows a wholly unknown record to cite nothing', () => {
    const blank = person({
      personId: 'rachel',
      birthYear: null,
      deathYear: null,
      lifespan: null,
      birthConfidence: 'UNKNOWN',
      deathConfidence: 'UNKNOWN',
      lifespanConfidence: 'UNKNOWN',
      birthSourceType: 'UNKNOWN',
      deathSourceType: 'UNKNOWN',
      lifespanSourceType: 'UNKNOWN',
      sourceReferences: [],
    });
    expect(validateDerived(input({ records: [blank], relationships: [] }))).toEqual([]);
  });

  it('catches a reference that does not resolve', () => {
    expect(
      checks(input({ records: [person({ sourceReferences: ['GEN.99.1'] })] })),
    ).toContain('missing-reference');
  });

  it('catches a derivation whose steps do not sum to its result', () => {
    const broken = seth();
    expect(
      checks(
        input({
          records: [
            person(),
            seth({
              derivation: {
                ...(broken.derivation as NonNullable<typeof broken.derivation>),
                result: 999,
              },
            }),
          ],
        }),
      ),
    ).toContain('derivation-does-not-add-up');
  });

  it('catches a derivation that explains a different number', () => {
    // The whole point of recording the working: it must not drift away from
    // the value beside it. Here the years move and the working does not.
    const stale = seth();
    expect(
      checks(
        input({
          records: [person(), { ...stale, birthYear: 131, deathYear: 1043 }],
        }),
      ),
    ).toContain('derivation-explains-another-number');
  });

  it('catches a derivation step citing a reference that does not resolve', () => {
    const broken = seth();
    const derivation = broken.derivation as NonNullable<typeof broken.derivation>;
    expect(
      checks(
        input({
          records: [
            person(),
            seth({
              derivation: {
                ...derivation,
                steps: [{ ...derivation.steps[0]!, reference: 'GEN.99.1' }],
              },
            }),
          ],
        }),
      ),
    ).toContain('missing-reference');
  });

  it('catches two records for one person', () => {
    expect(checks(input({ records: [person(), person()] }))).toContain(
      'duplicate-chronology-record',
    );
  });

  it('catches a record belonging to another chronology', () => {
    expect(
      checks(input({ records: [person({ chronologyId: 'septuagint' })] })),
    ).toContain('wrong-chronology');
  });

  it('catches an event that ends before it starts', () => {
    expect(checks(input({ events: [event({ endYear: 1000 })] }))).toContain(
      'event-ends-before-it-starts',
    );
  });

  it('catches an event year paired with UNKNOWN confidence', () => {
    expect(checks(input({ events: [event({ confidence: 'UNKNOWN' })] }))).toContain(
      'unknown-means-null',
    );
  });

  it('catches two records for one event', () => {
    expect(checks(input({ events: [event(), event()] }))).toContain(
      'duplicate-event-record',
    );
  });

  it('allows an undated event', () => {
    const babel = event({
      eventId: 'tower-of-babel',
      startYear: null,
      endYear: null,
      dateType: 'unknown',
      confidence: 'UNKNOWN',
      sourceType: 'UNKNOWN',
    });
    expect(validateDerived(input({ events: [babel] }))).toEqual([]);
  });

  it('does not warn on a VERIFIED derived record: the status is propagated', () => {
    // A derived record's status is the weakest figure in the chain it rests on
    // (section 8), not a claim the arithmetic was reviewed. VERIFIED here only
    // reflects VERIFIED source figures, which is enforced where they live, so
    // the derived validator has nothing to add and must stay quiet.
    const findings = validateDerived(
      input({ records: [person({ reviewStatus: 'VERIFIED' })] }),
    );
    expect(findings.map((f) => f.check)).not.toContain('verified-without-reviewer');
  });

  it('ignores a relationship whose ends are not both dated', () => {
    expect(
      validateDerived(input({ records: [person()], relationships: [PARENT] })),
    ).toEqual([]);
  });

  it('ignores relationships that are not descent', () => {
    const spouse: Relationship = { ...PARENT, relationshipType: 'spouse' };
    expect(
      validateDerived(
        input({
          records: [person(), seth({ birthYear: 5 })],
          relationships: [spouse],
        }),
      ),
    ).toEqual([]);
  });
});

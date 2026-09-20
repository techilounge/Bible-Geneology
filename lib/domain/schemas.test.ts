import { describe, expect, it } from 'vitest';
import {
  DerivationSchema,
  PersonChronologySchema,
  PersonSchema,
  RelationshipSchema,
  ScriptureReferenceSchema,
} from './schemas';

const baseChronologyRecord = {
  personId: 'methuselah',
  chronologyId: 'masoretic',
  birthYear: 687,
  deathYear: 1656,
  lifespan: 969,
  birthConfidence: 'DERIVED',
  deathConfidence: 'DERIVED',
  lifespanConfidence: 'EXPLICIT',
  birthSourceType: 'SCRIPTURE_DERIVED',
  deathSourceType: 'SCRIPTURE_DERIVED',
  lifespanSourceType: 'SCRIPTURE_EXPLICIT',
  sourceReferences: ['GEN.5.21', 'GEN.5.27'],
} as const;

describe('PersonChronologySchema', () => {
  it('accepts a well-formed record', () => {
    expect(PersonChronologySchema.safeParse(baseChronologyRecord).success).toBe(true);
  });

  it('rejects a record with no provenance', () => {
    // Requirement section 5: every chronological value is traceable. A record
    // without a source reference must not be representable.
    const result = PersonChronologySchema.safeParse({
      ...baseChronologyRecord,
      sourceReferences: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a number hiding under UNKNOWN confidence', () => {
    const result = PersonChronologySchema.safeParse({
      ...baseChronologyRecord,
      birthConfidence: 'UNKNOWN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a null year that claims to be known', () => {
    const result = PersonChronologySchema.safeParse({
      ...baseChronologyRecord,
      birthYear: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a fully unknown record, which most women in the dataset will be', () => {
    // Requirement sections 7 and 43: unknown stays unknown, and the schema must
    // make that a coherent state rather than a broken one.
    const result = PersonChronologySchema.safeParse({
      ...baseChronologyRecord,
      personId: 'rebekah',
      birthYear: null,
      deathYear: null,
      lifespan: null,
      birthConfidence: 'UNKNOWN',
      deathConfidence: 'UNKNOWN',
      lifespanConfidence: 'UNKNOWN',
      birthSourceType: 'UNKNOWN',
      deathSourceType: 'UNKNOWN',
      lifespanSourceType: 'UNKNOWN',
      sourceReferences: ['GEN.24.67'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a death before a birth', () => {
    const result = PersonChronologySchema.safeParse({
      ...baseChronologyRecord,
      birthYear: 1000,
      deathYear: 900,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative lifespan', () => {
    const result = PersonChronologySchema.safeParse({
      ...baseChronologyRecord,
      lifespan: -1,
      lifespanConfidence: 'EXPLICIT',
    });
    expect(result.success).toBe(false);
  });
});

describe('DerivationSchema', () => {
  const steps = [
    { from: 'adam', to: 'seth', years: 130, reference: 'GEN.5.3', runningTotal: 130 },
    { from: 'seth', to: 'enosh', years: 105, reference: 'GEN.5.6', runningTotal: 235 },
  ];

  it('accepts a derivation whose arithmetic holds', () => {
    const result = DerivationSchema.safeParse({
      method: 'genesis-5-begetting-chain',
      unit: 'AM',
      result: 235,
      steps,
      assumptions: ['adam-created-at-year-zero'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a derivation whose result disagrees with its own steps', () => {
    // A stored derivation that does not add up is a build failure, not a note.
    const result = DerivationSchema.safeParse({
      method: 'genesis-5-begetting-chain',
      unit: 'AM',
      result: 999,
      steps,
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a running total that skips a step', () => {
    const result = DerivationSchema.safeParse({
      method: 'genesis-5-begetting-chain',
      unit: 'AM',
      result: 300,
      steps: [
        { from: 'adam', to: 'seth', years: 130, reference: 'GEN.5.3', runningTotal: 130 },
        {
          from: 'seth',
          to: 'enosh',
          years: 105,
          reference: 'GEN.5.6',
          runningTotal: 300,
        },
      ],
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('PersonSchema', () => {
  it('requires a slug-safe identifier', () => {
    expect(
      PersonSchema.safeParse({ id: 'Methuselah!', canonicalName: 'M', slug: 'm' })
        .success,
    ).toBe(false);
  });

  it('defaults gender to unknown rather than assuming male', () => {
    // Requirement section 43: this is not an exclusively male genealogy system.
    const parsed = PersonSchema.parse({
      id: 'tamar',
      canonicalName: 'Tamar',
      slug: 'tamar',
    });
    expect(parsed.gender).toBe('unknown');
  });
});

describe('RelationshipSchema', () => {
  it('rejects a self-relationship', () => {
    const result = RelationshipSchema.safeParse({
      sourcePersonId: 'enoch',
      targetPersonId: 'enoch',
      relationshipType: 'parent',
      confidence: 'EXPLICIT',
      sourceType: 'SCRIPTURE_EXPLICIT',
    });
    expect(result.success).toBe(false);
  });
});

describe('ScriptureReferenceSchema', () => {
  it('accepts references outside Genesis, which the Terah derivation needs', () => {
    const result = ScriptureReferenceSchema.safeParse({
      id: 'ACT.7.4',
      book: 'ACT',
      chapter: 7,
      verseStart: 4,
      verseEnd: 4,
      canonicalKey: 'ACT.7.4',
      displayLabel: 'Acts 7:4',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed reference id', () => {
    expect(
      ScriptureReferenceSchema.safeParse({
        id: 'Genesis 5:21',
        book: 'GEN',
        chapter: 5,
        canonicalKey: 'x',
        displayLabel: 'y',
      }).success,
    ).toBe(false);
  });
});

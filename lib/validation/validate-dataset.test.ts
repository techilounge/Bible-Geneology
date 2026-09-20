import { describe, expect, it } from 'vitest';
import {
  findParentCycles,
  validateDataset,
  type CanonicalFiles,
} from './validate-dataset';

/**
 * A gate nobody has seen fail is a gate nobody knows works. These deliberately
 * corrupt a minimal dataset and assert the validator catches each case.
 */
function baseFiles(): CanonicalFiles {
  return {
    eras: [{ id: 'antediluvian', name: 'Before the Flood', sortOrder: 10 }],
    sources: [
      { id: 'masoretic-text', name: 'Masoretic Text', sourceType: 'TEXTUAL_TRADITION' },
    ],
    scriptureReferences: [
      {
        id: 'GEN.5.3',
        book: 'GEN',
        chapter: 5,
        verseStart: 3,
        verseEnd: 3,
        canonicalKey: 'GEN.5.3',
        displayLabel: 'Genesis 5:3',
      },
    ],
    chronologies: [
      {
        id: 'masoretic',
        name: 'Masoretic',
        description: 'Masoretic chronology',
        isDefault: true,
        sourceId: 'masoretic-text',
      },
    ],
    assumptions: [
      { id: 'adam-created-at-year-zero', title: 'Epoch', explanation: 'Year zero.' },
    ],
    people: [
      {
        id: 'adam',
        canonicalName: 'Adam',
        slug: 'adam',
        eraId: 'antediluvian',
        primaryScriptureReferences: ['GEN.5.3'],
      },
      {
        id: 'seth',
        canonicalName: 'Seth',
        slug: 'seth',
        eraId: 'antediluvian',
        primaryScriptureReferences: ['GEN.5.3'],
      },
    ],
    personNames: [],
    relationships: [
      {
        sourcePersonId: 'adam',
        targetPersonId: 'seth',
        relationshipType: 'parent',
        sourceReferences: ['GEN.5.3'],
        confidence: 'EXPLICIT',
        sourceType: 'SCRIPTURE_EXPLICIT',
      },
    ],
    events: [
      {
        id: 'the-flood',
        name: 'The Flood',
        slug: 'the-flood',
        description: 'The flood of Genesis 7.',
        eventType: 'judgement',
        relatedPersonIds: ['adam'],
        sourceReferences: ['GEN.5.3'],
        reviewStatus: 'DRAFT',
      },
    ],
    eventChronology: [
      {
        eventId: 'the-flood',
        chronologyId: 'masoretic',
        rule: 'person-age',
        anchorPersonId: 'adam',
        value: 600,
        reference: 'GEN.5.3',
        dateType: 'point',
        assumptions: ['adam-created-at-year-zero'],
      },
    ],
    personChronology: [
      {
        personId: 'adam',
        chronologyId: 'masoretic',
        father: null,
        birthOffsetFromFather: { rule: 'epoch', value: 0, confidence: 'DERIVED' },
        lifespan: {
          rule: 'explicit',
          value: 930,
          reference: 'GEN.5.3',
          confidence: 'EXPLICIT',
        },
        deathRule: 'birth-plus-lifespan',
        assumptions: ['adam-created-at-year-zero'],
        reviewStatus: 'DRAFT',
        verifiedBy: null,
      },
    ],
  };
}

const severeChecks = (files: CanonicalFiles) =>
  validateDataset(files)
    .filter((f) => f.severity === 'severe')
    .map((f) => f.check);

describe('validateDataset', () => {
  it('passes a well-formed dataset', () => {
    expect(severeChecks(baseFiles())).toEqual([]);
  });

  it('catches a relationship pointing at a person who does not exist', () => {
    const files = baseFiles();
    (files.relationships[0] as Record<string, unknown>).targetPersonId = 'nobody';
    expect(severeChecks(files)).toContain('missing-person');
  });

  it('catches a scripture reference that does not resolve', () => {
    const files = baseFiles();
    (files.people[0] as Record<string, unknown>).primaryScriptureReferences = [
      'GEN.99.1',
    ];
    expect(severeChecks(files)).toContain('missing-reference');
  });

  it('catches a derived value hand-entered into canonical input', () => {
    // data/canonical holds sourced input only. A birth year here would be a
    // second source of truth that can drift from the engine.
    const files = baseFiles();
    (files.personChronology[0] as Record<string, unknown>).birthYear = 0;
    expect(severeChecks(files)).toContain('derived-value-in-canonical');
  });

  it('catches a figure with no scripture reference', () => {
    const files = baseFiles();
    (files.personChronology[0] as Record<string, unknown>).lifespan = {
      rule: 'explicit',
      value: 930,
      reference: null,
    };
    expect(severeChecks(files)).toContain('missing-provenance');
  });

  it('catches an unknown assumption identifier', () => {
    const files = baseFiles();
    (files.personChronology[0] as Record<string, unknown>).assumptions = [
      'invented-assumption',
    ];
    expect(severeChecks(files)).toContain('missing-assumption');
  });

  it('catches a record marked VERIFIED with no reviewer', () => {
    const files = baseFiles();
    (files.personChronology[0] as Record<string, unknown>).reviewStatus = 'VERIFIED';
    expect(severeChecks(files)).toContain('verified-without-reviewer');
  });

  it('catches a record leaving DRAFT while a figure is still unread', () => {
    const files = baseFiles();
    const row = files.personChronology[0] as Record<string, unknown>;
    row.lifespan = { rule: 'explicit', value: null, reference: 'GEN.5.3' };
    row.reviewStatus = 'SOURCE_CHECKED';
    expect(severeChecks(files)).toContain('unread-figure-not-draft');
  });

  it('catches a duplicate person identifier', () => {
    const files = baseFiles();
    files.people.push({ ...(files.people[0] as object) });
    expect(severeChecks(files)).toContain('duplicate-person');
  });

  it('catches more than one default chronology', () => {
    const files = baseFiles();
    files.chronologies.push({
      id: 'septuagint',
      name: 'Septuagint',
      description: 'LXX',
      isDefault: true,
    });
    expect(severeChecks(files)).toContain('default-chronology');
  });

  it('catches a stored transitive relationship with no justification', () => {
    const files = baseFiles();
    files.relationships.push({
      sourcePersonId: 'adam',
      targetPersonId: 'seth',
      relationshipType: 'ancestor',
      sourceReferences: ['GEN.5.3'],
      confidence: 'EXPLICIT',
      sourceType: 'SCRIPTURE_EXPLICIT',
    });
    expect(severeChecks(files)).toContain('derivable-relationship');
  });

  it('catches an ancestry cycle', () => {
    const files = baseFiles();
    files.relationships.push({
      sourcePersonId: 'seth',
      targetPersonId: 'adam',
      relationshipType: 'parent',
      sourceReferences: ['GEN.5.3'],
      confidence: 'EXPLICIT',
      sourceType: 'SCRIPTURE_EXPLICIT',
    });
    expect(severeChecks(files)).toContain('parent-cycle');
  });

  it('warns rather than fails while figures are still unread', () => {
    const files = baseFiles();
    (files.personChronology[0] as Record<string, unknown>).lifespan = {
      rule: 'explicit',
      value: null,
      reference: 'GEN.5.3',
    };
    const findings = validateDataset(files);
    expect(findings.filter((f) => f.severity === 'severe')).toEqual([]);
    expect(findings.map((f) => f.check)).toContain('figure-not-yet-read');
  });
});

describe('findParentCycles', () => {
  it('finds a three-person cycle', () => {
    const cycles = findParentCycles([
      { sourcePersonId: 'a', targetPersonId: 'b', relationshipType: 'parent' },
      { sourcePersonId: 'b', targetPersonId: 'c', relationshipType: 'parent' },
      { sourcePersonId: 'c', targetPersonId: 'a', relationshipType: 'parent' },
    ]);
    expect(cycles).toHaveLength(1);
  });

  it('does not mistake a diamond for a cycle', () => {
    // Two parents, one child: normal, and not a cycle.
    expect(
      findParentCycles([
        { sourcePersonId: 'father', targetPersonId: 'child', relationshipType: 'parent' },
        { sourcePersonId: 'mother', targetPersonId: 'child', relationshipType: 'parent' },
      ]),
    ).toEqual([]);
  });
});

describe('validateDataset: event dates', () => {
  it('catches a derived year typed into the canonical event file', () => {
    const files = baseFiles();
    (files.eventChronology[0] as Record<string, unknown>)['startYear'] = 1656;
    expect(severeChecks(files)).toContain('derived-value-in-canonical');
  });

  it('catches an event anchored to a person who does not exist', () => {
    const files = baseFiles();
    (files.eventChronology[0] as Record<string, unknown>)['anchorPersonId'] = 'nobody';
    expect(severeChecks(files)).toContain('missing-anchor');
  });

  it('catches a person-age event with no age read from the text', () => {
    const files = baseFiles();
    (files.eventChronology[0] as Record<string, unknown>)['value'] = null;
    expect(severeChecks(files)).toContain('missing-figure');
  });

  it('catches an event rule the engine does not implement', () => {
    const files = baseFiles();
    (files.eventChronology[0] as Record<string, unknown>)['rule'] = 'guess';
    expect(severeChecks(files)).toContain('unknown-rule');
  });

  it('catches two records for the same event in one chronology', () => {
    const files = baseFiles();
    files.eventChronology.push({ ...(files.eventChronology[0] as object) });
    expect(severeChecks(files)).toContain('duplicate-event-chronology');
  });

  it('allows an event the text gives no date for', () => {
    const files = baseFiles();
    files.eventChronology = [
      {
        eventId: 'the-flood',
        chronologyId: 'masoretic',
        rule: 'unknown',
        value: null,
        reference: 'GEN.5.3',
        dateType: 'unknown',
        assumptions: [],
      },
    ];
    expect(severeChecks(files)).toEqual([]);
  });
});

describe('validateDataset: alternate chronology overrides', () => {
  const withOverride = (patch: Record<string, unknown> = {}): CanonicalFiles => {
    const files = baseFiles();
    files.chronologyOverrides = {
      'masoretic-gen11-26': {
        chronologyId: 'masoretic-gen11-26',
        baseChronologyId: 'masoretic',
        rationale: 'Reads Genesis 11:26 as a birth offset.',
        records: [{ personId: 'adam' }],
        ...patch,
      },
    };
    return files;
  };

  it('passes a well-formed override', () => {
    expect(severeChecks(withOverride())).toEqual([]);
  });

  it('catches an override of a person the base chronology does not date', () => {
    expect(severeChecks(withOverride({ records: [{ personId: 'nobody' }] }))).toContain(
      'override-unknown-person',
    );
  });

  it('catches an override whose base chronology does not exist', () => {
    expect(severeChecks(withOverride({ baseChronologyId: 'septuagint' }))).toContain(
      'override-missing-base',
    );
  });

  it('catches an override that does not say why it differs', () => {
    expect(severeChecks(withOverride({ rationale: undefined }))).toContain(
      'override-no-rationale',
    );
  });

  it('catches a derived year typed into an override', () => {
    expect(
      severeChecks(withOverride({ records: [{ personId: 'adam', birthYear: 1948 }] })),
    ).toContain('derived-value-in-canonical');
  });
});

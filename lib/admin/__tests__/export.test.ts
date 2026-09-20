import { describe, expect, it } from 'vitest';
import {
  canonicalPerson,
  canonicalRelationship,
  isVerified,
  mergeCanonical,
  relationshipKey,
  type CanonicalPerson,
} from '../export';

const personRow = {
  id: 'adam',
  canonical_name: 'Adam',
  slug: 'adam',
  gender: 'male',
  description: null,
  era_id: 'antediluvian',
  sort_order: 10,
  review_status: 'VERIFIED',
};

describe('a person, on the way back to the canonical file', () => {
  it('comes out in the shape the file already uses', () => {
    expect(canonicalPerson(personRow, ['GEN.5.3', 'GEN.5.1'])).toEqual({
      id: 'adam',
      canonicalName: 'Adam',
      slug: 'adam',
      gender: 'male',
      description: null,
      eraId: 'antediluvian',
      sortOrder: 10,
      primaryScriptureReferences: ['GEN.5.1', 'GEN.5.3'],
      reviewStatus: 'VERIFIED',
    });
  });

  it('reads a missing value as missing rather than as an empty string', () => {
    const sparse = canonicalPerson(
      { ...personRow, gender: '', era_id: null, sort_order: 1.5 },
      [],
    );
    expect(sparse.gender).toBeNull();
    expect(sparse.eraId).toBeNull();
    expect(sparse.sortOrder).toBeNull();
    expect(sparse.primaryScriptureReferences).toEqual([]);
  });
});

describe('a relationship', () => {
  it('comes out keyed by the pair and the kind', () => {
    const record = canonicalRelationship(
      {
        source_person_id: 'adam',
        target_person_id: 'seth',
        relationship_type: 'parent',
        confidence: 'EXPLICIT',
        source_type: 'SCRIPTURE_EXPLICIT',
        notes: null,
        review_status: 'VERIFIED',
      },
      ['GEN.5.3'],
    );
    expect(record.sourceReferences).toEqual(['GEN.5.3']);
    expect(record.notes).toBeNull();
    expect(relationshipKey(record)).toBe('adam|seth|parent');
  });
});

describe('which rows are exported at all', () => {
  it('is the verified ones', () => {
    expect(isVerified({ review_status: 'VERIFIED' })).toBe(true);
    for (const status of ['DRAFT', 'SOURCE_CHECKED', 'DISPUTED', 'DEPRECATED']) {
      expect(isVerified({ review_status: status }), status).toBe(false);
    }
  });
});

describe('folding an export into what the file already holds', () => {
  const person = (id: string, name: string): CanonicalPerson => ({
    id,
    canonicalName: name,
    slug: id,
    gender: null,
    description: null,
    eraId: null,
    sortOrder: null,
    primaryScriptureReferences: [],
    reviewStatus: 'VERIFIED',
  });
  const keyOf = (record: CanonicalPerson) => record.id;

  it('replaces a record that changed and leaves the order alone', () => {
    const result = mergeCanonical(
      [person('adam', 'Adam'), person('seth', 'Seth')],
      [person('adam', 'Adam the first')],
      keyOf,
    );
    expect(result.merged.map((p) => p.canonicalName)).toEqual(['Adam the first', 'Seth']);
    expect(result.replaced).toEqual(['adam']);
    expect(result.added).toEqual([]);
  });

  it('counts an unchanged record as untouched', () => {
    const result = mergeCanonical(
      [person('adam', 'Adam')],
      [person('adam', 'Adam')],
      keyOf,
    );
    expect(result.replaced).toEqual([]);
    expect(result.added).toEqual([]);
  });

  it('appends what the file did not have, in key order', () => {
    const result = mergeCanonical(
      [person('adam', 'Adam')],
      [person('seth', 'Seth'), person('enosh', 'Enosh')],
      keyOf,
    );
    expect(result.merged.map((p) => p.id)).toEqual(['adam', 'enosh', 'seth']);
    expect(result.added).toEqual(['enosh', 'seth']);
  });

  it('never removes what the export did not mention', () => {
    const result = mergeCanonical([person('adam', 'Adam')], [], keyOf);
    expect(result.merged.map((p) => p.id)).toEqual(['adam']);
  });

  it('merges nothing into nothing', () => {
    expect(mergeCanonical<CanonicalPerson>([], [], keyOf)).toEqual({
      merged: [],
      replaced: [],
      added: [],
    });
  });
});

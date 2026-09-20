import { describe, expect, it } from 'vitest';
import { changedFields, readable, summariseChange } from '../diff';

describe('reading a value the way a reviewer would', () => {
  it('leaves a string alone and spells out the rest', () => {
    expect(readable('Adam')).toBe('Adam');
    expect(readable(930)).toBe('930');
    expect(readable(true)).toBe('true');
    expect(readable({ sources: ['kjv'] })).toBe('{"sources":["kjv"]}');
    expect(readable(null)).toBeNull();
    expect(readable(undefined)).toBeNull();
  });
});

describe('what changed between two versions of a row', () => {
  it('lists only the fields that moved, in a stable order', () => {
    expect(
      changedFields(
        { id: 'adam', canonical_name: 'Adam', review_status: 'DRAFT' },
        { id: 'adam', canonical_name: 'Adam', review_status: 'VERIFIED' },
      ),
    ).toEqual([{ field: 'review_status', before: 'DRAFT', after: 'VERIFIED' }]);
  });

  it('ignores the bookkeeping columns', () => {
    expect(
      changedFields(
        {
          id: 'adam',
          updated_at: 'then',
          updated_by: 'a',
          created_at: 'then',
          created_by: 'a',
        },
        {
          id: 'adam',
          updated_at: 'now',
          updated_by: 'b',
          created_at: 'then',
          created_by: 'a',
        },
      ),
    ).toEqual([]);
  });

  it('reads an added field and a removed one', () => {
    expect(changedFields({ a: 1 }, { a: 1, b: 2 })).toEqual([
      { field: 'b', before: null, after: '2' },
    ]);
    expect(changedFields({ a: 1, b: 2 }, { a: 1 })).toEqual([
      { field: 'b', before: '2', after: null },
    ]);
  });

  it('reads a creation and a deletion, where one side is missing', () => {
    expect(changedFields(null, { id: 'adam' })).toEqual([
      { field: 'id', before: null, after: 'adam' },
    ]);
    expect(changedFields({ id: 'adam' }, null)).toEqual([
      { field: 'id', before: 'adam', after: null },
    ]);
    expect(changedFields(null, null)).toEqual([]);
  });
});

describe('the one-line summary', () => {
  it('says what happened', () => {
    expect(summariseChange('insert', [])).toBe('Record created');
    expect(summariseChange('delete', [])).toBe('Record deleted');
    expect(summariseChange('update', [])).toBe('No fields changed');
    expect(
      summariseChange('update', [{ field: 'review_status', before: 'a', after: 'b' }]),
    ).toBe('review_status changed');
    expect(
      summariseChange('update', [
        { field: 'a', before: null, after: '1' },
        { field: 'b', before: null, after: '2' },
      ]),
    ).toBe('2 fields changed');
  });
});

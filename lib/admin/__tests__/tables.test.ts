import { describe, expect, it } from 'vitest';
import { EDITABLE_TABLES, readFields, readSources, tableByName } from '../tables';

const people = tableByName('people');
const chronology = tableByName('person_chronology');

if (!people || !chronology) throw new Error('the fixtures name tables that exist');

/**
 * The writable surface is the security boundary here: a form is a POST,
 * and a POST can carry any field name somebody types. Every case below
 * is something a hand-written post could send.
 */
describe('which tables can be edited', () => {
  it('names only the ones on the list', () => {
    expect(EDITABLE_TABLES.map((table) => table.name)).toEqual([
      'people',
      'person_chronology',
    ]);
    expect(tableByName('audit_logs')).toBeNull();
    expect(tableByName('profiles')).toBeNull();
    expect(tableByName('')).toBeNull();
  });

  it('never lists a column the rules are supposed to own', () => {
    for (const table of EDITABLE_TABLES) {
      const names = table.fields.map((field) => field.name);
      for (const owned of [
        'id',
        'review_status',
        'revision_notes',
        'verification',
        'verified_by',
        'verified_by_label',
        'created_by',
        'updated_by',
      ]) {
        expect(names, `${table.name}.${owned}`).not.toContain(owned);
      }
    }
  });
});

describe('reading a posted form', () => {
  it('keeps the fields the table has', () => {
    expect(
      readFields(people, { canonical_name: 'Adam', description: 'The first' }),
    ).toEqual({
      values: { canonical_name: 'Adam', description: 'The first' },
      rejected: [],
    });
  });

  it('rejects a field the table does not have', () => {
    const read = readFields(people, {
      canonical_name: 'Adam',
      review_status: 'VERIFIED',
    });
    expect(read.values).toEqual({ canonical_name: 'Adam' });
    expect(read.rejected).toEqual(['review_status']);
  });

  it('reads an empty value as cleared rather than as an empty string', () => {
    expect(readFields(people, { description: '   ' }).values).toEqual({
      description: null,
    });
  });

  it('refuses to invent a number out of something that is not one', () => {
    const read = readFields(chronology, { birth_year: 'about nine hundred' });
    expect(read.values).toEqual({});
    expect(read.rejected).toEqual(['birth_year']);
  });

  it('reads a negative year, which the epoch allows', () => {
    expect(readFields(chronology, { birth_year: '-40' }).values).toEqual({
      birth_year: -40,
    });
  });

  it('refuses a value outside an enumerated field', () => {
    expect(readFields(chronology, { birth_confidence: 'PROBABLY' }).rejected).toEqual([
      'birth_confidence',
    ]);
    expect(readFields(chronology, { birth_confidence: 'DERIVED' }).values).toEqual({
      birth_confidence: 'DERIVED',
    });
  });

  it('reads nothing out of nothing', () => {
    expect(readFields(people, {})).toEqual({ values: {}, rejected: [] });
  });
});

describe('reading the sources a reviewer typed', () => {
  it('takes one per line and drops the blanks', () => {
    expect(readSources('kjv-1769\n\n  web-bible  \n')).toEqual(['kjv-1769', 'web-bible']);
    expect(readSources('   ')).toEqual([]);
    expect(readSources('')).toEqual([]);
  });
});

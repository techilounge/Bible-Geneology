import { describe, expect, it } from 'vitest';
import { buildDataset, hasDates, isPresent, lookup } from '../dataset';
import { fixtureDataset } from './fixtures';

const dataset = fixtureDataset();

const ancestor = dataset.chronology.get('ancestor');
const parentRecord = dataset.chronology.get('parent');
if (!ancestor || !parentRecord) throw new Error('fixture missing');

describe('buildDataset', () => {
  it('keeps only the chronology records belonging to this chronology', () => {
    const built = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [ancestor, { ...parentRecord, chronologyId: 'elsewhere' }],
      relationships: [],
    });
    expect([...built.chronology.keys()]).toEqual(['ancestor']);
  });

  it('works with no events at all', () => {
    const built = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [],
      relationships: [],
    });
    expect(built.events.size).toBe(0);
    expect(built.eventChronology.size).toBe(0);
  });

  it('keeps only the event dates belonging to this chronology', () => {
    expect([...dataset.eventChronology.keys()].sort()).toEqual([
      'mid-event',
      'undated-event',
    ]);
  });
});

describe('the two kinds of absence', () => {
  it('distinguishes present-but-undated from absent entirely', () => {
    // The Septuagint includes a generation the Masoretic text does not, so
    // these are different facts and the UI says different things about them.
    expect(isPresent(dataset, 'undated')).toBe(true);
    expect(isPresent(dataset, 'absent')).toBe(false);
  });

  it('returns null from lookup for someone with no record', () => {
    expect(lookup(dataset, 'absent')).toBeNull();
  });

  it('narrows to a record with both years via hasDates', () => {
    expect(hasDates(lookup(dataset, 'ancestor'))).toBe(true);
    expect(hasDates(lookup(dataset, 'openended'))).toBe(false);
    expect(hasDates(lookup(dataset, 'undated'))).toBe(false);
    expect(hasDates(null)).toBe(false);
  });
});

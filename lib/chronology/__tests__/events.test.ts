import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { getEventsDuringLifetime } from '../events';
import { fixtureDataset } from './fixtures';

const dataset = fixtureDataset();

describe('getEventsDuringLifetime', () => {
  it('returns the events inside a lifetime, with the age at each', () => {
    // 'mid-event' falls in year 60; 'parent' lives 50 to 150.
    const result = getEventsDuringLifetime(dataset, 'parent');
    expect(result.status).toBe('known');
    if (result.status !== 'known') return;
    expect(result.value).toEqual([
      { eventId: 'mid-event', startYear: 60, endYear: 60, ageAtEvent: 10 },
    ]);
  });

  it('leaves out an event whose year is unknown rather than placing it', () => {
    // Babel is the real case. An undated event on a timeline at a guessed
    // year is the failure mode this whole dataset exists to avoid.
    const result = getEventsDuringLifetime(dataset, 'parent');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.value.map((e) => e.eventId)).not.toContain('undated-event');
  });

  it('returns an empty list, not unknown, when a dated life contains no event', () => {
    // 'child' lives 100 to 150; the only dated event is in year 60.
    const result = getEventsDuringLifetime(dataset, 'child');
    expect(result.status).toBe('known');
    if (result.status === 'known') expect(result.value).toEqual([]);
  });

  it('is unknown when the person has a record but no dates', () => {
    const result = getEventsDuringLifetime(dataset, 'undated');
    expect(result).toEqual({ status: 'unknown', reason: 'unknown-in-chronology' });
  });

  it('is unknown when the person has no record in this chronology', () => {
    const result = getEventsDuringLifetime(dataset, 'absent');
    expect(result).toEqual({ status: 'unknown', reason: 'not-applicable' });
  });

  it('is unknown for someone with no recorded death, not a truncated list', () => {
    // 'openended' is born in year 10 and has no death year. The event in year
    // 60 may well fall in his lifetime, but the chronology cannot say so.
    const result = getEventsDuringLifetime(dataset, 'openended');
    expect(result).toEqual({ status: 'unknown', reason: 'unknown-in-chronology' });
  });
});

const ancestorRecord = dataset.chronology.get('ancestor');
if (!ancestorRecord) throw new Error('fixture missing an ancestor record');

describe('several events in one lifetime', () => {
  it('returns them in year order regardless of the order they are stored', () => {
    const withTwo = buildDataset({
      chronologyId: 'fixture',
      people: [],
      chronology: [ancestorRecord],
      relationships: [],
      events: [...dataset.events.values()],
      eventChronology: [
        {
          eventId: 'later',
          chronologyId: 'fixture',
          startYear: 80,
          endYear: 80,
          dateType: 'point',
          confidence: 'DERIVED',
          sourceType: 'SCRIPTURE_DERIVED',
          derivation: null,
          notes: null,
          reviewStatus: 'DRAFT',
        },
        ...[...dataset.eventChronology.values()],
      ],
    });
    const result = getEventsDuringLifetime(withTwo, 'ancestor');
    if (result.status !== 'known') throw new Error('expected a known result');
    expect(result.value.map((e) => e.eventId)).toEqual(['mid-event', 'later']);
    expect(result.value.map((e) => e.ageAtEvent)).toEqual([60, 80]);
  });
});

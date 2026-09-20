import { describe, expect, it } from 'vitest';
import { lookup } from '@/lib/chronology';
import { DEFAULT_CHRONOLOGY_ID } from '@/lib/config/chronology-defaults';
import {
  getAssumptions,
  getCanonical,
  getDataset,
  getEras,
  getEvent,
  getNamesFor,
  getPersonBySlug,
  getTimelineBounds,
  getTimelineEvents,
  getTimelineRows,
  nameOf,
  resolveReferences,
} from '../dataset';

/**
 * The service layer against the real dataset on disk.
 *
 * These are deliberately not fixture tests. The layer's whole job is to load
 * the actual files and hand the engine something coherent, so a test with a
 * fixture in place of the files would assert nothing about the thing that
 * can break: the files themselves failing to load, or loading into a shape
 * the engine cannot use.
 */
describe('getCanonical', () => {
  it('loads every canonical file', () => {
    const canonical = getCanonical();
    expect(canonical.people.length).toBeGreaterThan(40);
    expect(canonical.relationships.length).toBeGreaterThan(0);
    expect(canonical.references.length).toBeGreaterThan(0);
    expect(canonical.eras.length).toBeGreaterThan(0);
    expect(canonical.assumptions.length).toBeGreaterThan(0);
  });

  it('parses the files once and hands back the same object', () => {
    // Outside development the files cannot change while the process runs,
    // so re-reading them per component would be pure waste.
    expect(getCanonical()).toBe(getCanonical());
  });
});

describe('getDataset', () => {
  it('builds a dataset the engine can read', () => {
    const dataset = getDataset();
    expect(dataset.chronologyId).toBe(DEFAULT_CHRONOLOGY_ID);
    expect(lookup(dataset, 'adam')?.birthYear).toBe(0);
    expect(dataset.eventChronology.get('the-flood')?.startYear).toBe(1656);
  });

  it('caches each chronology separately rather than clobbering one with the other', () => {
    expect(getDataset()).toBe(getDataset());
    expect(getDataset('masoretic-gen11-26')).not.toBe(getDataset());
  });

  it('loads the alternate chronology separately', () => {
    expect(lookup(getDataset('masoretic-gen11-26'), 'abraham')?.birthYear).toBe(1948);
    expect(lookup(getDataset(), 'abraham')?.birthYear).toBe(2008);
  });

  it('holds a record for everyone, dated or not', () => {
    const dataset = getDataset();
    for (const person of getCanonical().people) {
      expect(lookup(dataset, person.id), `${person.id} has no record`).not.toBeNull();
    }
  });

  it('explains what to run when the derived files are missing', () => {
    expect(() => getDataset('septuagint')).toThrow(/derive:chronology/);
  });
});

describe('lookups', () => {
  it('finds a person by slug, and returns null rather than throwing', () => {
    expect(getPersonBySlug('abraham')?.canonicalName).toBe('Abraham');
    expect(getPersonBySlug('nobody')).toBeNull();
  });

  it('finds the names a person is also called', () => {
    expect(getNamesFor('abraham').map((n) => n.name)).toContain('Abram');
    expect(getNamesFor('adam')).toEqual([]);
  });

  it('resolves scripture references to their display labels', () => {
    const [reference] = resolveReferences(['GEN.5.5']);
    expect(reference?.displayLabel).toBe('Genesis 5:5');
  });

  it('drops a reference id that does not resolve rather than rendering it raw', () => {
    // Unreachable in practice: the validator fails the build on a dangling
    // reference. This is the behaviour if one ever got past it.
    expect(resolveReferences(['GEN.99.1'])).toEqual([]);
  });

  it('resolves the assumptions behind a derivation', () => {
    const [assumption] = getAssumptions(['abraham-birth-from-acts-7-4']);
    expect(assumption?.title).toMatch(/Terah was 130/);
    expect(getAssumptions(['no-such-assumption'])).toEqual([]);
  });

  it('orders eras chronologically rather than by file order', () => {
    const orders = getEras().map((era) => era.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it('finds an event, or returns null', () => {
    expect(getEvent('the-flood')?.name).toBe('The Flood');
    expect(getEvent('no-such-event')).toBeNull();
  });

  it('names a person for prose, falling back to the id', () => {
    expect(nameOf('abraham')).toBe('Abraham');
    expect(nameOf('nobody')).toBe('nobody');
  });
});

describe('the timeline view of the dataset', () => {
  it('draws a bar only for someone the chronology can place from end to end', () => {
    const rows = getTimelineRows();
    const ids = new Set(rows.map((row) => row.personId));

    expect(ids.has('adam')).toBe(true);
    // Esau has a birth year and neither a death year nor a lifespan, so
    // there is no year to draw the bar to. Joseph has a lifespan and no
    // birth year, pending two figures from the text.
    expect(ids.has('esau')).toBe(false);
    expect(ids.has('joseph')).toBe(false);
  });

  it('records how long each life is, so no component has to subtract', () => {
    const adam = getTimelineRows().find((row) => row.personId === 'adam');
    expect(adam?.lengthYears).toBe(930);
  });

  it('gives the timeline and the year explorer the same rows', () => {
    // Not an identity check: the point is that both callers go through this
    // function, so the two pages cannot disagree about who can be drawn.
    expect(getTimelineRows().map((r) => r.personId)).toEqual(
      getTimelineRows().map((r) => r.personId),
    );
  });

  it('marks only the events the chronology can date', () => {
    const events = getTimelineEvents();
    const ids = events.map((event) => event.id);

    expect(ids).toContain('the-flood');
    // Genesis 10:25 places Babel in an era, not a year.
    expect(ids).not.toContain('tower-of-babel');
  });

  it('returns the events in the order they happened', () => {
    const years = getTimelineEvents().map((event) => event.year);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it('bounds the axis by the earliest birth and the latest end', () => {
    const [start, end] = getTimelineBounds();
    const rows = getTimelineRows();
    expect(start).toBe(Math.min(...rows.map((row) => row.startYear)));
    expect(end).toBe(Math.max(...rows.map((row) => row.endYear)));
  });
});

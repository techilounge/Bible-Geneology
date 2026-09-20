import { describe, expect, it } from 'vitest';
import type { PersonChronology } from '@/lib/domain';
import {
  axisTicks,
  buildRows,
  clampDomain,
  createScale,
  extentOf,
  overlappingIds,
  packLanes,
  visibleRows,
  zoomAbout,
  type TimelineInput,
  type TimelineRow,
} from '../scale';

function record(
  birthYear: number | null,
  deathYear: number | null,
  lifespan: number | null,
): PersonChronology {
  return {
    personId: 'x',
    chronologyId: 'fixture',
    birthYear,
    deathYear,
    lifespan,
    birthConfidence: birthYear === null ? 'UNKNOWN' : 'DERIVED',
    deathConfidence: deathYear === null ? 'UNKNOWN' : 'DERIVED',
    lifespanConfidence: lifespan === null ? 'UNKNOWN' : 'EXPLICIT',
    birthSourceType: 'SCRIPTURE_DERIVED',
    deathSourceType: 'SCRIPTURE_DERIVED',
    lifespanSourceType: 'SCRIPTURE_EXPLICIT',
    sourceReferences: ['GEN.5.1'],
    calculationMethod: null,
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

const entry = (
  personId: string,
  birth: number | null,
  death: number | null,
  lifespan: number | null,
): TimelineInput => ({
  personId,
  name: personId,
  slug: personId,
  record: { ...record(birth, death, lifespan), personId },
});

describe('createScale', () => {
  it('maps the domain across the width', () => {
    const scale = createScale([0, 100], 500);
    expect(scale.yearToX(0)).toBe(0);
    expect(scale.yearToX(50)).toBe(250);
    expect(scale.yearToX(100)).toBe(500);
  });

  it('inverts', () => {
    const scale = createScale([1000, 2000], 400);
    expect(scale.xToYear(200)).toBe(1500);
  });

  it('reports pixels per year', () => {
    expect(createScale([0, 100], 500).pixelsPerYear).toBe(5);
  });

  it('refuses a zero-width domain rather than stacking every bar on one pixel', () => {
    const scale = createScale([500, 500], 400);
    expect(scale.domain).toEqual([500, 501]);
    expect(Number.isFinite(scale.pixelsPerYear)).toBe(true);
  });

  it('refuses an inverted domain', () => {
    expect(createScale([100, 50], 400).domain).toEqual([100, 101]);
  });

  it('survives a zero width, which is what a container measures before layout', () => {
    const scale = createScale([0, 100], 0);
    expect(scale.width).toBe(1);
    expect(Number.isFinite(scale.yearToX(50))).toBe(true);
  });
});

describe('axisTicks', () => {
  it('picks round years rather than evenly divided ones', () => {
    const ticks = axisTicks(createScale([0, 2400], 1000), 6);
    expect(ticks.every((t) => t % 100 === 0)).toBe(true);
  });

  it('returns whole years only', () => {
    const ticks = axisTicks(createScale([0, 5], 1000), 20);
    expect(ticks.every(Number.isInteger)).toBe(true);
  });

  it('never asks for fewer than two', () => {
    expect(axisTicks(createScale([0, 1000], 100), 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildRows', () => {
  it('places a closed life from birth to death', () => {
    const [row] = buildRows([entry('adam', 0, 930, 930)]);
    expect(row).toMatchObject({ startYear: 0, endYear: 930, openEnded: false });
  });

  it('draws a life with a lifespan and no recorded death, and flags it', () => {
    // Enoch. The text gives the length but not the end, so the bar has a
    // length and says the end is not recorded.
    const [row] = buildRows([entry('enoch', 622, null, 365)]);
    expect(row).toMatchObject({ startYear: 622, endYear: 987, openEnded: true });
  });

  it('leaves out a birth year with no length rather than guessing one', () => {
    expect(buildRows([entry('unknown-length', 100, null, null)])).toEqual([]);
  });

  it('leaves out anyone with no birth year', () => {
    expect(buildRows([entry('undated', null, null, null)])).toEqual([]);
  });

  it('sorts by birth year', () => {
    const rows = buildRows([entry('later', 100, 200, 100), entry('earlier', 0, 50, 50)]);
    expect(rows.map((r) => r.personId)).toEqual(['earlier', 'later']);
  });

  it('breaks a tie on birth year by id, so the order is stable', () => {
    const rows = buildRows([entry('b', 0, 10, 10), entry('a', 0, 10, 10)]);
    expect(rows.map((r) => r.personId)).toEqual(['a', 'b']);
  });

  it('never puts two overlapping lives in the same lane', () => {
    const rows = buildRows([
      entry('a', 0, 100, 100),
      entry('b', 50, 150, 100),
      entry('c', 60, 160, 100),
    ]);
    const lanes = new Map(rows.map((r) => [r.personId, r.lane]));
    expect(lanes.get('a')).not.toBe(lanes.get('b'));
    expect(lanes.get('b')).not.toBe(lanes.get('c'));
    expect(lanes.get('a')).not.toBe(lanes.get('c'));
  });

  it('reuses a lane once it is free', () => {
    const rows = buildRows([entry('a', 0, 100, 100), entry('b', 100, 200, 100)]);
    expect(rows[0]?.lane).toBe(0);
    expect(rows[1]?.lane).toBe(0);
  });

  it('handles an empty dataset', () => {
    expect(buildRows([])).toEqual([]);
  });
});

describe('extentOf', () => {
  it('spans from the earliest birth to the latest end', () => {
    const rows = buildRows([entry('a', 0, 100, 100), entry('b', 50, 900, 850)]);
    expect(extentOf(rows)).toEqual([0, 900]);
  });

  it('takes the latest end, not the last row\u2019s', () => {
    // Methuselah's case: born later than his father and outliving him. The
    // rows are sorted by birth, so the last row is not the latest end.
    const rows = buildRows([entry('long', 0, 900, 900), entry('short', 100, 200, 100)]);
    expect(extentOf(rows)).toEqual([0, 900]);
  });

  it('is null when there is nothing to span', () => {
    expect(extentOf([])).toBeNull();
  });
});

describe('visibleRows', () => {
  const rows = buildRows([
    entry('early', 0, 100, 100),
    entry('middle', 500, 600, 100),
    entry('late', 1000, 1100, 100),
  ]);

  it('keeps a life that intersects the viewport', () => {
    expect(visibleRows(rows, [550, 700]).map((r) => r.personId)).toEqual(['middle']);
  });

  it('keeps a life that merely touches the edge', () => {
    expect(visibleRows(rows, [600, 700]).map((r) => r.personId)).toEqual(['middle']);
  });

  it('drops a life entirely outside', () => {
    expect(visibleRows(rows, [200, 300])).toEqual([]);
  });

  it('honours a margin, so scrolling does not reveal empty space first', () => {
    expect(visibleRows(rows, [200, 300], 300).map((r) => r.personId)).toEqual([
      'early',
      'middle',
    ]);
  });
});

describe('clampDomain', () => {
  const bounds = [0, 1000] as const;

  it('leaves a viewport inside the bounds alone', () => {
    expect(clampDomain([100, 200], bounds)).toEqual([100, 200]);
  });

  it('pulls a viewport back when it runs off the start', () => {
    expect(clampDomain([-50, 50], bounds)).toEqual([0, 100]);
  });

  it('pulls a viewport back when it runs off the end', () => {
    expect(clampDomain([950, 1050], bounds)).toEqual([900, 1000]);
  });

  it('refuses to zoom in past the minimum span', () => {
    expect(clampDomain([500, 501], bounds, 10)).toEqual([500, 510]);
  });

  it('refuses to zoom out past the data', () => {
    expect(clampDomain([-500, 1500], bounds)).toEqual([0, 1000]);
  });

  it('handles bounds narrower than the minimum span', () => {
    // A dataset of one short life. The viewport cannot be 10 years wide and
    // also inside 5 years of data, and the answer is to show the data.
    expect(clampDomain([0, 1], [0, 5], 10)).toEqual([0, 10]);
  });

  it('never inverts', () => {
    const [start, end] = clampDomain([800, 400], bounds);
    expect(end).toBeGreaterThan(start);
  });
});

describe('zoomAbout', () => {
  const bounds = [0, 1000] as const;

  it('keeps the focus year under the same point when zooming in', () => {
    const [start, end] = zoomAbout([0, 1000], 250, 0.5, bounds);
    // 250 was a quarter of the way across, and still is.
    expect((250 - start) / (end - start)).toBeCloseTo(0.25, 5);
  });

  it('widens when the factor is greater than one', () => {
    const [start, end] = zoomAbout([400, 600], 500, 2, bounds);
    expect(end - start).toBe(400);
  });

  it('stays inside the bounds when zooming out at an edge', () => {
    const [start, end] = zoomAbout([0, 200], 0, 4, bounds);
    expect(start).toBe(0);
    expect(end).toBeLessThanOrEqual(1000);
  });

  it('centres when the current span is zero', () => {
    const [start, end] = zoomAbout([500, 500], 500, 2, bounds);
    expect(end).toBeGreaterThan(start);
  });
});

describe('packLanes', () => {
  const bar = (
    personId: string,
    startYear: number,
    endYear: number,
  ): Omit<TimelineRow, 'lane'> => ({
    personId,
    name: personId,
    slug: personId,
    startYear,
    endYear,
    openEnded: false,
    birthConfidence: 'DERIVED',
    deathConfidence: 'DERIVED',
  });

  it('gives overlapping bars different lanes', () => {
    const packed = packLanes([bar('a', 0, 100), bar('b', 50, 150)]);
    expect(packed.map((row) => row.lane)).toEqual([0, 1]);
  });

  it('reuses a lane once it is free', () => {
    const packed = packLanes([bar('a', 0, 100), bar('b', 100, 200)]);
    expect(packed.map((row) => row.lane)).toEqual([0, 0]);
  });

  it('sorts by start year and breaks ties by id, whatever order it is given', () => {
    const packed = packLanes([bar('z', 50, 60), bar('b', 0, 10), bar('a', 0, 10)]);
    expect(packed.map((row) => row.personId)).toEqual(['a', 'b', 'z']);
  });

  it('closes the gap a filter leaves behind', () => {
    // Three bars in three lanes; drop the middle one and the survivors must
    // pack into lanes 0 and 1, not stay at 0 and 2.
    const all = [bar('a', 0, 100), bar('b', 10, 110), bar('c', 20, 120)];
    expect(packLanes(all).map((row) => row.lane)).toEqual([0, 1, 2]);

    const filtered = all.filter((row) => row.personId !== 'b');
    expect(packLanes(filtered).map((row) => row.lane)).toEqual([0, 1]);
  });

  it('does not mutate the array it is given', () => {
    const rows = [bar('z', 50, 60), bar('a', 0, 10)];
    packLanes(rows);
    expect(rows.map((row) => row.personId)).toEqual(['z', 'a']);
  });
});

describe('overlappingIds', () => {
  const row = (personId: string, startYear: number, endYear: number): TimelineRow => ({
    personId,
    name: personId,
    slug: personId,
    startYear,
    endYear,
    openEnded: false,
    birthConfidence: 'DERIVED',
    deathConfidence: 'DERIVED',
    lane: 0,
  });

  const rows = [row('a', 0, 100), row('b', 50, 150), row('c', 100, 200)];

  it('finds the lifetimes that share years with the subject', () => {
    expect([...overlappingIds(rows, 'a')]).toEqual(['b']);
  });

  it('never includes the subject itself', () => {
    expect(overlappingIds(rows, 'b').has('b')).toBe(false);
  });

  it('agrees with the half-open rule: dying the year another is born is not an overlap', () => {
    // 'a' ends in 100 and 'c' starts in 100. Assumption overlap-half-open
    // says that is zero years, and the chart must not highlight it.
    expect(overlappingIds(rows, 'a').has('c')).toBe(false);
    expect(overlappingIds(rows, 'c').has('a')).toBe(false);
  });

  it('returns nothing for a person who is not on the timeline', () => {
    expect(overlappingIds(rows, 'nobody').size).toBe(0);
  });
});

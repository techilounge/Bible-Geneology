import { ticks as d3Ticks } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import type { ConfidenceLevel, PersonChronology } from '@/lib/domain';
import { livingWindowEnd } from './alive';

/**
 * Year-to-pixel mapping, shared by every surface that draws time.
 *
 * The timeline and the family tree both read from here so a year lands in
 * the same place on both. Pure maths: no DOM, no React, no assumption about
 * SVG. If the renderer is ever swapped for Canvas (ARCHITECTURE.md section
 * 6), this module does not change.
 */
export interface TimelineScale {
  /** First and last year the viewport covers. */
  domain: readonly [number, number];
  /** Pixel width the domain is mapped onto. */
  width: number;
  yearToX: (year: number) => number;
  xToYear: (x: number) => number;
  /** Pixels per year, for sizing bars and deciding label density. */
  pixelsPerYear: number;
}

export function createScale(
  domain: readonly [number, number],
  width: number,
): TimelineScale {
  // A zero-width domain would divide by zero and put every bar at the same
  // pixel. One year wide is the smallest honest viewport.
  const [start, end] = domain;
  const safeEnd = end > start ? end : start + 1;
  const safeWidth = width > 0 ? width : 1;

  const scale = scaleLinear().domain([start, safeEnd]).range([0, safeWidth]);

  return {
    domain: [start, safeEnd],
    width: safeWidth,
    yearToX: (year) => scale(year),
    xToYear: (x) => scale.invert(x),
    pixelsPerYear: safeWidth / (safeEnd - start),
  };
}

/**
 * Round year labels at a spacing the viewport can actually fit.
 *
 * `count` is a hint, not a promise: d3 returns round numbers near that
 * count rather than exactly that many, which is what makes the labels read
 * as 500, 1000, 1500 instead of 487, 974, 1461.
 */
export function axisTicks(scale: TimelineScale, count = 8): number[] {
  const [start, end] = scale.domain;
  return d3Ticks(start, end, Math.max(2, count)).filter(Number.isInteger);
}

export interface TimelineRow {
  personId: string;
  name: string;
  slug: string;
  startYear: number;
  /** Where the bar ends: the death year, or birth + lifespan when open-ended. */
  endYear: number;
  /** True when Scripture records a lifespan but no death, as for Enoch. */
  openEnded: boolean;
  /**
   * How long the bar is, in years. Computed here rather than in the
   * component that prints it, so that no arithmetic on year values lives in
   * the presentation layer (requirement section 18, and the Phase 8 gate).
   */
  lengthYears: number;
  birthConfidence: PersonChronology['birthConfidence'];
  deathConfidence: PersonChronology['deathConfidence'];
  /** Row index, assigned so bars that overlap in time never share a row. */
  lane: number;
}

/** A dated event, drawn as a marker rather than a bar. */
export interface TimelineEvent {
  id: string;
  name: string;
  slug: string;
  year: number;
  confidence: ConfidenceLevel;
}

export interface TimelineInput {
  personId: string;
  name: string;
  slug: string;
  record: PersonChronology;
}

/**
 * Turns chronology records into rows, dropping anyone the dataset cannot
 * place and assigning lanes so no two bars collide.
 *
 * A person with a birth year and no lifespan is left out rather than drawn
 * as a bar of guessed length. A person with a lifespan and no death year is
 * drawn to birth-plus-lifespan and flagged, because the text does give the
 * length even though it does not give the end. The distinction is the same
 * one `livingWindowEnd` makes for the year explorer, and it is shared rather
 * than reimplemented so the two surfaces cannot drift.
 */
export function buildRows(input: readonly TimelineInput[]): TimelineRow[] {
  const placed: Array<Omit<TimelineRow, 'lane'>> = [];

  for (const entry of input) {
    const span = livingWindowEnd(entry.record);
    if (span === null || entry.record.birthYear === null) continue;

    placed.push({
      personId: entry.personId,
      name: entry.name,
      slug: entry.slug,
      startYear: entry.record.birthYear,
      endYear: span.end,
      openEnded: span.openEnded,
      lengthYears: span.end - entry.record.birthYear,
      birthConfidence: entry.record.birthConfidence,
      deathConfidence: entry.record.deathConfidence,
    });
  }

  return packLanes(placed);
}

/**
 * Sorts bars by start year and assigns each the first lane free by the time
 * it begins, so no two bars in a lane overlap.
 *
 * Separate from `buildRows` because filtering re-runs it. A filtered
 * timeline that kept the original lanes would show the gaps where the
 * hidden people used to be, which reads as missing data rather than as a
 * filter.
 */
export function packLanes(rows: readonly Omit<TimelineRow, 'lane'>[]): TimelineRow[] {
  const sorted = [...rows].sort(
    (a, b) => a.startYear - b.startYear || a.personId.localeCompare(b.personId),
  );

  const laneFreeFrom: number[] = [];
  return sorted.map((row) => {
    let lane = laneFreeFrom.findIndex((freeFrom) => freeFrom <= row.startYear);
    if (lane === -1) {
      lane = laneFreeFrom.length;
      laneFreeFrom.push(row.endYear);
    } else {
      laneFreeFrom[lane] = row.endYear;
    }
    return { ...row, lane };
  });
}

/**
 * The people whose lifetimes overlap the given one, by the same half-open
 * rule the engine uses.
 *
 * Half-open means someone born the year another dies does not overlap them
 * (assumption `overlap-half-open`). The timeline has to agree with the
 * overlap engine to the year, or the chart will highlight a pair the
 * "who was alive" answer denies.
 */
export function overlappingIds(
  rows: readonly TimelineRow[],
  personId: string,
): Set<string> {
  const subject = rows.find((row) => row.personId === personId);
  if (!subject) return new Set();

  const ids = new Set<string>();
  for (const row of rows) {
    if (row.personId === personId) continue;
    if (row.startYear < subject.endYear && subject.startYear < row.endYear) {
      ids.add(row.personId);
    }
  }
  return ids;
}

/** The full year range the rows cover, or null when there are none. */
export function extentOf(rows: readonly TimelineRow[]): [number, number] | null {
  if (rows.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    if (row.startYear < min) min = row.startYear;
    if (row.endYear > max) max = row.endYear;
  }
  return [min, max];
}

/**
 * The rows that intersect the viewport, plus a margin either side.
 *
 * Virtualization is by year rather than by row index, because the rows are
 * sorted by birth year and a viewport covers a contiguous slice of time.
 */
export function visibleRows(
  rows: readonly TimelineRow[],
  domain: readonly [number, number],
  marginYears = 0,
): TimelineRow[] {
  const from = domain[0] - marginYears;
  const to = domain[1] + marginYears;
  return rows.filter((row) => row.endYear >= from && row.startYear <= to);
}

/**
 * Clamps a proposed viewport so it stays inside the data and never inverts.
 *
 * Zooming and panning are the two places an off-by-one becomes an empty
 * chart, so the correction lives here where it can be tested, rather than in
 * an event handler where it cannot.
 */
export function clampDomain(
  proposed: readonly [number, number],
  bounds: readonly [number, number],
  minimumSpan = 10,
): [number, number] {
  const boundsSpan = bounds[1] - bounds[0];
  const span = Math.min(
    Math.max(proposed[1] - proposed[0], minimumSpan),
    Math.max(boundsSpan, minimumSpan),
  );

  let start = proposed[0];
  if (start < bounds[0]) start = bounds[0];
  if (start + span > bounds[1]) start = bounds[1] - span;
  if (start < bounds[0]) start = bounds[0];

  return [start, start + span];
}

/** Zooms about a fixed year, so the year under the pointer stays put. */
export function zoomAbout(
  domain: readonly [number, number],
  focusYear: number,
  factor: number,
  bounds: readonly [number, number],
  minimumSpan = 10,
): [number, number] {
  const span = domain[1] - domain[0];
  const nextSpan = span * factor;
  const ratio = span === 0 ? 0.5 : (focusYear - domain[0]) / span;
  const start = focusYear - ratio * nextSpan;
  return clampDomain([start, start + nextSpan], bounds, minimumSpan);
}

/**
 * Slides the viewport by a fraction of its own width.
 *
 * Here rather than in an event handler for the same reason `clampDomain` is:
 * viewport arithmetic that lives in a component is viewport arithmetic that
 * is never tested, and an off-by-one shows up as an empty chart.
 */
export function panDomain(
  domain: readonly [number, number],
  fraction: number,
  bounds: readonly [number, number],
  minimumSpan = 10,
): [number, number] {
  const shift = (domain[1] - domain[0]) * fraction;
  return clampDomain([domain[0] + shift, domain[1] + shift], bounds, minimumSpan);
}

/** Zooms about the middle of the current viewport. */
export function zoomCentred(
  domain: readonly [number, number],
  factor: number,
  bounds: readonly [number, number],
  minimumSpan = 10,
): [number, number] {
  return zoomAbout(domain, (domain[0] + domain[1]) / 2, factor, bounds, minimumSpan);
}

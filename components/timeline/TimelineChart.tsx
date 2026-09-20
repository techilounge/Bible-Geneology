'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  axisTicks,
  createScale,
  panDomain,
  visibleRows,
  zoomCentred,
  type TimelineEvent,
  type TimelineRow,
} from '@/lib/chronology/scale';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { ConfidenceLevel } from '@/lib/domain';

/**
 * The visual layer.
 *
 * It sits over the list in TimelineList, which is the accessible
 * representation and is always in the DOM. This SVG is therefore
 * `aria-hidden`: announcing both would read every lifetime twice, and the
 * list says it better, with sentences instead of coordinates. The controls
 * above it are real buttons, outside the hidden subtree, so a keyboard user
 * who is looking at the chart can still drive it.
 */
const LANE_HEIGHT = 22;
const BAR_HEIGHT = 14;
const AXIS_HEIGHT = 28;

/**
 * Rows just outside the viewport are still drawn, so panning does not show
 * a bar appearing at the edge mid-scroll.
 */
const MARGIN_YEARS = 50;

const BAR_FILL: Record<ConfidenceLevel, string> = {
  EXPLICIT: 'var(--color-confidence-explicit)',
  DERIVED: 'var(--color-confidence-derived)',
  APPROXIMATE: 'var(--color-confidence-approximate)',
  DISPUTED: 'var(--color-confidence-disputed)',
  UNKNOWN: 'var(--color-confidence-unknown)',
};

export interface TimelineChartProps {
  rows: readonly TimelineRow[];
  events: readonly TimelineEvent[];
  bounds: readonly [number, number];
  /** Drawn with an accent outline: the one bar the reader is looking at. */
  emphasised?: string | null;
  /**
   * When given, everything outside the set is dimmed. Null means no
   * emphasis at all, which is not the same as an empty set: an empty set
   * means the answer is "nobody", and the chart should show that.
   */
  highlighted?: ReadonlySet<string> | null;
  /** A vertical rule at one year, for the year explorer. */
  markerYear?: number | undefined;
  markerLabel?: string | undefined;
  onSelect?: ((personId: string | null) => void) | undefined;
  /** Extra text for the chart's screen-reader description. */
  describedAs?: string | undefined;
}

export function TimelineChart({
  rows,
  events,
  bounds,
  emphasised = null,
  highlighted = null,
  markerYear,
  markerLabel,
  onSelect,
  describedAs,
}: TimelineChartProps) {
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [domain, setDomain] = useState<[number, number]>([bounds[0], bounds[1]]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => createScale(domain, width), [domain, width]);
  const shown = useMemo(() => visibleRows(rows, domain, MARGIN_YEARS), [rows, domain]);
  const lanes = useMemo(() => Math.max(1, ...rows.map((row) => row.lane + 1)), [rows]);
  const ticks = useMemo(
    () => axisTicks(scale, Math.max(2, Math.floor(width / 110))),
    [scale, width],
  );

  const height = lanes * LANE_HEIGHT + AXIS_HEIGHT;

  const zoom = useCallback(
    (factor: number) => setDomain((current) => zoomCentred(current, factor, bounds)),
    [bounds],
  );

  const pan = useCallback(
    (fraction: number) => setDomain((current) => panDomain(current, fraction, bounds)),
    [bounds],
  );

  const reset = useCallback(() => setDomain([bounds[0], bounds[1]]), [bounds]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const actions: Record<string, () => void> = {
        ArrowLeft: () => pan(-0.15),
        ArrowRight: () => pan(0.15),
        '+': () => zoom(0.7),
        '=': () => zoom(0.7),
        '-': () => zoom(1 / 0.7),
        Home: reset,
        Escape: () => onSelect?.(null),
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    },
    [onSelect, pan, reset, zoom],
  );

  const dimmed = (personId: string) =>
    highlighted !== null && personId !== emphasised && !highlighted.has(personId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ControlButton onClick={() => zoom(0.7)} label="Zoom in" symbol="+" />
        <ControlButton onClick={() => zoom(1 / 0.7)} label="Zoom out" symbol="−" />
        <ControlButton onClick={() => pan(-0.15)} label="Pan earlier" symbol="←" />
        <ControlButton onClick={() => pan(0.15)} label="Pan later" symbol="→" />
        <ControlButton onClick={reset} label="Show the whole span" symbol="Reset" />
        <p
          data-testid="viewport"
          className="ml-auto font-mono text-sm tabular-nums text-[var(--color-text-muted)]"
        >
          {Math.round(domain[0])}
          {'–'}
          {Math.round(domain[1])} {EPOCH_LABEL}
        </p>
      </div>

      <p id={hintId} className="sr-only">
        {describedAs ??
          'A visual summary of the lifetimes listed below under \u201cEvery dated lifetime\u201d.'}{' '}
        Arrow keys pan, plus and minus zoom, and Home shows the whole span.
      </p>

      <div
        ref={containerRef}
        data-testid="timeline-chart"
        role="group"
        aria-label="Timeline chart"
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="w-full overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
          className="block"
        >
          <g>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={scale.yearToX(tick)}
                  x2={scale.yearToX(tick)}
                  y1={AXIS_HEIGHT}
                  y2={height}
                  stroke="var(--color-border-subtle)"
                  strokeWidth={1}
                />
                <text
                  x={scale.yearToX(tick) + 4}
                  y={18}
                  className="fill-[var(--color-text-muted)] font-mono text-[11px]"
                >
                  {tick}
                </text>
              </g>
            ))}
          </g>

          <g>
            {events.map((event) => (
              <g key={event.id}>
                <line
                  x1={scale.yearToX(event.year)}
                  x2={scale.yearToX(event.year)}
                  y1={AXIS_HEIGHT}
                  y2={height}
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                />
                <text
                  x={scale.yearToX(event.year) + 4}
                  y={AXIS_HEIGHT + 11}
                  className="fill-[var(--color-accent)] text-[10px] font-medium"
                >
                  {event.name}
                </text>
              </g>
            ))}
          </g>

          {markerYear === undefined ? null : (
            <g>
              <line
                data-testid="marker-rule"
                x1={scale.yearToX(markerYear)}
                x2={scale.yearToX(markerYear)}
                y1={0}
                y2={height}
                stroke="var(--color-text-primary)"
                strokeWidth={2}
              />
              {markerLabel ? (
                <text
                  x={scale.yearToX(markerYear) + 4}
                  y={height - 4}
                  className="fill-[var(--color-text-primary)] font-mono text-[11px]"
                >
                  {markerLabel}
                </text>
              ) : null}
            </g>
          )}

          <g>
            {shown.map((row) => {
              const x = scale.yearToX(row.startYear);
              const barWidth = Math.max(
                2,
                scale.yearToX(row.endYear) - scale.yearToX(row.startYear),
              );
              const y = AXIS_HEIGHT + row.lane * LANE_HEIGHT;

              return (
                <g key={row.personId}>
                  <rect
                    data-testid="bar"
                    data-person={row.personId}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    rx={3}
                    fill={BAR_FILL[row.birthConfidence]}
                    opacity={dimmed(row.personId) ? 0.2 : 0.9}
                    // An open-ended life is drawn dashed, not solid, so the
                    // uncertainty is in the shape and not only in a label.
                    strokeDasharray={row.openEnded ? '4 3' : undefined}
                    stroke={
                      row.personId === emphasised
                        ? 'var(--color-accent)'
                        : row.openEnded
                          ? 'var(--color-text-primary)'
                          : undefined
                    }
                    strokeWidth={
                      row.personId === emphasised ? 2 : row.openEnded ? 1 : undefined
                    }
                    // Panning and zooming move these; the global
                    // reduced-motion rule in globals.css cuts the duration.
                    className="transition-[x,width,opacity] duration-150"
                  />
                  {barWidth > 44 ? (
                    <text
                      x={x + 4}
                      y={y + BAR_HEIGHT - 3}
                      className="pointer-events-none fill-[var(--color-surface-base)] text-[10px] font-medium"
                    >
                      {row.name}
                    </text>
                  ) : null}
                  {onSelect ? (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={BAR_HEIGHT}
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() =>
                        onSelect(row.personId === emphasised ? null : row.personId)
                      }
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  symbol,
}: {
  onClick: () => void;
  label: string;
  symbol: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-[var(--color-surface-overlay)] px-3 text-sm font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

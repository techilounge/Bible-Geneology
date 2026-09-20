'use client';

import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { TimelineEvent, TimelineRow } from '@/lib/chronology/scale';
import { CONFIDENCE_LABELS } from '@/components/chronology/ConfidenceBadge';

/**
 * The timeline as a list.
 *
 * This is the accessible representation, not a fallback. ARCHITECTURE.md
 * section 6 and the Phase 7 plan both say to build the semantic structure
 * first and add the visual layer over it, because an SVG chart retrofitted
 * with ARIA announces its shape rather than its content. A screen reader, a
 * search engine and a browser that has not run the JavaScript yet all get
 * the same sentences: who, from when to when, how long, and how confident
 * the dates are.
 *
 * Each row is a button rather than a link because selecting a person is
 * what answers this page's question. The profile link appears once, beside
 * the selection, rather than fifty times down the page.
 */
export function TimelineList({
  rows,
  events,
  selected,
  overlapping,
  onSelect,
}: {
  rows: readonly TimelineRow[];
  events: readonly TimelineEvent[];
  selected: string | null;
  overlapping: ReadonlySet<string>;
  onSelect: (personId: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-1" aria-label="Lifetimes, earliest first">
        {rows.map((row) => {
          const isSelected = row.personId === selected;
          const overlaps = overlapping.has(row.personId);
          return (
            <li key={row.personId}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : row.personId)}
                className={[
                  'flex min-h-11 w-full flex-wrap items-baseline gap-x-3 rounded px-2 text-left',
                  'hover:bg-[var(--color-surface-raised)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                  isSelected
                    ? 'bg-[var(--color-surface-overlay)] ring-1 ring-[var(--color-accent)]'
                    : overlaps
                      ? 'bg-[var(--color-surface-raised)]'
                      : '',
                ].join(' ')}
              >
                <span className="font-medium">{row.name}</span>
                <span className="font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
                  {row.startYear}
                  {'–'}
                  {row.openEnded ? `${row.endYear}?` : row.endYear} {EPOCH_LABEL}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {row.endYear - row.startYear} years
                  {row.openEnded
                    ? ', though Scripture records no death for this person'
                    : ''}
                  . Birth year:{' '}
                  {CONFIDENCE_LABELS[row.birthConfidence].label.toLowerCase()}.
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {events.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Dated events
          </h3>
          <ul className="flex flex-col gap-1" aria-label="Dated events, earliest first">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{event.name}</span>
                <span className="font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
                  {event.year} {EPOCH_LABEL}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {CONFIDENCE_LABELS[event.confidence].label}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

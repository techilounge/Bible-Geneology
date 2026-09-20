'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import {
  extentOf,
  overlappingIds,
  packLanes,
  type TimelineEvent,
  type TimelineRow,
} from '@/lib/chronology/scale';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import { TimelineChart } from './TimelineChart';
import { TimelineList } from './TimelineList';

/**
 * The master timeline: filters, the chart, and the list that carries the
 * same content in words.
 *
 * Selection lives here rather than in the chart because both surfaces show
 * it. Highlighting a person in the chart while the list beside it stayed
 * unchanged would be two views of one fact disagreeing.
 *
 * The lanes are repacked whenever the filter changes. Keeping the original
 * lanes would leave the gaps where the hidden people used to be, which
 * reads as missing data rather than as a filter.
 */
export interface TimelineProps {
  rows: readonly TimelineRow[];
  events: readonly TimelineEvent[];
  /** People Scripture gives no ages for at all. */
  undatedCount: number;
  /**
   * People with a birth year but no recorded death and no lifespan. They
   * are named rather than counted, because "has a start and no end" is a
   * different fact from "has no dates", and rolling the two together would
   * hide a real thing the text says.
   */
  startedButUnended: readonly string[];
}

/** "Esau", or "Esau and Reuben", or "Esau, Reuben and Simeon". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function Timeline({
  rows,
  events,
  undatedCount,
  startedButUnended,
}: TimelineProps) {
  const listId = useId();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [showEvents, setShowEvents] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return rows;
    return packLanes(rows.filter((row) => row.name.toLowerCase().includes(needle)));
  }, [rows, query]);

  const overlapping = useMemo(
    () => (selected === null ? new Set<string>() : overlappingIds(rows, selected)),
    [rows, selected],
  );

  // The viewport always spans the whole dataset, not the filtered subset, so
  // that typing in the search box does not silently rescale the axis and
  // make two readings of the chart incomparable.
  const bounds = useMemo(() => extentOf(rows) ?? ([0, 1] as [number, number]), [rows]);

  const shownEvents = useMemo(() => (showEvents ? events : []), [events, showEvents]);

  const selectedRow = rows.find((row) => row.personId === selected) ?? null;
  const overlapCount = selectedRow ? overlapping.size : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={searchId}
            className="text-sm text-[var(--color-text-secondary)]"
          >
            Find a name
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Methuselah"
            className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showEvents}
            onChange={(event) => setShowEvents(event.target.checked)}
            className="size-5 accent-[var(--color-accent)]"
          />
          Show dated events
        </label>
        {selected !== null ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="min-h-11 rounded-lg bg-[var(--color-surface-overlay)] px-3 text-sm font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Clear selection
          </button>
        ) : null}
      </div>

      <TimelineChart
        rows={filtered}
        events={shownEvents}
        bounds={bounds}
        selected={selected}
        overlapping={overlapping}
        onSelect={setSelected}
      />

      <p role="status" className="min-h-6 text-sm text-[var(--color-text-secondary)]">
        {selectedRow ? (
          <>
            {selectedRow.name}, {selectedRow.startYear} to {selectedRow.endYear}{' '}
            {EPOCH_LABEL}.{' '}
            {overlapCount === 0
              ? 'No other dated lifetime in this chronology overlaps this one.'
              : `${overlapCount} other dated ${
                  overlapCount === 1 ? 'lifetime overlaps' : 'lifetimes overlap'
                } this one.`}{' '}
            Overlapping lifetimes mean the two were alive in the same years, not that they
            met.{' '}
            <Link
              href={`/people/${selectedRow.slug}`}
              className="underline decoration-[var(--color-accent)] underline-offset-4"
            >
              Open {selectedRow.name}&rsquo;s profile
            </Link>
          </>
        ) : (
          `${filtered.length} of ${rows.length} dated lifetimes shown. Select one to see who was alive at the same time.`
        )}
      </p>

      <section
        id={listId}
        className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-6"
      >
        <h2 className="text-lg font-semibold">Every dated lifetime</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          The same content as the chart above, in words. {undatedCount} more people are
          named in this dataset and left off the timeline, because Scripture gives no ages
          for them and a bar would be a guess.
          {startedButUnended.length > 0 ? (
            <>
              {' '}
              {joinNames(startedButUnended)}{' '}
              {startedButUnended.length === 1 ? 'has' : 'have'} a birth year but no
              recorded death and no lifespan, so there is no year to draw the bar to.
            </>
          ) : null}
        </p>
        {filtered.length === 0 ? (
          <p className="text-sm">No one on the timeline matches that name.</p>
        ) : (
          <TimelineList
            rows={filtered}
            events={shownEvents}
            selected={selected}
            overlapping={overlapping}
            onSelect={setSelected}
          />
        )}
      </section>
    </div>
  );
}

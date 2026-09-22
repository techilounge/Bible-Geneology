'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Search, SlidersHorizontal, X } from 'lucide-react';
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
 */
export interface TimelineProps {
  rows: readonly TimelineRow[];
  events: readonly TimelineEvent[];
  undatedCount: number;
  startedButUnended: readonly string[];
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const QUICK_ANCHORS = ['Adam', 'Noah', 'Abraham', 'Jacob', 'Moses'];

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

  const bounds = useMemo(() => extentOf(rows) ?? ([0, 1] as [number, number]), [rows]);
  const shownEvents = useMemo(() => (showEvents ? events : []), [events, showEvents]);

  const selectedRow = rows.find((row) => row.personId === selected) ?? null;
  const overlapCount = selectedRow ? overlapping.size : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Control Bar */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={searchId}
              className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase"
            >
              Find a name
            </label>
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 size-4 text-[var(--color-text-muted)]" />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Methuselah"
                className="min-h-11 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] pr-8 pl-10 text-sm placeholder:text-[var(--color-text-muted)] transition-colors focus-visible:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 flex size-6 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] transition-colors">
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(event) => setShowEvents(event.target.checked)}
              className="size-4.5 rounded accent-[var(--color-accent)] cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4 text-[var(--color-accent)]" />
              Show dated events
            </span>
          </label>

          {selected !== null ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <X className="size-4" />
              Clear selection
            </button>
          ) : null}
        </div>

        {/* Quick-jump figure chips */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Quick:
          </span>
          {QUICK_ANCHORS.map((anchor) => (
            <button
              key={anchor}
              type="button"
              onClick={() => setQuery(anchor)}
              className="min-h-8 rounded-lg bg-[var(--color-surface-overlay)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {anchor}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2 sm:p-4 shadow-xl">
        <TimelineChart
          rows={filtered}
          events={shownEvents}
          bounds={bounds}
          emphasised={selected}
          highlighted={selected === null ? null : new Set([...overlapping, selected])}
          onSelect={setSelected}
        />
      </div>

      {/* Selected Person Inspector / Status Bar */}
      <div
        role="status"
        className="min-h-12 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/70 p-4 transition-all"
      >
        {selectedRow ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold text-base">
                {selectedRow.name[0]}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-[var(--color-text-primary)]">
                  {selectedRow.name}, {selectedRow.startYear} to {selectedRow.endYear}{' '}
                  {EPOCH_LABEL}.
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {overlapCount === 0
                    ? 'No other dated lifetime in this chronology overlaps this one.'
                    : `${overlapCount} other dated ${
                        overlapCount === 1 ? 'lifetime overlaps' : 'lifetimes overlap'
                      } this one.`}{' '}
                  Overlapping lifetimes mean the two were alive in the same years, not
                  that they met.
                </span>
              </div>
            </div>

            <Link
              href={`/people/${selectedRow.slug}`}
              className="inline-flex min-h-11 items-center gap-1.5 shrink-0 rounded-lg bg-[var(--color-accent)] px-3 text-sm font-semibold text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <span>Open {selectedRow.name}&rsquo;s profile</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <SlidersHorizontal className="size-4 text-[var(--color-accent)] shrink-0" />
            <span>
              {filtered.length} of {rows.length} dated lifetimes shown. Select one to see
              who was alive at the same time.
            </span>
          </div>
        )}
      </div>

      {/* Accessible Text Alternative Section */}
      <section
        id={listId}
        className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/50 p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Every dated lifetime
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            The same content as the chart above, in words. {undatedCount} more people are
            named in this dataset and left off the timeline, because Scripture gives no
            ages for them and a bar would be a guess.
            {startedButUnended.length > 0 ? (
              <>
                {' '}
                {joinNames(startedButUnended)}{' '}
                {startedButUnended.length === 1 ? 'has' : 'have'} a birth year but no
                recorded death and no lifespan, so there is no year to draw the bar to.
              </>
            ) : null}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-4">
            No one on the timeline matches that name.
          </p>
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

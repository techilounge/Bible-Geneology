'use client';

import Link from 'next/link';
import { useCallback, useId, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { ChronologyValue } from '@/components/chronology/ChronologyValue';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import { agesAtYear, changeYears, nextChange } from '@/lib/chronology/alive';
import { buildDataset } from '@/lib/chronology/dataset';
import type { TimelineEvent, TimelineRow } from '@/lib/chronology/scale';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { Person, PersonChronology } from '@/lib/domain';

export interface YearExplorerProps {
  chronologyId: string;
  people: readonly Person[];
  chronology: readonly PersonChronology[];
  rows: readonly TimelineRow[];
  events: readonly TimelineEvent[];
  bounds: readonly [number, number];
  initialYear: number;
  unplaceableCount: number;
}

export function YearExplorer({
  chronologyId,
  people,
  chronology,
  rows,
  events,
  bounds,
  initialYear,
  unplaceableCount,
}: YearExplorerProps) {
  const sliderId = useId();
  const entryId = useId();
  const [year, setYearState] = useState(initialYear);

  const dataset = useMemo(
    () =>
      buildDataset({
        chronologyId,
        people,
        chronology,
        relationships: [],
      }),
    [chronologyId, people, chronology],
  );

  const nameOf = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const changes = useMemo(() => changeYears(dataset), [dataset]);
  const living = useMemo(() => agesAtYear(dataset, year), [dataset, year]);

  const setYear = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(Math.trunc(next), bounds[0]), bounds[1]);
      setYearState(clamped);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `?year=${clamped}`);
      }
    },
    [bounds],
  );

  const previous = nextChange(changes, year, 'back');
  const upcoming = nextChange(changes, year, 'forward');

  return (
    <div className="flex flex-col gap-8">
      {/* Interactive Year Controller Panel */}
      <section className="glass-panel flex flex-col gap-6 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={entryId}
                className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase"
              >
                Year ({EPOCH_LABEL})
              </label>
              <div className="relative flex items-center">
                <input
                  id={entryId}
                  type="number"
                  inputMode="numeric"
                  min={bounds[0]}
                  max={bounds[1]}
                  value={year}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) setYear(next);
                  }}
                  className="min-h-11 w-36 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] px-3 font-mono text-base font-bold text-[var(--color-accent)] tabular-nums transition-colors focus-visible:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                />
              </div>
            </div>

            <JumpButton
              onClick={() => (previous ? setYear(previous.year) : undefined)}
              disabled={previous === null}
              label="Previous change"
              detail={previous ? describe(previous, nameOf) : 'Nothing earlier'}
              direction="back"
            />
            <JumpButton
              onClick={() => (upcoming ? setYear(upcoming.year) : undefined)}
              disabled={upcoming === null}
              label="Next change"
              detail={upcoming ? describe(upcoming, nameOf) : 'Nothing later'}
              direction="forward"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-[var(--color-surface-overlay)] px-3 py-2 border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-secondary)]">
            <CalendarClock className="size-4 text-[var(--color-accent)] shrink-0" />
            <span>
              Range: {bounds[0]} to {bounds[1]} {EPOCH_LABEL}
            </span>
          </div>
        </div>

        {/* Year Slider Scrubber */}
        <div className="flex flex-col gap-2 pt-2">
          <label htmlFor={sliderId} className="sr-only">
            Year, as a slider
          </label>
          <div className="relative flex items-center py-2">
            <input
              id={sliderId}
              type="range"
              min={bounds[0]}
              max={bounds[1]}
              step={1}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-[var(--color-surface-overlay)] accent-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            />
          </div>
          <div className="flex justify-between font-mono text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--color-border-subtle)]" />
              {bounds[0]} {EPOCH_LABEL}
            </span>
            <span className="font-semibold text-[var(--color-accent)]">
              Year {year} {EPOCH_LABEL}
            </span>
            <span className="flex items-center gap-1">
              {bounds[1]} {EPOCH_LABEL}
              <span className="size-1.5 rounded-full bg-[var(--color-border-subtle)]" />
            </span>
          </div>
        </div>

        {/* Event Jump Chips */}
        {events.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-subtle)] pt-4">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
              Key Historical Events:
            </span>
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setYear(event.year)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
              >
                <Flag className="size-3 text-[var(--color-accent)]" />
                <span>{event.name}</span>
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  ({event.year})
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* Synchronized Timeline Chart with Needle */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2 sm:p-4 shadow-xl">
        <TimelineChart
          rows={rows}
          events={events}
          bounds={bounds}
          highlighted={new Set(living.map((person) => person.personId))}
          markerYear={year}
          markerLabel={`${year} ${EPOCH_LABEL}`}
          describedAs={`A visual summary of the lifetimes listed below, with a rule drawn at ${year} ${EPOCH_LABEL}.`}
        />
      </div>

      {/* Living Roster List */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/50 p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2
            className="text-xl font-bold text-[var(--color-text-primary)]"
            data-testid="living-heading"
          >
            {living.length === 0
              ? `Nobody the chronology can place is alive in ${year} ${EPOCH_LABEL}`
              : `${living.length} ${living.length === 1 ? 'person' : 'people'} alive in ${year} ${EPOCH_LABEL}`}
          </h2>
          {living.length > 0 && (
            <span className="rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
              Historical Cohort
            </span>
          )}
        </div>

        {living.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-4">
            That is a statement about this chronology, not about history. It means no one
            in the dataset has dates that cover this year.
          </p>
        ) : (
          <ul
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="living-list"
          >
            {living.map((person) => {
              const record = nameOf.get(person.personId);
              return (
                <li
                  key={person.personId}
                  data-person={person.personId}
                  className="glass-card flex min-h-11 flex-col justify-between gap-2 rounded-xl p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/people/${record?.slug ?? person.personId}`}
                      className="font-bold text-base text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      {record?.canonicalName ?? person.personId}
                    </Link>
                    <span className="rounded-md bg-[var(--color-surface-overlay)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                      Age{' '}
                      <ChronologyValue
                        result={person.ageResult}
                        render={(age) => (
                          <span className="font-mono tabular-nums">{age.years}</span>
                        )}
                      />
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span className="font-mono">
                      Lifespan: {person.birthYear}–
                      {person.openEnded ? `${person.endYear}?` : person.endYear}{' '}
                      {EPOCH_LABEL}
                    </span>
                  </div>

                  {person.openEnded ? (
                    <span className="text-[11px] text-[var(--color-text-muted)] leading-tight border-t border-[var(--color-border-subtle)]/50 pt-1.5">
                      Scripture records a lifespan and no death; range ends where
                      chronology stops placing them.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-subtle)]">
          {unplaceableCount} more people are named in this dataset and cannot appear here
          in any year, because Scripture gives no ages for them. Their absence from this
          list is a gap in the text, not a statement that they were not alive.
        </p>
      </section>
    </div>
  );
}

function describe(
  change: { year: number; births: string[]; ends: string[]; hasRecordedDeath: boolean },
  people: ReadonlyMap<string, Person>,
): string {
  const name = (id: string) => people.get(id)?.canonicalName ?? id;
  const parts: string[] = [];
  if (change.births.length > 0) {
    parts.push(`${change.births.map(name).join(', ')} born`);
  }
  if (change.ends.length > 0) {
    parts.push(
      change.hasRecordedDeath
        ? `${change.ends.map(name).join(', ')} died`
        : `${change.ends.map(name).join(', ')} last placed`,
    );
  }
  return `${change.year} ${EPOCH_LABEL}: ${parts.join('; ')}`;
}

function JumpButton({
  onClick,
  disabled,
  label,
  detail,
  direction,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  detail: string;
  direction?: 'back' | 'forward';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-3.5 py-1.5 text-left transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {direction === 'back' && (
        <ChevronLeft className="size-4 shrink-0 text-[var(--color-accent)]" />
      )}
      <div className="flex flex-col">
        <span className="text-xs font-semibold leading-tight">{label}</span>
        <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1 max-w-40 sm:max-w-56">
          {detail}
        </span>
      </div>
      {direction === 'forward' && (
        <ChevronRight className="size-4 shrink-0 text-[var(--color-accent)]" />
      )}
    </button>
  );
}

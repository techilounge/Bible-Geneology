'use client';

import Link from 'next/link';
import { useCallback, useId, useMemo, useState } from 'react';
import { ChronologyValue } from '@/components/chronology/ChronologyValue';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import { agesAtYear, changeYears, nextChange } from '@/lib/chronology/alive';
import { buildDataset } from '@/lib/chronology/dataset';
import type { TimelineEvent, TimelineRow } from '@/lib/chronology/scale';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { Person, PersonChronology } from '@/lib/domain';

/**
 * "Who was alive in year X?", which is the question this product exists to
 * answer.
 *
 * Every number on this page comes out of the chronology engine. The engine
 * is framework-independent, so the client imports it rather than
 * reimplementing a smaller version of it: the alternative is a slider that
 * computes ages one way and a profile page that computes them another, and
 * the day those two disagree is the day the product stops being worth
 * trusting. The Phase 8 gate asserts the parity directly.
 */
export interface YearExplorerProps {
  chronologyId: string;
  people: readonly Person[];
  chronology: readonly PersonChronology[];
  rows: readonly TimelineRow[];
  events: readonly TimelineEvent[];
  bounds: readonly [number, number];
  initialYear: number;
  /** People the chronology cannot place in any year, counted not hidden. */
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
      // The number input lets anything be typed, so the clamp lives here
      // rather than in the markup, where it is advisory.
      const clamped = Math.min(Math.max(Math.trunc(next), bounds[0]), bounds[1]);
      setYearState(clamped);
      // Keep the address bar in step so a year can be linked to, without
      // asking the server for a new page on every drag of the slider.
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
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={entryId}
              className="text-sm text-[var(--color-text-secondary)]"
            >
              Year ({EPOCH_LABEL})
            </label>
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
              className="min-h-11 w-32 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 font-mono tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            />
          </div>

          <JumpButton
            onClick={() => (previous ? setYear(previous.year) : undefined)}
            disabled={previous === null}
            label="Previous change"
            detail={previous ? describe(previous, nameOf) : 'Nothing earlier'}
          />
          <JumpButton
            onClick={() => (upcoming ? setYear(upcoming.year) : undefined)}
            disabled={upcoming === null}
            label="Next change"
            detail={upcoming ? describe(upcoming, nameOf) : 'Nothing later'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={sliderId} className="sr-only">
            Year, as a slider
          </label>
          <input
            id={sliderId}
            type="range"
            min={bounds[0]}
            max={bounds[1]}
            step={1}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-11 w-full accent-[var(--color-accent)]"
          />
          <p className="flex justify-between font-mono text-xs text-[var(--color-text-muted)]">
            <span>
              {bounds[0]} {EPOCH_LABEL}
            </span>
            <span>
              {bounds[1]} {EPOCH_LABEL}
            </span>
          </p>
        </div>

        {events.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Jump to:</span>
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setYear(event.year)}
                className="min-h-11 rounded-lg bg-[var(--color-surface-overlay)] px-3 text-sm font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {event.name}
                <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">
                  {event.year}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <TimelineChart
        rows={rows}
        events={events}
        bounds={bounds}
        highlighted={new Set(living.map((person) => person.personId))}
        markerYear={year}
        markerLabel={`${year} ${EPOCH_LABEL}`}
        describedAs={`A visual summary of the lifetimes listed below, with a rule drawn at ${year} ${EPOCH_LABEL}.`}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold" data-testid="living-heading">
          {living.length === 0
            ? `Nobody the chronology can place is alive in ${year} ${EPOCH_LABEL}`
            : `${living.length} ${living.length === 1 ? 'person' : 'people'} alive in ${year} ${EPOCH_LABEL}`}
        </h2>

        {living.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            That is a statement about this chronology, not about history. It means no one
            in the dataset has dates that cover this year.
          </p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="living-list">
            {living.map((person) => {
              const record = nameOf.get(person.personId);
              return (
                <li
                  key={person.personId}
                  data-person={person.personId}
                  className="flex min-h-11 flex-wrap items-center gap-x-3 rounded px-2"
                >
                  <Link
                    href={`/people/${record?.slug ?? person.personId}`}
                    className="font-medium underline decoration-transparent underline-offset-4 hover:decoration-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    {record?.canonicalName ?? person.personId}
                  </Link>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    aged{' '}
                    <ChronologyValue
                      result={person.ageResult}
                      render={(age) => (
                        <span className="font-mono tabular-nums">{age.years}</span>
                      )}
                    />
                  </span>
                  <span className="font-mono text-xs text-[var(--color-text-muted)]">
                    {person.birthYear}
                    {'–'}
                    {person.openEnded ? `${person.endYear}?` : person.endYear}{' '}
                    {EPOCH_LABEL}
                  </span>
                  {person.openEnded ? (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Scripture records a lifespan for this person and no death, so the
                      end of the range is where the chronology stops placing them.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-sm text-[var(--color-text-muted)]">
          {unplaceableCount} more people are named in this dataset and cannot appear here
          in any year, because Scripture gives no ages for them. Their absence from this
          list is a gap in the text, not a statement that they were not alive.
        </p>
      </section>
    </div>
  );
}

/** "Noah born", "Jared died", "Enoch's recorded lifespan ends". */
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
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 flex-col items-start justify-center rounded-lg bg-[var(--color-surface-overlay)] px-3 py-1 text-left hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-[var(--color-text-muted)]">{detail}</span>
    </button>
  );
}

import Link from 'next/link';
import { SourceList } from '@/components/chronology/SourceList';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import type { TimelineRow } from '@/lib/chronology/scale';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { NOT_CONTACT } from '@/lib/config/copy';
import type { Discovery } from '@/lib/discovery';
import type { Person, ScriptureReference } from '@/lib/domain';

/**
 * One finding in full: the working, the people, the verses, and the same
 * lifetimes drawn on an axis.
 *
 * Requirement section 35 asks each Surprise Me result to carry its
 * visualisation, the people involved, the calculation, the chronology and
 * the Scripture references. They are all here, and none of them is written
 * by this file: the calculation comes from the generator that produced the
 * finding, and the chart is the shared timeline with the relevant lives
 * emphasised.
 */
export function DiscoveryDetail({
  discovery,
  people,
  rows,
  bounds,
  references,
}: {
  discovery: Discovery;
  people: readonly Person[];
  rows: readonly TimelineRow[];
  bounds: readonly [number, number];
  references: readonly ScriptureReference[];
}) {
  const involved = new Set(discovery.personIds);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Drawn from {discovery.population}, under the {discovery.chronologyId}{' '}
          chronology.
        </p>
        {discovery.aboutOverlap ? (
          <p
            data-testid="not-contact"
            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] p-3 text-sm"
          >
            {NOT_CONTACT}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">How this was worked out</h2>
        <dl className="flex flex-col gap-2" data-testid="calculation">
          {discovery.calculation.map((step) => (
            <div
              key={`${step.label}-${step.value}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--color-border-subtle)] pb-2"
            >
              <dt className="text-sm text-[var(--color-text-secondary)]">{step.label}</dt>
              <dd className="font-mono text-sm tabular-nums">{step.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {rows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">The lifetimes involved</h2>
          <TimelineChart
            rows={rows}
            events={[]}
            bounds={bounds}
            highlighted={involved}
            describedAs="The lifetimes this finding rests on, drawn on one axis. They are listed below in words."
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">The people</h2>
        <ul className="flex flex-wrap gap-2">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/people/${person.slug}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-3 text-sm hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {person.canonicalName}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Where the numbers come from</h2>
        <SourceList references={references} />
      </section>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </div>
  );
}

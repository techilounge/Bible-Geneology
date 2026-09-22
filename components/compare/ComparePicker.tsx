import { GitCompare } from 'lucide-react';
import type { Person } from '@/lib/domain';

export function ComparePicker({
  people,
  selectedA,
  selectedB,
}: {
  people: readonly Person[];
  selectedA: string | null;
  selectedB: string | null;
}) {
  const suggestions =
    people.length >= 2
      ? [
          {
            label: `${people[0]?.canonicalName} & ${people[1]?.canonicalName}`,
            a: people[0]?.slug,
            b: people[1]?.slug,
          },
          ...(people.length >= 4
            ? [
                {
                  label: `${people[0]?.canonicalName} & ${people[3]?.canonicalName}`,
                  a: people[0]?.slug,
                  b: people[3]?.slug,
                },
              ]
            : []),
        ].filter((s) => s.a && s.b)
      : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Comparison Suggestions */}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-[11px]">
            Suggestions:
          </span>
          {suggestions.map((item) => (
            <a
              key={item.label}
              href={`/compare?a=${item.a}&b=${item.b}`}
              className="inline-flex min-h-8 items-center rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-2.5 py-1 font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}

      <form
        method="get"
        action="/compare"
        className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 shadow-xl"
      >
        <div className="flex flex-wrap items-end gap-3 sm:gap-4 flex-1">
          <PersonSelect
            name="a"
            label="First person"
            people={people}
            selected={selectedA}
          />

          <div className="hidden sm:flex size-10 items-center justify-center rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-accent)] border border-[var(--color-border-subtle)] font-bold text-xs">
            VS
          </div>

          <PersonSelect
            name="b"
            label="Second person"
            people={people}
            selected={selectedB}
          />
        </div>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 font-semibold text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] cursor-pointer shadow-md"
        >
          <GitCompare className="size-4" />
          <span>Compare</span>
        </button>
      </form>
    </div>
  );
}

function PersonSelect({
  name,
  label,
  people,
  selected,
}: {
  name: string;
  label: string;
  people: readonly Person[];
  selected: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-44">
      <label
        htmlFor={`compare-${name}`}
        className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase"
      >
        {label}
      </label>
      <select
        id={`compare-${name}`}
        name={name}
        defaultValue={selected ?? ''}
        className="min-h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <option value="">Choose someone</option>
        {people.map((person) => (
          <option key={person.id} value={person.slug}>
            {person.canonicalName}
          </option>
        ))}
      </select>
    </div>
  );
}

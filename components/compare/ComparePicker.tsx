import type { Person } from '@/lib/domain';

/**
 * The two person selectors.
 *
 * A plain GET form, so it works with no JavaScript and so every comparison
 * has an address that can be linked, bookmarked and tested. The golden
 * comparison pairs are checked by visiting those addresses.
 */
export function ComparePicker({
  people,
  selectedA,
  selectedB,
}: {
  people: readonly Person[];
  selectedA: string | null;
  selectedB: string | null;
}) {
  return (
    <form
      method="get"
      action="/compare"
      className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
    >
      <PersonSelect name="a" label="First person" people={people} selected={selectedA} />
      <PersonSelect name="b" label="Second person" people={people} selected={selectedB} />
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        Compare
      </button>
    </form>
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
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`compare-${name}`}
        className="text-sm text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
      <select
        id={`compare-${name}`}
        name={name}
        defaultValue={selected ?? ''}
        className="min-h-11 min-w-48 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
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

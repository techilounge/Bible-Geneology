import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { FamilyTreeChart } from '@/components/tree/FamilyTreeChart';
import { TreeOutline, type OutlinePerson } from '@/components/tree/TreeOutline';
import { buildFamilyTree, buildTreeOutline } from '@/lib/graph/tree-layout';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { getCanonical, getDataset, getPersonBySlug } from '@/lib/services/dataset';

export const metadata: Metadata = {
  title: 'Family tree',
  description:
    'The recorded lines of descent, drawn from the relationship records and nothing else.',
};

const LIMITS = [1, 2, 3, 4, 5];

function generations(raw: string | string[] | undefined, fallback: number): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return LIMITS.includes(value) ? value : fallback;
}

export default async function FamilyTreePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const canonical = getCanonical();
  const dataset = getDataset();

  const rootSlug = (Array.isArray(params.root) ? params.root[0] : params.root) ?? '';
  // The default is the first person in canonical order rather than a
  // name written into the page. A route that hard-codes someone is a route
  // that breaks when the dataset changes under it.
  const firstPerson =
    [...canonical.people].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] ??
    null;
  const root = getPersonBySlug(rootSlug) ?? firstPerson;
  const up = generations(params.up, 2);
  const down = generations(params.down, 2);

  const people = [...canonical.people].sort((a, b) =>
    a.canonicalName.localeCompare(b.canonicalName),
  );

  if (root === null) {
    return (
      <PageShell>
        <PageHeader title="Family tree" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          This dataset has nobody to draw a tree for yet.
        </p>
      </PageShell>
    );
  }

  const layout = buildFamilyTree(dataset.relationships, root.id, { up, down });

  const outline = buildTreeOutline(layout);

  const outlinePeople: Record<string, OutlinePerson> = Object.fromEntries(
    canonical.people.map((person) => [
      person.id,
      { personId: person.id, name: person.canonicalName, slug: person.slug },
    ]),
  );
  const names = Object.fromEntries(
    canonical.people.map((person) => [person.id, person.canonicalName]),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relationships"
        title="Family tree"
        lede={`Every line here is a relationship the dataset records, with the verse behind it. Siblings are not drawn, because no record states them: they are worked out from shared parents, and a drawn line would be the picture claiming more than the text.`}
      />

      <form
        method="get"
        action="/family-tree"
        className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="tree-root" className="text-sm text-[var(--color-text-secondary)]">
            Centre on
          </label>
          <select
            id="tree-root"
            name="root"
            defaultValue={root.slug}
            className="min-h-11 min-w-48 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {people.map((person) => (
              <option key={person.id} value={person.slug}>
                {person.canonicalName}
              </option>
            ))}
          </select>
        </div>

        <GenerationSelect id="tree-up" name="up" label="Generations back" value={up} />
        <GenerationSelect
          id="tree-down"
          name="down"
          label="Generations forward"
          value={down}
        />

        <button
          type="submit"
          className="min-h-11 rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Show tree
        </button>
      </form>

      <FamilyTreeChart
        rootId={layout.rootId}
        nodes={layout.nodes}
        edges={layout.edges}
        names={names}
      />

      <p className="text-sm text-[var(--color-text-muted)]" data-testid="tree-summary">
        {layout.nodes.length} people and {layout.edges.length} recorded relationships.
        {layout.omittedCount > 0
          ? ` ${layout.omittedCount} more people are connected to this family by a record and are not shown, because the view stops at ${up} generations back and ${down} forward.`
          : ' Nobody connected to this family by a record is left out of this view.'}
      </p>

      <section className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-6">
        <h2 className="text-lg font-semibold">The same family, in words</h2>
        <TreeOutline outline={outline} people={outlinePeople} />
      </section>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

function GenerationSelect({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-[var(--color-text-secondary)]">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={String(value)}
        className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {LIMITS.map((limit) => (
          <option key={limit} value={limit}>
            {limit}
          </option>
        ))}
      </select>
    </div>
  );
}

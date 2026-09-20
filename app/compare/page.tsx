import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { ComparePicker } from '@/components/compare/ComparePicker';
import { ComparisonResult } from '@/components/compare/ComparisonResult';
import {
  buildOverlapGraph,
  compareLifespans,
  extentOf,
  getAgeAtPersonBirth,
  getLifetimeOverlap,
  getOverlapChain,
  getRelationshipPath,
} from '@/lib/chronology';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import type { Person } from '@/lib/domain';
import {
  getCanonical,
  getDataset,
  getPersonBySlug,
  getTimelineRows,
  resolveReferences,
} from '@/lib/services/dataset';

export const metadata: Metadata = {
  title: 'Could they have met?',
  description:
    'Pick two people and see whether this chronology places them alive at the same time, and what that does and does not mean.',
};

function slugParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.length > 0 ? value : null;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const canonical = getCanonical();

  const slugA = slugParam(params.a);
  const slugB = slugParam(params.b);
  const a = slugA ? getPersonBySlug(slugA) : null;
  const b = slugB ? getPersonBySlug(slugB) : null;

  const people = [...canonical.people].sort((x, y) =>
    x.canonicalName.localeCompare(y.canonicalName),
  );

  const comparison = a !== null && b !== null && a.id !== b.id ? compare(a, b) : null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Comparison"
        title="Could they have met?"
        lede="Pick two people. This chronology can say whether they were alive at the same time. Whether they ever met is a different question, and one it cannot answer."
      />

      <ComparePicker people={people} selectedA={slugA} selectedB={slugB} />

      {comparison ?? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {a !== null && b !== null && a.id === b.id
            ? 'That is the same person twice. Choose two different people.'
            : slugA !== null || slugB !== null
              ? 'One of those names is not in this dataset. Choose two people from the lists above.'
              : 'Choose two people from the lists above.'}
        </p>
      )}

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

/**
 * Everything the comparison shows, assembled from the engine in one place.
 *
 * The page hands over two people and gets back the answer; nothing here
 * decides anything about the chronology that `lib/chronology` has not
 * already decided.
 */
function compare(a: Person, b: Person) {
  const canonical = getCanonical();
  const dataset = getDataset();

  const rows = getTimelineRows().filter(
    (row) => row.personId === a.id || row.personId === b.id,
  );
  const overlap = getLifetimeOverlap(dataset, a.id, b.id);

  /**
   * The lifetime connection is only worth showing when the two do not
   * overlap, because for a pair that does overlap the chain is the pair
   * itself and says nothing.
   */
  const connection =
    overlap.status === 'known' && !overlap.value.overlaps
      ? getOverlapChain(buildOverlapGraph(dataset.chronology.values()), a.id, b.id)
      : null;

  const references = resolveReferences([
    ...(dataset.chronology.get(a.id)?.sourceReferences ?? []),
    ...(dataset.chronology.get(b.id)?.sourceReferences ?? []),
  ]);

  return (
    <ComparisonResult
      a={a}
      b={b}
      overlap={overlap}
      lifespans={compareLifespans(dataset, a.id, b.id)}
      aAtBsBirth={getAgeAtPersonBirth(dataset, a.id, b.id)}
      bAtAsBirth={getAgeAtPersonBirth(dataset, b.id, a.id)}
      relationship={getRelationshipPath(dataset.relationships, a.id, b.id)}
      connection={connection}
      nameOf={Object.fromEntries(
        canonical.people.map((person) => [person.id, person.canonicalName]),
      )}
      rows={rows}
      bounds={extentOf(rows) ?? [0, 1]}
      references={references}
    />
  );
}

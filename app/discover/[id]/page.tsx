import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscoveryDetail } from '@/components/discovery/DiscoveryDetail';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import {
  getCanonical,
  getDiscoveries,
  getDiscovery,
  getTimelineBounds,
  getTimelineRows,
  resolveReferences,
} from '@/lib/services/dataset';

/**
 * One finding, with its working.
 *
 * Every discovery is generated from the dataset, so the set of pages is
 * known at build time and each one is static. A finding that stops being
 * true when the dataset changes stops having a page, which is the property
 * that keeps the claims honest.
 */
export function generateStaticParams() {
  return getDiscoveries().map((discovery) => ({ id: discovery.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const discovery = getDiscovery((await params).id);
  if (!discovery) return { title: 'Discovery not found' };
  return {
    title: discovery.headline,
    description: `Drawn from ${discovery.population}.`,
  };
}

export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const discovery = getDiscovery((await params).id);
  if (!discovery) notFound();

  const canonical = getCanonical();
  const involved = new Set(discovery.personIds);
  const people = canonical.people.filter((person) => involved.has(person.id));
  const rows = getTimelineRows().filter((row) => involved.has(row.personId));

  return (
    <PageShell>
      <PageHeader eyebrow="Discovery" title={discovery.headline} />
      <DiscoveryDetail
        discovery={discovery}
        people={people}
        rows={rows}
        bounds={getTimelineBounds()}
        references={resolveReferences(discovery.sourceReferences)}
      />
    </PageShell>
  );
}

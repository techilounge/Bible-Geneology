import type { Metadata } from 'next';
import Link from 'next/link';
import { DiscoveryCard } from '@/components/discovery/DiscoveryCard';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { nextSeed, pickDiscovery } from '@/lib/discovery';
import { getCanonical, getDiscoveries } from '@/lib/services/dataset';

export const metadata: Metadata = {
  title: 'Discover',
  description:
    'Findings the dataset actually supports, each shown with the numbers behind it.',
};

/**
 * Surprise Me, without randomness.
 *
 * A random pick on the server would mean the link a reader shares opens on
 * a different finding than the one they saw. Instead the seed is in the
 * address: the button asks for the next one, and the same address always
 * shows the same finding. It also keeps the page reproducible, which is
 * the Phase 11 exit gate.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.seed) ? params.seed[0] : params.seed;
  const seed = raw && raw.length > 0 ? raw.slice(0, 64) : 'start';

  const discoveries = getDiscoveries();
  const names = Object.fromEntries(
    getCanonical().people.map((person) => [person.id, person.canonicalName]),
  );
  const surprise = pickDiscovery(discoveries, seed);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Discover"
        title="Findings the dataset supports"
        lede="Every finding here is generated from the chronology engine and the verified records behind it. None of them is written by hand, so changing the chronology changes the findings rather than leaving them behind."
      />

      {surprise ? (
        <section
          data-testid="surprise"
          className="flex flex-col gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface-raised)] p-5"
        >
          <p className="text-xs tracking-widest text-[var(--color-accent)] uppercase">
            Surprise me
          </p>
          <h2 className="text-xl font-medium text-balance">
            <Link
              href={`/discover/${surprise.id}`}
              data-testid="surprise-link"
              className="rounded hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              {surprise.headline}
            </Link>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/discover?seed=${encodeURIComponent(nextSeed(discoveries, seed))}`}
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Surprise me again
            </Link>
            <Link
              href={`/discover/${surprise.id}`}
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              See how it was worked out
            </Link>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">All {discoveries.length} findings</h2>
        <ul className="flex flex-col gap-3">
          {discoveries.map((discovery) => (
            <DiscoveryCard key={discovery.id} discovery={discovery} names={names} />
          ))}
        </ul>
      </section>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

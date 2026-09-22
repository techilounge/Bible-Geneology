import type { Metadata } from 'next';
import Link from 'next/link';
import { Shuffle, Sparkles } from 'lucide-react';
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
        icon={<Sparkles className="size-4" />}
        lede="Every finding here is generated from the chronology engine and the verified records behind it. None of them is written by hand, so changing the chronology changes the findings rather than leaving them behind."
      />

      {surprise ? (
        <section
          data-testid="surprise"
          className="glass-panel flex flex-col gap-4 rounded-2xl border border-[var(--color-accent)]/80 bg-gradient-to-br from-[var(--color-surface-raised)] to-[var(--color-surface-overlay)] p-6 shadow-xl"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
              <Sparkles className="size-4" />
            </span>
            <p className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
              Featured Insight &middot; Surprise me
            </p>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-balance text-[var(--color-text-primary)]">
            <Link
              href={`/discover/${surprise.id}`}
              data-testid="surprise-link"
              className="rounded hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] transition-colors"
            >
              {surprise.headline}
            </Link>
          </h2>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/discover?seed=${encodeURIComponent(nextSeed(discoveries, seed))}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 font-semibold text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <Shuffle className="size-4" />
              <span>Surprise me again</span>
            </Link>
            <Link
              href={`/discover/${surprise.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-4 font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <span>See how it was worked out</span>
            </Link>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            All {discoveries.length} findings
          </h2>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            Generated from chronology engine
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {discoveries.map((discovery) => (
            <DiscoveryCard key={discovery.id} discovery={discovery} names={names} />
          ))}
        </ul>
      </section>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

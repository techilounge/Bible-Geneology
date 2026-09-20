import Link from 'next/link';
import { PageShell } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { branding } from '@/lib/config/branding';
import { PRIMARY_NAV } from '@/lib/config/navigation';
import { NOT_CONTACT } from '@/lib/config/copy';
import { pickDiscovery } from '@/lib/discovery';
import { getDiscoveries } from '@/lib/services/dataset';

/**
 * Today's discovery changes with the date, so the page is rebuilt hourly
 * rather than at deploy time. The date is the seed: everyone opening the
 * page on the same day sees the same finding, and the finding is still one
 * the engine generated rather than one chosen at random.
 */
export const revalidate = 3600;

export default function HomePage() {
  const discoveries = getDiscoveries();
  const today = new Date().toISOString().slice(0, 10);
  const todays = pickDiscovery(discoveries, today);
  return (
    <PageShell>
      <div className="flex flex-col gap-4 py-8 sm:py-16">
        <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">
          {branding.tagline}
        </h1>
        <p className="max-w-2xl text-lg text-[var(--color-text-secondary)]">
          {branding.description}
        </p>
        <p className="max-w-2xl text-[var(--color-text-muted)]">
          Every date here is worked out from ages the text states, and every one shows its
          working.{' '}
          <Link
            href="/chronology"
            className="rounded underline underline-offset-4 hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            How the dates work
          </Link>
          .
        </p>
      </div>

      {todays ? (
        <section
          data-testid="todays-discovery"
          className="flex flex-col gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface-raised)] p-5"
        >
          <p className="text-xs tracking-widest text-[var(--color-accent)] uppercase">
            Today&rsquo;s discovery
          </p>
          <h2 className="text-xl font-medium text-balance">
            <Link
              href={`/discover/${todays.id}`}
              className="rounded hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              {todays.headline}
            </Link>
          </h2>
          {todays.aboutOverlap ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{NOT_CONTACT}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/timeline"
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Explore the timeline
            </Link>
            <Link
              href={`/discover?seed=${encodeURIComponent(today)}`}
              data-testid="surprise-me"
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Surprise me
            </Link>
          </div>
        </section>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRIMARY_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <Card className="flex h-full flex-col gap-2 transition-colors hover:border-[var(--color-accent)]">
                <span className="font-semibold">{item.label}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {item.description}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

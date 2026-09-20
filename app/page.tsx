import Link from 'next/link';
import { PageShell } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { branding } from '@/lib/config/branding';
import { PRIMARY_NAV } from '@/lib/config/navigation';

export default function HomePage() {
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

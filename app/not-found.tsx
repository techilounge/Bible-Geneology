import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-col items-center text-center gap-6 py-12">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--color-surface-overlay)] text-[var(--color-accent)] border border-[var(--color-border-subtle)] shadow-lg">
          <Compass className="size-8 animate-pulse" />
        </div>

        <PageHeader
          eyebrow="404 Error"
          title="There is nothing at this address"
          lede="The page may have moved, or the link may be wrong. No historical records point here."
        />

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <ArrowLeft className="size-4" />
            <span>Go to the home page</span>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

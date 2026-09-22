import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Milestone } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { JOURNEYS } from '@/lib/learning';

export const metadata: Metadata = {
  title: 'Learning journeys',
  description:
    'Six guided routes through the dataset, from Adam to the twelve tribes, with the figures read from the chronology as you go.',
};

export default function JourneysPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Learning journeys"
        title="Six routes through the dataset"
        icon={<Compass className="size-4" />}
        lede="Each journey walks a stretch of the genealogy a step at a time. The explanations are written; every figure beside them is read from the chronology when the page loads, so a journey cannot go on asserting a number the data no longer supports."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {JOURNEYS.map((journey) => (
          <li key={journey.slug}>
            <Link
              href={`/journeys/${journey.slug}`}
              data-testid="journey-link"
              data-journey={journey.slug}
              className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <div className="glass-card flex h-full flex-col justify-between gap-3 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-surface-overlay)] text-[var(--color-accent)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-surface-base)] transition-colors">
                      <Milestone className="size-4" />
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-overlay)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)] border border-[var(--color-border-subtle)]">
                      {journey.steps.length} steps
                    </span>
                  </div>

                  <span className="font-bold text-lg text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                    {journey.title}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {journey.summary}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-[var(--color-border-subtle)]/40">
                  <span>Begin route</span>
                  <ArrowRight className="size-3.5" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

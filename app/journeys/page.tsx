import type { Metadata } from 'next';
import Link from 'next/link';
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
        lede="Each journey walks a stretch of the genealogy a step at a time. The explanations are written; every figure beside them is read from the chronology when the page loads, so a journey cannot go on asserting a number the data no longer supports."
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {JOURNEYS.map((journey) => (
          <li key={journey.slug}>
            <Link
              href={`/journeys/${journey.slug}`}
              data-testid="journey-link"
              data-journey={journey.slug}
              className="flex h-full flex-col gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <span className="font-medium">{journey.title}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {journey.summary}
              </span>
              <span className="text-xs tracking-widest text-[var(--color-text-muted)] uppercase">
                {journey.steps.length} steps
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

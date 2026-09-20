import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JourneyStep } from '@/components/learning/JourneyStep';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { JOURNEYS, journeyBySlug } from '@/lib/learning';
import { getJourney } from '@/lib/services/dataset';

/**
 * One journey, one step at a time.
 *
 * The step is in the address rather than in component state, so a step
 * is a link, the back button works, and the whole journey can be walked
 * with scripting switched off.
 */
export function generateStaticParams() {
  return JOURNEYS.map((journey) => ({ slug: journey.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const journey = journeyBySlug(slug);
  if (!journey) return { title: 'Learning journeys' };
  return { title: journey.title, description: journey.summary };
}

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const journey = getJourney(slug);
  if (!journey) notFound();

  const query = await searchParams;
  const raw = Array.isArray(query.step) ? query.step[0] : query.step;
  const asked = Number.parseInt(raw ?? '1', 10);
  const total = journey.steps.length;
  const index = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), total) : 1;
  const step = journey.steps[index - 1];
  if (!step) notFound();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Learning journey"
        title={journey.title}
        lede={journey.summary}
      />

      <p className="text-sm text-[var(--color-text-muted)]" data-testid="step-counter">
        Step {index} of {total}
      </p>

      <JourneyStep
        step={step}
        questionHref={(question) =>
          `/games/${question.mode}?seed=${encodeURIComponent(step.question?.seed ?? slug)}`
        }
      />

      <nav className="flex flex-wrap items-center gap-3" aria-label="Journey steps">
        {index > 1 ? (
          <Link
            href={`/journeys/${slug}?step=${index - 1}`}
            data-testid="previous-step"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Previous step
          </Link>
        ) : null}
        {index < total ? (
          <Link
            href={`/journeys/${slug}?step=${index + 1}`}
            data-testid="next-step"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Next step
          </Link>
        ) : (
          <Link
            href="/journeys"
            data-testid="journey-end"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Finish, and pick another journey
          </Link>
        )}
      </nav>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

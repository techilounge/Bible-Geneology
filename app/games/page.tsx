import type { Metadata } from 'next';
import Link from 'next/link';
import { ProgressPanel } from '@/components/games/ProgressPanel';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { MODE_DESCRIPTIONS, MODE_LABELS, QUIZ_MODES } from '@/lib/quiz';

export const metadata: Metadata = {
  title: 'Play and learn',
  description:
    'Eight ways to test what the chronology says, with every answer worked out from the records it came from.',
};

/**
 * The games index.
 *
 * Every question behind these links is generated from the dataset and
 * marked by the chronology engine before it is shown, so there is no
 * answer key anywhere in the product to fall out of step with the data.
 *
 * Today's date seeds today's round, which is what makes it the same
 * round for everyone and a different one tomorrow.
 */
export const revalidate = 3600;

export default function GamesPage() {
  const seed = new Date().toISOString().slice(0, 10);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Play and learn"
        title="Eight ways to test the chronology"
        lede="Every question here is generated from the same records the rest of the site draws on, and the answer is checked against the chronology engine before you are asked. Nothing is stored as an answer key."
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Today&rsquo;s round</h2>
        <p className="text-[var(--color-text-secondary)]">
          The same eight questions for everyone today, and a different eight tomorrow.
        </p>
        <div>
          <Link
            href={`/games/${QUIZ_MODES[0]}?seed=${seed}`}
            data-testid="daily-quiz"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Start today&rsquo;s round
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">The eight modes</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {QUIZ_MODES.map((mode) => (
            <li key={mode}>
              <Link
                href={`/games/${mode}`}
                data-testid="mode-link"
                data-mode={mode}
                className="flex h-full flex-col gap-1 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <span className="font-medium">{MODE_LABELS[mode]}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {MODE_DESCRIPTIONS[mode]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Your progress</h2>
        <ProgressPanel />
      </section>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

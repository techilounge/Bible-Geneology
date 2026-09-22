import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpDown,
  CalendarClock,
  Clock,
  GitCompare,
  GitFork,
  HelpCircle,
  Play,
  Timer,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { ProgressPanel } from '@/components/games/ProgressPanel';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import { MODE_DESCRIPTIONS, MODE_LABELS, QUIZ_MODES, type QuizMode } from '@/lib/quiz';

export const metadata: Metadata = {
  title: 'Play and learn',
  description:
    'Eight ways to test what the chronology says, with every answer worked out from the records it came from.',
};

export const revalidate = 3600;

const MODE_ICONS: Record<QuizMode, typeof Trophy> = {
  'who-lived-longer': Timer,
  'could-lifetimes-overlap': GitCompare,
  'who-was-alive': CalendarClock,
  'put-them-in-order': ArrowUpDown,
  'guess-the-age': HelpCircle,
  'family-connection': GitFork,
  'timeline-placement': Clock,
  'who-am-i': UserCheck,
};

export default function GamesPage() {
  const seed = new Date().toISOString().slice(0, 10);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Play and learn"
        title="Eight ways to test the chronology"
        icon={<Trophy className="size-4" />}
        lede="Every question here is generated from the same records the rest of the site draws on, and the answer is checked against the chronology engine before you are asked. Nothing is stored as an answer key."
      />

      {/* Today's Round Spotlight Card */}
      <section className="glass-panel flex flex-col justify-between gap-4 rounded-2xl border border-[var(--color-accent)]/80 bg-gradient-to-br from-[var(--color-surface-raised)] to-[var(--color-surface-overlay)] p-6 shadow-xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
              <Trophy className="size-4" />
            </span>
            <p className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
              Daily Challenge
            </p>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Today&rsquo;s round
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
            The same eight questions for everyone today, and a different eight tomorrow.
            Test your mastery of biblical history.
          </p>
        </div>

        <div>
          <Link
            href={`/games/${QUIZ_MODES[0]}?seed=${seed}`}
            data-testid="daily-quiz"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <Play className="size-4 fill-current" />
            <span>Start today&rsquo;s round</span>
          </Link>
        </div>
      </section>

      {/* The Eight Modes Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            The eight modes
          </h2>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            Generated & validated live
          </span>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {QUIZ_MODES.map((mode) => {
            const Icon = MODE_ICONS[mode] ?? HelpCircle;
            return (
              <li key={mode}>
                <Link
                  href={`/games/${mode}`}
                  data-testid="mode-link"
                  data-mode={mode}
                  className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <div className="glass-card flex h-full flex-col justify-between gap-3 rounded-2xl p-5 shadow-sm">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--color-surface-overlay)] text-[var(--color-accent)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-surface-base)] transition-colors">
                        <Icon className="size-4.5" />
                      </div>
                      <span className="font-bold text-lg text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                        {MODE_LABELS[mode]}
                      </span>
                      <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        {MODE_DESCRIPTIONS[mode]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                      <span>Launch mode</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Progress Panel */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/50 p-6">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          Your progress
        </h2>
        <ProgressPanel />
      </section>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

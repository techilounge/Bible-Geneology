import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Clock,
  Compass,
  GitCompare,
  GitFork,
  Milestone,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { branding } from '@/lib/config/branding';
import { PRIMARY_NAV, type NavItem } from '@/lib/config/navigation';
import { NOT_CONTACT } from '@/lib/config/copy';
import { pickDiscovery } from '@/lib/discovery';
import { QUIZ_MODES } from '@/lib/quiz';
import { getDiscoveries, getQuestion } from '@/lib/services/dataset';

/**
 * Today's discovery changes with the date, so the page is rebuilt hourly
 * rather than at deploy time. The date is the seed: everyone opening the
 * page on the same day sees the same finding, and the finding is still one
 * the engine generated rather than one chosen at random.
 */
export const revalidate = 3600;

const NAV_ICONS: Record<string, typeof Clock> = {
  '/timeline': Clock,
  '/who-was-alive': CalendarClock,
  '/people': Users,
  '/family-tree': GitFork,
  '/compare': GitCompare,
  '/events': Milestone,
  '/discover': Sparkles,
  '/games': Trophy,
  '/journeys': Compass,
};

const NAV_TAGS: Record<string, string> = {
  '/timeline': 'Continuous Axis',
  '/who-was-alive': 'Year Scrubber',
  '/people': 'Canonical Roster',
  '/family-tree': 'Relational Graph',
  '/compare': 'Overlap Analysis',
  '/events': 'Chronological Anchor',
  '/discover': 'Verified Findings',
  '/games': '8 Interactive Modes',
  '/journeys': '6 Guided Routes',
};

export default function HomePage() {
  const discoveries = getDiscoveries();
  const today = new Date().toISOString().slice(0, 10);
  const todays = pickDiscovery(discoveries, today);
  const mode = QUIZ_MODES[hashDay(today) % QUIZ_MODES.length];
  const question = mode ? getQuestion(mode, today) : null;

  return (
    <PageShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border-subtle)] bg-gradient-to-b from-[var(--color-surface-raised)]/90 via-[var(--color-surface-raised)]/50 to-[var(--color-surface-base)] p-6 sm:p-10 lg:p-14 shadow-xl min-h-[560px] lg:min-h-[620px] flex flex-col justify-center">
        {/* Decorative background aura and lineage line lattice */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25 bg-[url('/assets/lineage-lattice.svg')] bg-cover bg-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-[var(--color-accent)]/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-cyan-500/5 blur-3xl"
        />

        {/* Hero Abraham Cutout Image */}
        <div className="pointer-events-none select-none absolute bottom-0 -right-6 sm:-right-2 md:-right-2 lg:-right-4 xl:right-0 flex items-end justify-end h-[78%] sm:h-[86%] md:h-[93%] lg:h-[95%] max-h-[600px] z-10 opacity-30 sm:opacity-40 md:opacity-100 transition-opacity">
          <img
            src="/assets/abraham-hero-trimmed.png?v=6"
            alt="Patriarch Abraham"
            className="h-full w-auto object-contain object-bottom drop-shadow-2xl"
            loading="eager"
          />
        </div>

        <div className="relative z-20 flex flex-col items-start gap-6 max-w-xl lg:max-w-2xl">
          <Badge variant="accent" size="md" icon={<ShieldCheck className="size-4" />}>
            Interactive Scholarly Chronology
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl text-[var(--color-text-primary)] leading-[1.1]">
            {branding.tagline}
          </h1>

          <p className="text-lg sm:text-xl text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
            {branding.description}
          </p>

          {/* Quick telemetry chips */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-overlay)] px-3 py-1.5 border border-[var(--color-border-subtle)]">
              <span className="size-2 rounded-full bg-emerald-400" />
              49+ Patriarchs & Matriarchs
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-overlay)] px-3 py-1.5 border border-[var(--color-border-subtle)]">
              <span className="size-2 rounded-full bg-[var(--color-accent)]" />
              4,000+ Years Mapped
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-overlay)] px-3 py-1.5 border border-[var(--color-border-subtle)]">
              <span className="size-2 rounded-full bg-cyan-400" />
              100% Explicit Arithmetic
            </span>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Link
              href="/timeline"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-surface-base)] transition-all hover:bg-[var(--color-accent-strong)] hover:shadow-lg hover:shadow-[var(--color-accent)]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <Clock className="size-4.5" />
              <span>Explore the Timeline</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/who-was-alive"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-overlay)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <CalendarClock className="size-4 text-[var(--color-accent)]" />
              <span>Who Was Alive</span>
            </Link>

            <Link
              href="/chronology"
              className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-lg"
            >
              <BookOpen className="size-4" />
              <span>How the dates work</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Daily Spotlight Cards (Today's Discovery & Today's Question) */}
      <div className="grid gap-6 md:grid-cols-2">
        {todays ? (
          <section
            data-testid="todays-discovery"
            className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--color-accent)]/60 bg-gradient-to-br from-[var(--color-surface-raised)] via-[var(--color-surface-raised)] to-[var(--color-surface-overlay)] p-6 shadow-lg shadow-black/20"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                    <Sparkles className="size-4" />
                  </span>
                  <p className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
                    Today&rsquo;s discovery
                  </p>
                </div>
                <Badge variant="subtle" size="sm">
                  Calculated Insight
                </Badge>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-balance text-[var(--color-text-primary)]">
                <Link
                  href={`/discover/${todays.id}`}
                  className="rounded hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {todays.headline}
                </Link>
              </h2>

              {todays.aboutOverlap ? (
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {NOT_CONTACT}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/timeline"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <Clock className="size-4" />
                <span>Explore the timeline</span>
              </Link>
              <Link
                href={`/discover?seed=${encodeURIComponent(today)}`}
                data-testid="surprise-me"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-4 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <Shuffle className="size-4 text-[var(--color-accent)]" />
                <span>Surprise me</span>
              </Link>
            </div>
          </section>
        ) : null}

        {question ? (
          <section
            data-testid="daily-quiz"
            className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-surface-raised)] via-[var(--color-surface-raised)] to-[var(--color-surface-overlay)] p-6 shadow-lg shadow-black/20"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                    <Trophy className="size-4" />
                  </span>
                  <p className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
                    Today&rsquo;s challenge
                  </p>
                </div>
                <Badge variant="subtle" size="sm">
                  Daily Round
                </Badge>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-balance text-[var(--color-text-primary)]">
                {question.prompt}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Test your knowledge against the chronology engine. Generated fresh daily.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href={`/games/${question.mode}?seed=${encodeURIComponent(today)}`}
                data-testid="daily-quiz-link"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-4 font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <span>Answer today&rsquo;s question</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>
        ) : null}
      </div>

      {/* Explorer Hub Grid */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--color-accent)]" />
            <p className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
              Interactive Catalog
            </p>
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Explore the Dataset Nine Ways
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-text-secondary)] max-w-2xl">
            Every view draws from the same verified chronological relationships. Pick a
            lens into the ancient text.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMARY_NAV.map((item: NavItem) => {
            const Icon = NAV_ICONS[item.href] ?? Clock;
            const tag = NAV_TAGS[item.href] ?? 'Explorer';
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Card className="glass-card flex h-full flex-col justify-between gap-4 p-5 rounded-2xl">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-surface-overlay)] text-[var(--color-accent)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-surface-base)] transition-colors">
                          <Icon className="size-5" />
                        </div>
                        <span className="text-[11px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
                          {tag}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                          {item.label}
                        </span>
                        <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                          {item.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Open view</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}

/**
 * Which mode today asks. Rotating by the date rather than by a counter
 * keeps the page pure: the same day always asks the same kind of
 * question, whichever machine renders it.
 */
function hashDay(day: string): number {
  let hash = 0;
  for (let index = 0; index < day.length; index += 1) {
    hash = (hash * 31 + day.charCodeAt(index)) >>> 0;
  }
  return hash;
}

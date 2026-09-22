import Link from 'next/link';
import {
  BookOpen,
  CalendarClock,
  Clock,
  Compass,
  GitCompare,
  GitFork,
  Info,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { branding } from '@/lib/config/branding';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';

/**
 * The disclaimer is in the footer of every page, not tucked inside an
 * expander on one of them. Requirement section 15: the app must never blur
 * what Scripture states with what the app has worked out, and the standing
 * place to say so is where the reader always is.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
        {/* Top Grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:gap-10">
          {/* Col 1: Brand & Mission */}
          <div className="flex flex-col gap-3 md:col-span-1">
            <Link href="/" className="inline-block">
              <BrandLogo />
            </Link>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {branding.description}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-accent)] font-medium">
              <Shield className="size-4 shrink-0" />
              <span>100% Verse-Derived Arithmetic</span>
            </div>
          </div>

          {/* Col 2: Visualizers */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold tracking-wider text-[var(--color-text-primary)] uppercase">
              Interactive Tools
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <li>
                <Link
                  href="/timeline"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Clock className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Interactive Timeline</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/who-was-alive"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <CalendarClock className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Who was alive</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/family-tree"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <GitFork className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Family Tree Graph</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/people"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Users className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>People Directory</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/compare"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <GitCompare className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Lifetime Comparison</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Learn & Discover */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold tracking-wider text-[var(--color-text-primary)] uppercase">
              Learn & Explore
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <li>
                <Link
                  href="/discover"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Sparkles className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Chronology Discoveries</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/games"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Trophy className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Interactive Quizzes</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/journeys"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Compass className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>Guided Journeys</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Methodology & Legal */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold tracking-wider text-[var(--color-text-primary)] uppercase">
              Scholarly Method
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <li>
                <Link
                  href="/chronology"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <BookOpen className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>How the dates work</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="flex min-h-11 items-center gap-2 rounded-md hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Info className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>About this project</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Mandatory Disclaimer & Copyright */}
        <div className="flex flex-col gap-4 border-t border-[var(--color-border-subtle)] pt-8 text-sm text-[var(--color-text-muted)]">
          <p className="max-w-4xl text-xs sm:text-sm leading-relaxed border-l-2 border-[var(--color-accent)]/60 pl-3">
            {CHRONOLOGY_DISCLAIMER}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs">
            <span>
              &copy; {new Date().getFullYear()} {branding.productName}. All figures
              calculated from Masoretic text records.
            </span>
            <div className="flex items-center gap-4">
              <Link
                href="/chronology"
                className="underline underline-offset-4 hover:text-[var(--color-text-secondary)]"
              >
                Methodology
              </Link>
              <Link
                href="/about"
                className="underline underline-offset-4 hover:text-[var(--color-text-secondary)]"
              >
                About
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

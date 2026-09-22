'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  Clock,
  Compass,
  GitCompare,
  GitFork,
  Info,
  Menu,
  Milestone,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { cn } from '../ui/cn';

interface NavItemMeta {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const VISUALIZERS: readonly NavItemMeta[] = [
  {
    href: '/timeline',
    label: 'Timeline',
    description: 'Every dated lifetime on one scrollable axis.',
    icon: Clock,
  },
  {
    href: '/who-was-alive',
    label: 'Who was alive',
    description: 'Pick a year and see who was living in it.',
    icon: CalendarClock,
  },
  {
    href: '/family-tree',
    label: 'Family tree',
    description: 'Descent and relationships as a navigable graph.',
    icon: GitFork,
  },
  {
    href: '/people',
    label: 'People',
    description: 'Every person in the dataset, with their dates.',
    icon: Users,
  },
  {
    href: '/compare',
    label: 'Compare',
    description: 'Two lifetimes side by side, and overlap analysis.',
    icon: GitCompare,
  },
  {
    href: '/events',
    label: 'Events',
    description: 'Dated historical milestones and who witnessed them.',
    icon: Milestone,
  },
];

const LEARN_NAV: readonly NavItemMeta[] = [
  {
    href: '/discover',
    label: 'Discover',
    description: 'Findings supported by the chronology arithmetic.',
    icon: Sparkles,
  },
  {
    href: '/games',
    label: 'Play & Quiz',
    description: 'Interactive challenges generated from the dataset.',
    icon: Trophy,
  },
  {
    href: '/journeys',
    label: 'Journeys',
    description: 'Guided step-by-step walks through genealogy.',
    icon: Compass,
  },
];

const REFERENCE_NAV: readonly NavItemMeta[] = [
  {
    href: '/chronology',
    label: 'How the dates work',
    description: 'What Scripture states vs what is calculated.',
    icon: BookOpen,
  },
  {
    href: '/about',
    label: 'About',
    description: 'Dataset scope, methodology, and scholarly principles.',
    icon: Info,
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const learnRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Close menus on path change
  useEffect(() => {
    setMobileOpen(false);
    setLearnOpen(false);
    setToolsOpen(false);
  }, [pathname]);

  // Click outside to close desktop dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (learnRef.current && !learnRef.current.contains(event.target as Node)) {
        setLearnOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const primaryDirectLinks = VISUALIZERS.slice(0, 4);
  const moreVisualizers = VISUALIZERS.slice(4);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link
          href="/"
          className="flex min-h-11 items-center rounded-lg pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          <BrandLogo />
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Primary" className="hidden lg:flex lg:items-center lg:gap-1">
          {primaryDirectLinks.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                  active
                    ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)] shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* More Tools Dropdown */}
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setToolsOpen((prev) => !prev);
                setLearnOpen(false);
              }}
              aria-expanded={toolsOpen}
              className={cn(
                'flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                moreVisualizers.some((i) => isCurrent(i.href))
                  ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <span>Explore</span>
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform duration-200',
                  toolsOpen && 'rotate-180',
                )}
              />
            </button>

            {toolsOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2 shadow-xl shadow-black/40 backdrop-blur-md">
                <div className="flex flex-col gap-1">
                  {moreVisualizers.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setToolsOpen(false)}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                          isCurrent(item.href)
                            ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)] font-medium'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]',
                        )}
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-accent)]">
                          <Icon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--color-text-primary)] leading-snug">
                            {item.label}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] line-clamp-1">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Learn & Play Dropdown */}
          <div ref={learnRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setLearnOpen((prev) => !prev);
                setToolsOpen(false);
              }}
              aria-expanded={learnOpen}
              className={cn(
                'flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                LEARN_NAV.some((i) => isCurrent(i.href))
                  ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <span>Learn & Play</span>
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform duration-200',
                  learnOpen && 'rotate-180',
                )}
              />
            </button>

            {learnOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2 shadow-xl shadow-black/40 backdrop-blur-md">
                <div className="flex flex-col gap-1">
                  {LEARN_NAV.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setLearnOpen(false)}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                          isCurrent(item.href)
                            ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)] font-medium'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]',
                        )}
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-accent)]">
                          <Icon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--color-text-primary)] leading-snug">
                            {item.label}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] line-clamp-1">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Reference Link */}
          <Link
            href="/chronology"
            aria-current={isCurrent('/chronology') ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
              isCurrent('/chronology')
                ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <span>Method</span>
          </Link>
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            aria-label="Account"
            className={cn(
              'flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
              isCurrent('/account')
                ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <User className="size-4.5" />
          </Link>

          {/* Mobile menu toggle button */}
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] lg:hidden"
          >
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
            {mobileOpen ? (
              <X className="size-5 text-[var(--color-accent)]" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/98 px-4 py-4 backdrop-blur-xl lg:hidden"
        >
          <div className="flex flex-col gap-5">
            {/* Visualizers */}
            <div>
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wider text-[var(--color-accent)] uppercase">
                Visualizers & Data
              </p>
              <ul className="flex flex-col gap-1">
                {VISUALIZERS.map((item) => {
                  const Icon = item.icon;
                  const active = isCurrent(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                          active
                            ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)] font-medium'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-accent)]">
                          <Icon className="size-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {item.label}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Learn & Play */}
            <div>
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wider text-[var(--color-accent)] uppercase">
                Learn & Play
              </p>
              <ul className="flex flex-col gap-1">
                {LEARN_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isCurrent(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                          active
                            ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)] font-medium'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-accent)]">
                          <Icon className="size-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {item.label}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Reference */}
            <div>
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wider text-[var(--color-accent)] uppercase">
                Methodology & System
              </p>
              <ul className="flex flex-col gap-1">
                {REFERENCE_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isCurrent(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                          active
                            ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)] font-medium'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-accent)]">
                          <Icon className="size-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {item.label}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

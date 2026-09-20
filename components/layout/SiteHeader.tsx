'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { branding } from '@/lib/config/branding';
import { PRIMARY_NAV, SECONDARY_NAV } from '@/lib/config/navigation';
import { cn } from '../ui/cn';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const link = (href: string, label: string, onNavigate?: () => void) => (
    <Link
      key={href}
      href={href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      aria-current={isCurrent(href) ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        isCurrent(href)
          ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center rounded-lg px-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {branding.shortName}
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex lg:items-center lg:gap-1">
          {PRIMARY_NAV.map((item) => link(item.href, item.label))}
          {SECONDARY_NAV.map((item) => link(item.href, item.label))}
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] lg:hidden"
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-[var(--color-border-subtle)] px-4 pb-3 lg:hidden"
        >
          <ul className="flex flex-col gap-1 pt-2">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
              <li key={item.href}>{link(item.href, item.label, () => setOpen(false))}</li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

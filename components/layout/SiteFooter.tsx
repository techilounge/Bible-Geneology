import Link from 'next/link';
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
    <footer className="mt-16 border-t border-[var(--color-border-subtle)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[var(--color-text-muted)]">
        <p className="max-w-3xl">{CHRONOLOGY_DISCLAIMER}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{branding.productName}</span>
          <Link
            href="/chronology"
            className="rounded underline underline-offset-4 hover:text-[var(--color-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            How the dates work
          </Link>
          <Link
            href="/about"
            className="rounded underline underline-offset-4 hover:text-[var(--color-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}

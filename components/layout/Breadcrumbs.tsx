import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
    >
      <Link
        href="/"
        className="flex min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 items-center justify-center gap-1 rounded hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <Home className="size-3.5" />
        <span className="sr-only sm:not-sr-only">Home</span>
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={item.label} className="flex items-center gap-1.5">
            <ChevronRight
              className="size-3 text-[var(--color-text-muted)]/50 shrink-0"
              aria-hidden="true"
            />
            {isLast || !item.href ? (
              <span
                className="font-medium text-[var(--color-text-secondary)] line-clamp-1"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="rounded hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] line-clamp-1"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

import { cn } from './cn';

/**
 * A loading placeholder.
 *
 * `aria-hidden` with a `role="status"` sibling in the page's loading.tsx: a
 * screen reader should hear "Loading" once, not a description of every grey
 * rectangle on the page.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-[var(--color-surface-overlay)]',
        className,
      )}
    />
  );
}

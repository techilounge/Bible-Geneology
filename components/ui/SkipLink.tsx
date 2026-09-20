/**
 * Requirement section 50. The first thing in the tab order, visually hidden
 * until focused, so a keyboard user is not made to tab through the whole
 * navigation on every page.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-surface-base)] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to main content
    </a>
  );
}

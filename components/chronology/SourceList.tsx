import type { ScriptureReference } from '@/lib/domain';

/**
 * The verses a value came from.
 *
 * Reference only, never verse text. Requirement section 16: translations are
 * copyrighted, and this app stores where a number is stated rather than what
 * the verse says. That is also the honest boundary — the app's claim is about
 * the numbers, not about the wording.
 */
export function SourceList({
  references,
  label = 'Sources',
}: {
  references: readonly ScriptureReference[];
  label?: string;
}) {
  if (references.length === 0) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span className="text-[var(--color-text-muted)]">{label}:</span>
      {references.map((reference, index) => (
        <span key={reference.id} className="text-[var(--color-text-secondary)]">
          {reference.displayLabel}
          {index < references.length - 1 ? ',' : ''}
        </span>
      ))}
    </div>
  );
}

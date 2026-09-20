import type { Assumption, Derivation, ScriptureReference } from '@/lib/domain';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';

/**
 * Requirement section 17. The working behind a derived year, shown in full.
 *
 * It renders the derivation the engine recorded when the value was computed,
 * and never recomputes anything. A page that re-derived the chain for display
 * could disagree with the number printed beside it, which is the one failure
 * this feature exists to make impossible.
 */
export function WhyThisDate({
  derivation,
  references,
  assumptions,
  calculationMethod,
}: {
  derivation: Derivation;
  references: readonly ScriptureReference[];
  assumptions: readonly Assumption[];
  calculationMethod?: string | null;
}) {
  const byId = new Map(references.map((r) => [r.id, r]));
  const label = (id: string) => byId.get(id)?.displayLabel ?? id;
  const steps = derivation.steps;

  return (
    <details className="group rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
        Why this date?
      </summary>

      <div className="flex flex-col gap-4 px-4 pt-2 pb-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          This year is not stated anywhere. It is the running total of{' '}
          {steps.length === 1 ? 'one interval' : `${steps.length} intervals`} the text
          does state, counted from year 0 {EPOCH_LABEL}.
        </p>

        <ol className="flex flex-col gap-1 text-sm">
          {steps.map((step, index) => (
            <li
              key={`${step.from}-${step.to}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--color-border-subtle)] pb-1 last:border-0"
            >
              <span className="font-mono text-[var(--color-text-muted)] tabular-nums">
                {step.years >= 0 ? '+' : '−'}
                {Math.abs(step.years)}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                {step.from} &rarr; {step.to}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {label(step.reference)}
              </span>
              <span className="ml-auto font-mono tabular-nums">
                {step.runningTotal} {derivation.unit}
              </span>
            </li>
          ))}
        </ol>

        {calculationMethod ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Method: <span className="font-mono">{calculationMethod}</span>
          </p>
        ) : null}

        {assumptions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">What this calculation assumes</h3>
            {assumptions.map((assumption) => (
              <div key={assumption.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {assumption.title}
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {assumption.explanation}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

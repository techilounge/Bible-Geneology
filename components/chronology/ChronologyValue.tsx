import type { ChronologyResult } from '@/lib/domain';
import { ConfidenceBadge } from './ConfidenceBadge';

/**
 * Renders any engine result, including the ones that have no value.
 *
 * Requirement section 57: never show NaN, undefined, null or a negative age.
 * Every engine function returns a `ChronologyResult`, and this component is
 * the only place the union is unwrapped for display, so there is exactly one
 * place where "we do not know" gets its wording. A component that reached for
 * `result.value` without checking `status` would not compile.
 */
const UNKNOWN_WORDING = {
  'no-data': 'Scripture does not give this',
  'unknown-in-chronology': 'Cannot be worked out from what Scripture gives',
  'not-applicable': 'Not part of this chronology',
} as const;

export function ChronologyValue<T>({
  result,
  render,
  showConfidence = true,
}: {
  result: ChronologyResult<T>;
  render: (value: T) => React.ReactNode;
  showConfidence?: boolean;
}) {
  if (result.status === 'unknown') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-[var(--color-text-muted)] italic">
          {UNKNOWN_WORDING[result.reason]}
        </span>
        {showConfidence ? <ConfidenceBadge level="UNKNOWN" /> : null}
      </span>
    );
  }

  if (result.status === 'disputed') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {result.alternatives.map((alternative, index) => (
          <span key={alternative.sourceId} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <span className="text-[var(--color-text-muted)]">or</span>
            ) : null}
            {render(alternative.value)}
            <span className="text-xs text-[var(--color-text-muted)]">
              ({alternative.sourceId})
            </span>
          </span>
        ))}
        {showConfidence ? <ConfidenceBadge level="DISPUTED" /> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {render(result.value)}
      {showConfidence ? <ConfidenceBadge level={result.confidence} /> : null}
    </span>
  );
}

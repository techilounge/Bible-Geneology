import { Card } from '@/components/ui/Card';

/**
 * An honest placeholder for a route whose phase has not been built.
 *
 * It says what will be here and why it is not yet, rather than showing an
 * empty page or a spinner that never resolves. The build order exists
 * because the data has to be right before anything draws it, and a visitor
 * who arrives early should be told that rather than left guessing.
 */
export function ComingInPhase({
  phase,
  what,
  dependsOn,
}: {
  phase: number;
  what: string;
  dependsOn?: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-xs tracking-widest text-[var(--color-accent)] uppercase">
        Phase {phase}
      </p>
      <p className="text-[var(--color-text-secondary)]">{what}</p>
      {dependsOn ? (
        <p className="text-sm text-[var(--color-text-muted)]">{dependsOn}</p>
      ) : null}
    </Card>
  );
}

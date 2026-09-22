import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';

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
    <Card className="glass-panel flex flex-col gap-3 rounded-2xl p-6 shadow-md border-l-4 border-l-[var(--color-accent)]">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-[var(--color-accent)]" />
        <p className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
          Phase {phase} Roadmap
        </p>
      </div>
      <p className="text-base font-medium text-[var(--color-text-primary)] leading-relaxed">
        {what}
      </p>
      {dependsOn ? (
        <p className="text-sm text-[var(--color-text-muted)] border-t border-[var(--color-border-subtle)]/50 pt-2">
          {dependsOn}
        </p>
      ) : null}
    </Card>
  );
}

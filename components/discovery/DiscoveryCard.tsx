import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { Discovery } from '@/lib/discovery';
import { NOT_CONTACT } from '@/lib/config/copy';

export function DiscoveryCard({
  discovery,
  names,
}: {
  discovery: Discovery;
  names: Readonly<Record<string, string>>;
}) {
  return (
    <li
      data-testid="discovery"
      data-kind={discovery.kind}
      className="glass-card flex flex-col justify-between gap-3 rounded-2xl p-5 shadow-md"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
            <Sparkles className="size-3" />
            <span className="capitalize">{discovery.kind.replace(/-/g, ' ')}</span>
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
            {discovery.population}
          </span>
        </div>

        <h3 className="text-lg font-bold text-balance text-[var(--color-text-primary)]">
          <Link
            href={`/discover/${discovery.id}`}
            className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            {discovery.headline}
          </Link>
        </h3>

        {discovery.aboutOverlap ? (
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {NOT_CONTACT}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)]/50 pt-3 text-xs text-[var(--color-text-muted)]">
        <span className="line-clamp-1 max-w-[80%]">
          {discovery.personIds
            .map((personId) => names[personId] ?? personId)
            .slice(0, 5)
            .join(', ')}
          {discovery.personIds.length > 5
            ? ` +${discovery.personIds.length - 5} more`
            : ''}
        </span>
        <ArrowRight className="size-3.5 text-[var(--color-accent)] shrink-0" />
      </div>
    </li>
  );
}

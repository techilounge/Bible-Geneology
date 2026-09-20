import Link from 'next/link';
import type { Discovery } from '@/lib/discovery';
import { NOT_CONTACT } from '@/lib/config/copy';

/**
 * One finding, as it appears in a list.
 *
 * The headline is generated; this file writes none of it. What it adds is
 * the frame: what the finding was drawn from, and — when the finding rests
 * on two lifetimes overlapping — the sentence from requirement section 21
 * saying what an overlap is not.
 */
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
      className="flex flex-col gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
    >
      <h3 className="text-lg font-medium text-balance">
        <Link
          href={`/discover/${discovery.id}`}
          className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          {discovery.headline}
        </Link>
      </h3>

      <p className="text-sm text-[var(--color-text-muted)]">
        Drawn from {discovery.population}.
      </p>

      {discovery.aboutOverlap ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{NOT_CONTACT}</p>
      ) : null}

      <p className="text-sm text-[var(--color-text-muted)]">
        {discovery.personIds
          .map((personId) => names[personId] ?? personId)
          .slice(0, 6)
          .join(', ')}
        {discovery.personIds.length > 6
          ? ` and ${discovery.personIds.length - 6} more`
          : ''}
      </p>
    </li>
  );
}

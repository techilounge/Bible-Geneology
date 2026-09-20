'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ConfidenceBadge } from '@/components/chronology/ConfidenceBadge';
import { Card } from '@/components/ui/Card';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { ConfidenceLevel } from '@/lib/domain';

export interface DirectoryEntry {
  id: string;
  slug: string;
  name: string;
  /** Every other name this person is called, so a search for Abram finds him. */
  aliases: string[];
  eraName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  birthConfidence: ConfidenceLevel;
}

/**
 * Search runs in the browser over the whole list.
 *
 * The dataset is 49 people through the MVP and a few hundred at most after
 * it, small enough that filtering an array beats a round trip and far
 * smaller than the JavaScript a search service would cost. Requirement
 * section 49's performance budget is easiest to keep by not shipping the
 * feature at all.
 */
export function PeopleDirectory({ entries }: { entries: readonly DirectoryEntry[] }) {
  const [query, setQuery] = useState('');
  const [onlyDated, setOnlyDated] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (onlyDated && entry.birthYear === null) return false;
      if (needle === '') return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.aliases.some((alias) => alias.toLowerCase().includes(needle))
      );
    });
  }, [entries, query, onlyDated]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DirectoryEntry[]>();
    for (const entry of filtered) {
      const key = entry.eraName ?? 'Other';
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [filtered]);

  const undatedCount = filtered.filter((entry) => entry.birthYear === null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Search people by name</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, including former names"
            className="min-h-11 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 text-base placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyDated}
            onChange={(event) => setOnlyDated(event.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          Only people with dates
        </label>
      </div>

      <p role="status" className="text-sm text-[var(--color-text-muted)]">
        {filtered.length} of {entries.length} people
        {undatedCount > 0 && !onlyDated
          ? `, of whom ${undatedCount} have no ages in Scripture`
          : ''}
        .
      </p>

      {grouped.length === 0 ? (
        <Card>
          <p className="text-[var(--color-text-secondary)]">
            No one in this dataset matches &ldquo;{query}&rdquo;.
          </p>
        </Card>
      ) : null}

      {grouped.map(([era, people]) => (
        <section key={era} className="flex flex-col gap-3">
          <h2 className="text-sm tracking-widest text-[var(--color-text-muted)] uppercase">
            {era}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/people/${entry.slug}`}
                  className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Card className="flex h-full flex-col gap-2 transition-colors hover:border-[var(--color-accent)]">
                    <span className="font-semibold">{entry.name}</span>
                    {entry.birthYear === null ? (
                      <span className="text-sm text-[var(--color-text-muted)] italic">
                        Scripture gives no ages
                      </span>
                    ) : (
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-sm tabular-nums">
                          {entry.birthYear}
                          {'–'}
                          {entry.deathYear ?? '?'} {EPOCH_LABEL}
                        </span>
                        <ConfidenceBadge level={entry.birthConfidence} />
                      </span>
                    )}
                    {entry.aliases.length > 0 ? (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        also {entry.aliases.join(', ')}
                      </span>
                    ) : null}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

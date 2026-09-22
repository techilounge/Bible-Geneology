'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { ConfidenceBadge } from '@/components/chronology/ConfidenceBadge';
import { Card } from '@/components/ui/Card';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { ConfidenceLevel } from '@/lib/domain';

export interface DirectoryEntry {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  eraName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  birthConfidence: ConfidenceLevel;
  hasPortrait?: boolean;
}

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
      {/* Search & Filter Toolbar */}
      <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between shadow-lg">
        <label className="relative flex-1">
          <span className="sr-only">Search people by name</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, including former names"
            className="min-h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] pr-9 pl-10 text-sm placeholder:text-[var(--color-text-muted)] transition-colors focus-visible:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors">
          <input
            type="checkbox"
            checked={onlyDated}
            onChange={(event) => setOnlyDated(event.target.checked)}
            className="size-4.5 rounded accent-[var(--color-accent)] cursor-pointer"
          />
          <span>Only people with dates</span>
        </label>
      </div>

      <p
        role="status"
        className="text-xs sm:text-sm font-medium text-[var(--color-text-muted)]"
      >
        {filtered.length} of {entries.length} people
        {undatedCount > 0 && !onlyDated
          ? `, of whom ${undatedCount} have no ages in Scripture`
          : ''}
        .
      </p>

      {grouped.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <p className="text-[var(--color-text-secondary)]">
            No one in this dataset matches &ldquo;{query}&rdquo;.
          </p>
        </Card>
      ) : null}

      {grouped.map(([era, people]) => (
        <section key={era} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] pb-2">
            <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
            <h2 className="text-xs font-bold tracking-widest text-[var(--color-accent)] uppercase">
              {era}
            </h2>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">
              ({people.length})
            </span>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/people/${entry.slug}`}
                  className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Card className="glass-card flex h-full flex-col justify-between gap-3 p-4 rounded-2xl">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {entry.hasPortrait ? (
                            <img
                              src={`/assets/${entry.slug}.jpg`}
                              alt=""
                              className="size-8 shrink-0 rounded-lg object-cover border border-[var(--color-border-subtle)]"
                            />
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-overlay)] text-[var(--color-accent)] font-bold text-xs border border-[var(--color-border-subtle)]">
                              {entry.name[0]}
                            </div>
                          )}
                          <span className="font-bold text-base text-[var(--color-text-primary)]">
                            {entry.name}
                          </span>
                        </div>
                      </div>

                      {entry.birthYear === null ? (
                        <span className="text-xs text-[var(--color-text-muted)] italic">
                          Scripture gives no ages
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="font-mono text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                            {entry.birthYear}–{entry.deathYear ?? '?'} {EPOCH_LABEL}
                          </span>
                          <ConfidenceBadge level={entry.birthConfidence} />
                        </div>
                      )}
                    </div>

                    {entry.aliases.length > 0 ? (
                      <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1 border-t border-[var(--color-border-subtle)]/40 pt-2">
                        Also known as: {entry.aliases.join(', ')}
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

'use client';

import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, summarise, type Progress } from '@/lib/progress';
import { readAttempts } from './progress-store';

/**
 * XP, level, streak and badges, read from this browser.
 *
 * Rendered empty on the server and filled in after mount, because the
 * log is per-browser and there is nothing to render before it has been
 * read. Requirement section 38 asks that gamification support learning
 * rather than dominate it, which is why this sits under the games
 * rather than across the top of the site.
 */
export function ProgressPanel() {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    setProgress(summarise(readAttempts()));
  }, []);

  if (progress === null || progress.answered === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]" data-testid="progress-empty">
        Your score is kept in this browser, and nowhere else. Play a round and it will
        appear here.
      </p>
    );
  }

  const earned = new Set(progress.achievements);

  return (
    <div className="flex flex-col gap-4" data-testid="progress">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Level" value={`${progress.level}`} />
        <Figure label="XP" value={`${progress.xp}`} />
        <Figure label="Answered" value={`${progress.correct} of ${progress.answered}`} />
        <Figure
          label="Streak"
          value={progress.streakDays === 1 ? '1 day' : `${progress.streakDays} days`}
        />
      </dl>

      <ul className="flex flex-col gap-2">
        {ACHIEVEMENTS.map((achievement) => (
          <li
            key={achievement.id}
            data-testid="achievement"
            data-earned={String(earned.has(achievement.id))}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--color-border-subtle)] pb-2 text-sm"
          >
            <span
              className={
                earned.has(achievement.id)
                  ? 'font-medium text-[var(--color-accent)]'
                  : 'font-medium text-[var(--color-text-muted)]'
              }
            >
              {achievement.name}
            </span>
            <span className="text-[var(--color-text-secondary)]">
              {achievement.description}
            </span>
            <span className="ml-auto text-[var(--color-text-muted)]">
              {earned.has(achievement.id) ? 'Earned' : 'Not yet'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3">
      <dt className="text-xs tracking-widest text-[var(--color-text-muted)] uppercase">
        {label}
      </dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}

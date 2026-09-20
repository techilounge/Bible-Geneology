import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { Timeline } from '@/components/timeline/Timeline';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import {
  getCanonical,
  getDataset,
  getTimelineEvents,
  getTimelineRows,
} from '@/lib/services/dataset';

export const metadata: Metadata = {
  title: 'Timeline',
  description:
    'Every dated lifetime on one scrollable axis, with the confidence of each date shown on the bar itself.',
};

export default function TimelinePage() {
  const canonical = getCanonical();
  const dataset = getDataset();
  const rows = getTimelineRows();
  const events = getTimelineEvents();

  /**
   * Three groups, kept apart. Someone with a birth year and no end is not
   * the same as someone Scripture gives no ages for, and the page says so
   * rather than quietly folding them into one number.
   */
  const placed = new Set(rows.map((row) => row.personId));
  const startedButUnended: string[] = [];
  let undatedCount = 0;
  for (const person of canonical.people) {
    if (placed.has(person.id)) continue;
    const record = dataset.chronology.get(person.id);
    if (record && record.birthYear !== null) startedButUnended.push(person.canonicalName);
    else undatedCount += 1;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Chronology"
        title="Timeline"
        lede={`${rows.length} lifetimes on one axis, each bar coloured by how the app knows its dates. Select a lifetime to see which others ran alongside it.`}
      />
      <Timeline
        rows={rows}
        events={events}
        undatedCount={undatedCount}
        startedButUnended={startedButUnended}
      />
      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { YearExplorer } from '@/components/year/YearExplorer';
import { busiestYear, livingWindowEnd } from '@/lib/chronology';
import { CHRONOLOGY_DISCLAIMER, EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import {
  getCanonical,
  getDataset,
  getTimelineBounds,
  getTimelineEvents,
  getTimelineRows,
} from '@/lib/services/dataset';

export const metadata: Metadata = {
  title: 'Who was alive',
  description:
    'Pick a year and see everyone the dataset can place alive in it, with their ages.',
};

/**
 * Keeps a hand-typed or hand-edited year inside the range the chronology
 * covers. `?year=abc` and `?year=99999` both land on a real year rather
 * than on an empty page or a crash.
 */
function readYear(
  raw: string | string[] | undefined,
  fallback: number,
  bounds: readonly [number, number],
): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), bounds[0]), bounds[1]);
}

export default async function WhoWasAlivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const canonical = getCanonical();
  const dataset = getDataset();
  const rows = getTimelineRows();
  const events = getTimelineEvents();
  const bounds = getTimelineBounds();

  // The page has to open on some year, and the fullest one is more use than
  // the epoch, where the answer is Adam on his own.
  const busiest = busiestYear(dataset);
  const defaultYear = busiest.status === 'known' ? busiest.value.year : bounds[0];
  const initialYear = readYear((await searchParams).year, defaultYear, bounds);

  const unplaceableCount = canonical.people.filter((person) => {
    const record = dataset.chronology.get(person.id);
    return !record || livingWindowEnd(record) === null;
  }).length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Chronology"
        title="Who was alive"
        lede={`Pick a year and see everyone this chronology can place alive in it, with their ages. It opens on ${defaultYear} ${EPOCH_LABEL}, the fullest year in the dataset.`}
      />
      <YearExplorer
        chronologyId={dataset.chronologyId}
        people={canonical.people}
        chronology={[...dataset.chronology.values()]}
        rows={rows}
        events={events}
        bounds={bounds}
        initialYear={initialYear}
        unplaceableCount={unplaceableCount}
      />
      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}

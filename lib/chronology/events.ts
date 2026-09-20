import { type ChronologyResult, known, unknown } from '@/lib/domain';
import { type Dataset, hasDates, isPresent, lookup } from './dataset';

export interface EventDuringLifetime {
  eventId: string;
  startYear: number;
  endYear: number | null;
  ageAtEvent: number;
}

/**
 * Events falling within a person's lifetime, with their age at each.
 *
 * Events whose year is unknown are left out rather than placed at a guessed
 * year. The Tower of Babel has no stated date, so it appears on no timeline
 * until a source supplies one.
 */
export function getEventsDuringLifetime(
  dataset: Dataset,
  personId: string,
): ChronologyResult<EventDuringLifetime[]> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');

  const record = lookup(dataset, personId);
  if (!hasDates(record)) return unknown('unknown-in-chronology');

  const during: EventDuringLifetime[] = [];
  for (const event of dataset.eventChronology.values()) {
    if (event.startYear === null) continue;
    if (event.startYear < record.birthYear || event.startYear >= record.deathYear)
      continue;
    during.push({
      eventId: event.eventId,
      startYear: event.startYear,
      endYear: event.endYear,
      ageAtEvent: event.startYear - record.birthYear,
    });
  }

  return known(
    during.sort((a, b) => a.startYear - b.startYear),
    'DERIVED',
  );
}

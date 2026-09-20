import { type ChronologyResult, known, unknown } from '@/lib/domain';
import { type Dataset, hasDates, isPresent, lookup } from './dataset';

export interface Age {
  years: number;
  /** True when the year asked about falls after this person's death. */
  posthumous: boolean;
}

/**
 * How old someone was in a given epoch year.
 *
 * A year before their birth returns unknown rather than a negative number
 * (requirement section 57). A year after their death returns their age at
 * death, flagged posthumous, so a caller can say "he had already died" rather
 * than quietly showing an age he never reached.
 */
export function getAgeAtYear(
  dataset: Dataset,
  personId: string,
  year: number,
): ChronologyResult<Age> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');

  const record = lookup(dataset, personId);
  if (record?.birthYear == null) return unknown('no-data');

  if (year < record.birthYear) return unknown('no-data');

  if (record.deathYear !== null && year >= record.deathYear) {
    return known(
      { years: record.deathYear - record.birthYear, posthumous: true },
      'DERIVED',
    );
  }

  return known({ years: year - record.birthYear, posthumous: false }, 'DERIVED');
}

/** How old A was when B was born. */
export function getAgeAtPersonBirth(
  dataset: Dataset,
  personId: string,
  otherPersonId: string,
): ChronologyResult<Age> {
  const other = lookup(dataset, otherPersonId);
  if (!isPresent(dataset, otherPersonId)) return unknown('not-applicable');
  if (other?.birthYear == null) return unknown('unknown-in-chronology');
  return getAgeAtYear(dataset, personId, other.birthYear);
}

/** How old A was when B died. */
export function getAgeAtPersonDeath(
  dataset: Dataset,
  personId: string,
  otherPersonId: string,
): ChronologyResult<Age> {
  const other = lookup(dataset, otherPersonId);
  if (!isPresent(dataset, otherPersonId)) return unknown('not-applicable');
  if (other?.deathYear == null) return unknown('unknown-in-chronology');
  return getAgeAtYear(dataset, personId, other.deathYear);
}

export interface PersonTimeline {
  personId: string;
  birthYear: number;
  deathYear: number | null;
  lifespan: number | null;
  /** True when the record has a lifespan but no recorded death, as Enoch does. */
  openEnded: boolean;
}

export function getPersonTimeline(
  dataset: Dataset,
  personId: string,
): ChronologyResult<PersonTimeline> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');
  const record = lookup(dataset, personId);
  if (record?.birthYear == null) return unknown('no-data');

  return known(
    {
      personId,
      birthYear: record.birthYear,
      deathYear: record.deathYear,
      lifespan: record.lifespan,
      openEnded: record.deathYear === null,
    },
    record.birthConfidence,
    record.derivation ?? undefined,
  );
}

/** Everyone the dataset can place on a timeline at all. */
export function datedPeople(dataset: Dataset) {
  return [...dataset.chronology.values()].filter(hasDates);
}

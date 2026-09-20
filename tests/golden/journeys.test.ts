import { describe, expect, it } from 'vitest';
import {
  ALTERNATE_CHRONOLOGY_ID,
  DEFAULT_CHRONOLOGY_ID,
} from '@/lib/config/chronology-defaults';
import { JOURNEYS, buildJourney, unknownRecords } from '@/lib/learning';
import { loadDerived } from './load';

/**
 * The journeys, against the dataset they name.
 *
 * A journey is the only place in the product where a person is written
 * down by hand, so these are the assertions that keep a hand-written step
 * from pointing at a record that is not there, or from showing a figure
 * that belongs to a different chronology.
 */
const dataset = loadDerived(DEFAULT_CHRONOLOGY_ID);

describe('every journey names records the dataset holds', () => {
  it.each(JOURNEYS.map((journey) => [journey.slug, journey] as const))(
    '%s',
    (_slug, journey) => {
      expect(unknownRecords(dataset, journey)).toEqual([]);
    },
  );
});

describe('every journey fills in from the engine', () => {
  it.each(JOURNEYS.map((journey) => [journey.slug, journey] as const))(
    '%s',
    (_slug, journey) => {
      const built = buildJourney(dataset, journey);
      for (const step of built.steps) {
        expect(step.people.length, step.id).toBeGreaterThan(0);
        if (step.question) {
          expect(step.generatedQuestion, `${journey.slug}/${step.id}`).not.toBeNull();
        }
      }
      // A journey has to place somebody, or it is not about a
      // chronology at all. An individual step may place nobody — the
      // children of Jacob are in the family tree and off the timeline,
      // and saying so is the step's whole point.
      expect(
        built.steps.some((step) => step.people.some((person) => !person.undated)),
        `${journey.slug} places nobody at all`,
      ).toBe(true);
    },
  );
});

describe('a journey under the alternate chronology', () => {
  it('shows the alternate years rather than the default ones', () => {
    const alternate = loadDerived(ALTERNATE_CHRONOLOGY_ID);
    const journey = JOURNEYS.find((entry) => entry.slug === 'noah-to-abraham');
    expect(journey).toBeDefined();
    if (!journey) return;

    const years = (source: typeof dataset) =>
      buildJourney(source, journey).steps.flatMap((step) =>
        step.people.map((person) => person.birthYear),
      );
    // Abraham's birth year is exactly what the two readings disagree
    // about, and this journey is the one that shows it.
    expect(years(alternate)).not.toEqual(years(dataset));
  });
});

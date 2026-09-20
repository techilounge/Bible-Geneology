import { describe, expect, it } from 'vitest';
import { QUIZ_MODES } from '@/lib/quiz';
import { quizFixture } from '@/lib/quiz/__tests__/fixtures';
import { fixtureDataset } from '@/lib/chronology/__tests__/fixtures';
import { buildJourney, buildStep, unknownRecords } from '../build';
import { JOURNEYS, journeyBySlug } from '../journeys';

/**
 * A journey is the one place in the product where people are named by
 * hand, so the tests here are mostly about what the prose may not do:
 * carry a figure, claim a meeting, or point at a record that is not
 * there. The last of those is asserted against the real dataset in
 * tests/golden, since it is a fact about the data rather than the code.
 */
describe('the six journeys', () => {
  it('are the six requirement section 39 asks for', () => {
    expect(JOURNEYS).toHaveLength(6);
    expect(JOURNEYS.map((journey) => journey.slug)).toEqual([
      'adam-to-noah',
      'the-flood-generation',
      'noah-to-abraham',
      'abrahams-family',
      'isaac-and-jacob',
      'the-twelve-tribes',
    ]);
  });

  it('have unique slugs, and unique step ids within a journey', () => {
    expect(new Set(JOURNEYS.map((j) => j.slug)).size).toBe(JOURNEYS.length);
    for (const journey of JOURNEYS) {
      const ids = journey.steps.map((step) => step.id);
      expect(new Set(ids).size, journey.slug).toBe(ids.length);
      expect(journey.steps.length, journey.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('name at least one person in every step', () => {
    for (const journey of JOURNEYS) {
      for (const step of journey.steps) {
        expect(step.personIds.length, `${journey.slug}/${step.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('carry no figure in their prose', () => {
    // A hand-written number is a claim that can rot: it is true of one
    // chronology and silently wrong under another. Every figure a journey
    // shows is read from the engine when the page renders.
    //
    // A chapter citation is not a figure — "Genesis 5" names a passage
    // and cannot be falsified by a chronology change — so it is removed
    // before the check rather than exempting the rule.
    const withoutCitations = (text: string) =>
      text.replace(/\b(Genesis|Exodus|Acts)\s+\d+(:\d+(\u2013\d+)?)?/g, '');

    for (const journey of JOURNEYS) {
      expect(withoutCitations(journey.summary), journey.slug).not.toMatch(/\d/);
      for (const step of journey.steps) {
        const where = `${journey.slug}/${step.id}`;
        expect(withoutCitations(step.title), where).not.toMatch(/\d/);
        expect(withoutCitations(step.body), where).not.toMatch(/\d/);
      }
    }
  });

  it('never turn an overlap into a meeting', () => {
    const banned = [
      /\bmust have met\b/i,
      /\bwould have met\b/i,
      /\bknew each other\b/i,
      /\bpassed down\b/i,
      /\btaught\b/i,
      /\bhanded down\b/i,
    ];
    for (const journey of JOURNEYS) {
      for (const step of journey.steps) {
        for (const pattern of banned) {
          expect(step.body, `${journey.slug}/${step.id}`).not.toMatch(pattern);
        }
      }
    }
  });

  it('only ask for modes that exist', () => {
    for (const journey of JOURNEYS) {
      for (const step of journey.steps) {
        if (step.question) expect(QUIZ_MODES).toContain(step.question.mode);
      }
    }
  });

  it('can be found by slug, and not by a slug that is not one', () => {
    expect(journeyBySlug('adam-to-noah')?.title).toBe('Adam to Noah');
    expect(journeyBySlug('nowhere')).toBeNull();
  });
});

describe('building a step', () => {
  const dataset = quizFixture();

  it('reads the dates from the engine rather than from the step', () => {
    const step = buildStep(dataset, {
      id: 'test',
      title: 'Test',
      body: 'Test',
      personIds: ['alpha', 'bravo'],
      eventIds: [],
    });
    expect(step.people.map((person) => person.birthYear)).toEqual([0, 100]);
    expect(step.people.every((person) => person.undated)).toBe(false);
  });

  it('says so when the chronology cannot place someone', () => {
    const step = buildStep(dataset, {
      id: 'test',
      title: 'Test',
      body: 'Test',
      personIds: ['undated', 'nobody-at-all'],
      eventIds: [],
    });
    expect(step.people.map((person) => person.undated)).toEqual([true, true]);
    expect(step.people[0]?.birthYear).toBeNull();
    expect(step.people[1]?.name).toBe('nobody-at-all');
  });

  it('leaves out an event the dataset does not hold', () => {
    const step = buildStep(dataset, {
      id: 'test',
      title: 'Test',
      body: 'Test',
      personIds: ['alpha'],
      eventIds: ['no-such-event'],
    });
    expect(step.events).toEqual([]);
  });

  it('generates the step question, and the same one every time', () => {
    const definition = {
      id: 'test',
      title: 'Test',
      body: 'Test',
      personIds: ['alpha'],
      eventIds: [],
      question: { mode: 'who-lived-longer', seed: 'step' },
    } as const;
    const first = buildStep(dataset, definition);
    expect(first.generatedQuestion).not.toBeNull();
    expect(buildStep(dataset, definition)).toEqual(first);
  });

  it('has no question where the step asks for none', () => {
    const step = buildStep(dataset, {
      id: 'test',
      title: 'Test',
      body: 'Test',
      personIds: ['alpha'],
      eventIds: [],
    });
    expect(step.generatedQuestion).toBeNull();
  });

  it('marks a life whose end is stated but not recorded', () => {
    // Enoch's shape: a span, and no death year to place it against.
    const step = buildStep(fixtureDataset(), {
      id: 'test',
      title: 'Test',
      body: 'Test',
      personIds: ['openended'],
      eventIds: ['mid-event', 'undated-event'],
    });
    expect(step.people[0]?.openEnded).toBe(true);
    expect(step.people[0]?.deathYear).toBeNull();
    expect(step.events.map((event) => event.year)).toEqual([60, null]);
  });

  it('builds a whole journey, step by step', () => {
    const built = buildJourney(dataset, {
      slug: 'test',
      title: 'Test',
      summary: 'Test',
      steps: [
        { id: 'one', title: 'One', body: 'One', personIds: ['alpha'], eventIds: [] },
        { id: 'two', title: 'Two', body: 'Two', personIds: ['bravo'], eventIds: [] },
      ],
    });
    expect(built.steps.map((step) => step.id)).toEqual(['one', 'two']);
    expect(built.steps[0]?.people[0]?.name).toBe('Alpha');
  });

  it('reports the records a journey names that the dataset does not hold', () => {
    expect(
      unknownRecords(fixtureDataset(), {
        slug: 'test',
        title: 'Test',
        summary: 'Test',
        steps: [
          {
            id: 'one',
            title: 'One',
            body: 'One',
            personIds: ['ancestor', 'ghost'],
            eventIds: ['mid-event', 'no-such-event'],
          },
        ],
      }),
    ).toEqual(['ghost', 'no-such-event']);
  });
});

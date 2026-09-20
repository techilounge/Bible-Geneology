import { getPersonTimeline, type Dataset } from '@/lib/chronology';
import { generateQuestion, type Question } from '@/lib/quiz';
import type { Journey, JourneyStep } from './journeys';

/**
 * A journey, filled in from the dataset.
 *
 * The step says who it is about; every figure beside those names is read
 * here, from the engine, at the moment the page renders. A step whose
 * people have no dates says so, which is the honest outcome for most of
 * the women in the account and for all of Jacob's children but one.
 */
export interface StepPerson {
  personId: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  lifespan: number | null;
  /** True when the chronology cannot place this person at all. */
  undated: boolean;
  /** True when a span is stated but no death is recorded, as Enoch's is. */
  openEnded: boolean;
}

export interface StepEvent {
  eventId: string;
  name: string;
  year: number | null;
}

export interface BuiltStep extends JourneyStep {
  people: readonly StepPerson[];
  events: readonly StepEvent[];
  /** Null when the dataset cannot support a question for this step. */
  generatedQuestion: Question | null;
}

export interface BuiltJourney extends Omit<Journey, 'steps'> {
  steps: readonly BuiltStep[];
}

function person(dataset: Dataset, personId: string): StepPerson {
  const name = dataset.people.get(personId)?.canonicalName ?? personId;
  const timeline = getPersonTimeline(dataset, personId);
  if (timeline.status !== 'known') {
    return {
      personId,
      name,
      birthYear: null,
      deathYear: null,
      lifespan: null,
      undated: true,
      openEnded: false,
    };
  }
  return {
    personId,
    name,
    birthYear: timeline.value.birthYear,
    deathYear: timeline.value.deathYear,
    lifespan: timeline.value.lifespan,
    undated: false,
    openEnded: timeline.value.openEnded,
  };
}

function event(dataset: Dataset, eventId: string): StepEvent | null {
  const record = dataset.events.get(eventId);
  if (!record) return null;
  return {
    eventId,
    name: record.name,
    year: dataset.eventChronology.get(eventId)?.startYear ?? null,
  };
}

export function buildStep(dataset: Dataset, step: JourneyStep): BuiltStep {
  return {
    ...step,
    people: step.personIds.map((personId) => person(dataset, personId)),
    events: step.eventIds
      .map((eventId) => event(dataset, eventId))
      .filter((entry): entry is StepEvent => entry !== null),
    generatedQuestion: step.question
      ? generateQuestion(dataset, step.question.mode, step.question.seed)
      : null,
  };
}

export function buildJourney(dataset: Dataset, journey: Journey): BuiltJourney {
  return { ...journey, steps: journey.steps.map((step) => buildStep(dataset, step)) };
}

/**
 * Ids a journey names that the dataset does not hold.
 *
 * A journey is the one place in the product where a person is named by
 * hand, so this is the check that a rename or a removal cannot leave a
 * step pointing at nothing. The golden suite asserts it is empty.
 */
export function unknownRecords(dataset: Dataset, journey: Journey): string[] {
  const missing: string[] = [];
  for (const step of journey.steps) {
    for (const personId of step.personIds) {
      if (!dataset.people.has(personId)) missing.push(personId);
    }
    for (const eventId of step.eventIds) {
      if (!dataset.events.has(eventId)) missing.push(eventId);
    }
  }
  return missing;
}

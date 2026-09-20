import {
  getAgeAtPersonBirth,
  getAgeAtYear,
  getAncestorPath,
  getPeopleAliveAtBirth,
  getPersonTimeline,
  compareLifespans,
  hasDates,
  lookup,
  parentsOf,
  type Dataset,
} from '@/lib/chronology';
import type { Question } from './types';

/**
 * Marking a question, from the engine, without trusting the generator.
 *
 * This is the Phase 12 exit gate. Every mode is marked through a different
 * engine function than the one that produced it: "who lived longer" is
 * built from the lifespan figures on the records and marked with
 * `compareLifespans`; "could their lifetimes overlap" is built with
 * `getLifetimeOverlap` and marked by asking whether the earlier-born was
 * still alive at the later one's birth. A validator that re-ran the
 * generator's own call would agree with it always, including when both
 * were wrong.
 *
 * `confirmedWrong` matters as much as the answer. A distractor that is
 * also correct is the failure a single-answer check cannot see, so every
 * mode that can rule its distractors out does, and a question whose
 * distractors cannot be ruled out is dropped rather than shown.
 */
export interface Marking {
  answerIds: string[];
  confirmedWrong: string[];
}

function alive(dataset: Dataset, personId: string, year: number): boolean | null {
  const record = lookup(dataset, personId);
  // Without a recorded death, "not yet dead" is not something the
  // chronology can assert, so the option cannot be marked either way.
  if (!hasDates(record)) return null;
  const age = getAgeAtYear(dataset, personId, year);
  if (age.status !== 'known') return false;
  return !age.value.posthumous;
}

function split(
  optionIds: readonly string[],
  isCorrect: (id: string) => boolean | null,
): Marking | null {
  const answerIds: string[] = [];
  const confirmedWrong: string[] = [];
  for (const id of optionIds) {
    const verdict = isCorrect(id);
    if (verdict === null) return null;
    if (verdict) answerIds.push(id);
    else confirmedWrong.push(id);
  }
  return { answerIds, confirmedWrong };
}

function birthOrder(dataset: Dataset, optionIds: readonly string[]): string[] | null {
  // Ordered by asking how old each was when the other was born, rather than
  // by reading the birth years the generator used.
  const earlier = (x: string, y: string): boolean | null => {
    const xAtY = getAgeAtPersonBirth(dataset, x, y);
    if (xAtY.status === 'known' && xAtY.value.years > 0) return true;
    const yAtX = getAgeAtPersonBirth(dataset, y, x);
    if (yAtX.status === 'known' && yAtX.value.years > 0) return false;
    return null;
  };

  const ordered: string[] = [];
  for (const id of optionIds) {
    let index = 0;
    while (index < ordered.length) {
      const seated = ordered[index] as string;
      const verdict = earlier(id, seated);
      if (verdict === null) return null;
      if (verdict) break;
      index += 1;
    }
    ordered.splice(index, 0, id);
  }
  return ordered;
}

export function markFromEngine(dataset: Dataset, question: Question): Marking | null {
  const optionIds = question.options.map((option) => option.id);
  const check = question.check;

  switch (check.kind) {
    case 'longer-lifespan': {
      const comparison = compareLifespans(dataset, check.personAId, check.personBId);
      if (comparison.status !== 'known') return null;
      const longer = comparison.value.longerPersonId;
      if (longer === null) return null;
      return split(optionIds, (id) => id === longer);
    }

    case 'alive-at-birth': {
      const living = getPeopleAliveAtBirth(dataset, check.otherPersonId);
      if (living.status !== 'known') return null;
      const shared = living.value.some((person) => person.personId === check.personId);
      return split(optionIds, (id) => (shared ? id === 'yes' : id === 'no'));
    }

    case 'alive-in-year':
      return split(optionIds, (id) => alive(dataset, id, check.year));

    case 'birth-order': {
      const ordered = birthOrder(dataset, optionIds);
      if (ordered === null) return null;
      return { answerIds: ordered, confirmedWrong: [] };
    }

    case 'age-at-other-birth': {
      const living = getPeopleAliveAtBirth(dataset, check.otherPersonId);
      if (living.status !== 'known') return null;
      const entry = living.value.find((person) => person.personId === check.personId);
      if (entry === undefined) return null;
      return split(optionIds, (id) => id === `${entry.age}`);
    }

    case 'ancestor-of':
      return split(
        optionIds,
        (id) => getAncestorPath(dataset.relationships, check.personId, id) !== null,
      );

    case 'born-in-year':
      return split(optionIds, (id) => {
        const year = Number(id);
        if (!Number.isInteger(year)) return null;
        const age = getAgeAtYear(dataset, check.personId, year);
        return age.status === 'known' && !age.value.posthumous && age.value.years === 0;
      });

    case 'identified-by': {
      const matches = [...dataset.chronology.keys()].filter((personId) => {
        const timeline = getPersonTimeline(dataset, personId);
        return (
          timeline.status === 'known' &&
          timeline.value.lifespan === check.lifespan &&
          parentsOf(dataset.relationships, personId).includes(check.parentId)
        );
      });
      // Two people answering the same clues is not a question, whichever
      // one the generator had in mind.
      if (matches.length !== 1) return null;
      const answer = matches[0] as string;
      return split(optionIds, (id) => id === answer);
    }
  }
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

/**
 * True when the engine agrees with the question: the same answer, and —
 * for the modes where it applies — every other option ruled out.
 */
export function validateQuestion(dataset: Dataset, question: Question): boolean {
  const marking = markFromEngine(dataset, question);
  if (marking === null) return false;

  const answersAgree = question.ordered
    ? sameSequence(marking.answerIds, question.answerIds)
    : sameSet(marking.answerIds, question.answerIds);
  if (!answersAgree) return false;

  if (question.ordered) return true;

  const optionIds = question.options.map((option) => option.id);
  return optionIds.every(
    (id) => question.answerIds.includes(id) || marking.confirmedWrong.includes(id),
  );
}

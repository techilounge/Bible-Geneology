import {
  ancestorsOf,
  compareReferences,
  datedPeople,
  getAgeAtPersonBirth,
  getAncestorPath,
  getLifetimeOverlap,
  getPeopleAliveAtYear,
  parentsOf,
  referencesFor,
  type Dataset,
} from '@/lib/chronology';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import { datedPopulation } from '@/lib/discovery';
import type { Random } from './random';
import type { Question, QuizMode, QuizOption } from './types';

/**
 * One generator per mode in requirement section 37.
 *
 * Each of them picks records with the seeded random, reads what the
 * chronology says about them, and writes the question from that. None of
 * them writes an answer: the answer is whatever the records say, and
 * `validate.ts` confirms it by asking the engine again through a different
 * function before the question is ever shown.
 *
 * A generator returns null when the dataset cannot support the question —
 * too few dated people, nobody with a recorded parent, no distractor that
 * is confirmably wrong. Returning a question anyway, with a plausible
 * answer, is the failure this whole phase is arranged to prevent.
 */
export interface GeneratorContext {
  dataset: Dataset;
  random: Random;
  seed: string;
}

export type QuestionGenerator = (context: GeneratorContext) => Question | null;

function nameOf(dataset: Dataset, personId: string): string {
  /* v8 ignore next -- @preserve: every id here came out of the dataset. */
  return dataset.people.get(personId)?.canonicalName ?? personId;
}

function epochYear(value: number): string {
  return `${value} ${EPOCH_LABEL}`;
}

/** The people this chronology gives both a birth and a death, in a stable order. */
function dated(dataset: Dataset) {
  return datedPeople(dataset).sort((a, b) => a.personId.localeCompare(b.personId));
}

/**
 * People as answer options, or null when two of them share a name.
 *
 * The dataset holds two men called Nahor, and a question offering "Nahor"
 * twice has no right answer even when the engine can name one. Dropping
 * the question is the only honest move; renaming them on the fly would
 * put a label on a person that no record gives.
 */
function personOptions(
  dataset: Dataset,
  personIds: readonly string[],
): QuizOption[] | null {
  const options = personIds.map((personId) => ({
    id: personId,
    label: nameOf(dataset, personId),
  }));
  const labels = new Set(options.map((option) => option.label));
  return labels.size === options.length ? options : null;
}

/**
 * The references behind a line of descent: every parent row on the path,
 * in reading order.
 *
 * A question about ancestry rests on the relationship records, not on the
 * chronology, and most of the people it can ask about have no dated
 * record at all. Citing their chronology would cite nothing.
 */
function descentReferences(dataset: Dataset, path: readonly string[]): string[] {
  const refs = new Set<string>();
  for (let index = 0; index + 1 < path.length; index += 1) {
    const descendant = path[index] as string;
    const ancestor = path[index + 1] as string;
    for (const row of dataset.relationships) {
      if (
        row.relationshipType === 'parent' &&
        row.sourcePersonId === ancestor &&
        row.targetPersonId === descendant
      ) {
        for (const reference of row.sourceReferences) refs.add(reference);
      }
    }
  }
  return [...refs].sort(compareReferences);
}

function base(
  context: GeneratorContext,
  mode: QuizMode,
  personIds: readonly string[],
): Pick<
  Question,
  'id' | 'mode' | 'chronologyId' | 'population' | 'personIds' | 'sourceReferences'
> {
  return {
    id: `${mode}-${context.seed}`,
    mode,
    chronologyId: context.dataset.chronologyId,
    population: datedPopulation(context.dataset),
    personIds,
    sourceReferences: referencesFor(context.dataset, personIds),
  };
}

// --- who lived longer ----------------------------------------------------

const whoLivedLonger: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const pool = dated(dataset).filter(
    (record): record is typeof record & { lifespan: number } => record.lifespan !== null,
  );
  const pair = random.sample(pool, 2);
  const [a, b] = pair;
  if (!a || !b || a.lifespan === b.lifespan) return null;

  const longer = a.lifespan > b.lifespan ? a : b;
  const shorter = longer === a ? b : a;

  const options = personOptions(dataset, random.shuffle([a.personId, b.personId]));
  if (options === null) return null;

  return {
    ...base(context, 'who-lived-longer', [a.personId, b.personId]),
    prompt: `Who lived longer, ${nameOf(dataset, a.personId)} or ${nameOf(dataset, b.personId)}?`,
    options,
    answerIds: [longer.personId],
    ordered: false,
    explanation:
      `${nameOf(dataset, longer.personId)} lived ${longer.lifespan} years and ` +
      `${nameOf(dataset, shorter.personId)} lived ${shorter.lifespan}, a difference of ` +
      `${longer.lifespan - shorter.lifespan} years.`,
    working: [
      { label: nameOf(dataset, a.personId), value: `${a.lifespan} years` },
      { label: nameOf(dataset, b.personId), value: `${b.lifespan} years` },
    ],
    check: { kind: 'longer-lifespan', personAId: a.personId, personBId: b.personId },
    aboutOverlap: false,
  };
};

// --- could their lifetimes overlap ---------------------------------------

const couldLifetimesOverlap: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const pair = random.sample(dated(dataset), 2);
  const [a, b] = pair;
  if (!a || !b) return null;

  const overlap = getLifetimeOverlap(dataset, a.personId, b.personId);
  /* v8 ignore next -- @preserve: both were drawn from the dated population. */
  if (overlap.status !== 'known') return null;

  // The check asks whether the earlier-born was still alive when the later
  // one was born, which is the same question by a different route.
  const earlier = a.birthYear <= b.birthYear ? a : b;
  const later = earlier === a ? b : a;

  const shared = overlap.value;
  const window =
    shared.overlapStart === null || shared.overlapEnd === null
      ? null
      : `${epochYear(shared.overlapStart)} to ${epochYear(shared.overlapEnd)}`;
  const answer = shared.overlaps ? 'yes' : 'no';
  return {
    ...base(context, 'could-lifetimes-overlap', [a.personId, b.personId]),
    prompt:
      `Did the lifetimes of ${nameOf(dataset, a.personId)} and ` +
      `${nameOf(dataset, b.personId)} share any years in this chronology?`,
    options: [
      { id: 'yes', label: 'Yes, they shared years' },
      { id: 'no', label: 'No, they never did' },
    ],
    answerIds: [answer],
    ordered: false,
    explanation:
      window === null
        ? `${nameOf(dataset, later.personId)} was born ${shared.gapYears} years after ` +
          `${nameOf(dataset, earlier.personId)} died, so this chronology places them in ` +
          `different years entirely.`
        : `${nameOf(dataset, a.personId)} and ${nameOf(dataset, b.personId)} were both alive ` +
          `for ${shared.years} years, ${window}. Sharing years is not evidence that the two ` +
          `ever met.`,
    working: [
      {
        label: nameOf(dataset, a.personId),
        value: `${epochYear(a.birthYear)} to ${epochYear(a.deathYear)}`,
      },
      {
        label: nameOf(dataset, b.personId),
        value: `${epochYear(b.birthYear)} to ${epochYear(b.deathYear)}`,
      },
      {
        label: 'Shared years',
        value: `${shared.years}`,
      },
    ],
    check: {
      kind: 'alive-at-birth',
      personId: earlier.personId,
      otherPersonId: later.personId,
    },
    aboutOverlap: true,
  };
};

// --- who was alive -------------------------------------------------------

const whoWasAlive: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const pool = dated(dataset);
  const subject = random.pick(pool);
  if (!subject) return null;

  // A year inside somebody's life, so the question always has an answer.
  const year = subject.birthYear + random.next(subject.deathYear - subject.birthYear);
  const aliveIds = new Set(
    getPeopleAliveAtYear(dataset, year).map((person) => person.personId),
  );

  const living = pool.filter((record) => aliveIds.has(record.personId));
  const notLiving = pool.filter((record) => !aliveIds.has(record.personId));
  const answer = random.pick(living);
  const distractors = random.sample(notLiving, 3);
  if (!answer || distractors.length < 3) return null;

  const ids = random.shuffle([answer.personId, ...distractors.map((r) => r.personId)]);
  const options = personOptions(dataset, ids);
  if (options === null) return null;

  return {
    ...base(context, 'who-was-alive', ids),
    prompt: `Which of these people was alive in ${epochYear(year)}?`,
    options,
    answerIds: [answer.personId],
    ordered: false,
    explanation:
      `${nameOf(dataset, answer.personId)} lived from ${epochYear(answer.birthYear)} to ` +
      `${epochYear(answer.deathYear)}, so ${epochYear(year)} falls inside that. The others ` +
      `had either not been born or had already died.`,
    working: [
      { label: 'Year', value: epochYear(year) },
      ...ids.map((personId) => {
        const record = pool.find((candidate) => candidate.personId === personId);
        /* v8 ignore next -- @preserve: every id here came from the pool. */
        if (!record) return { label: nameOf(dataset, personId), value: 'Unknown' };
        return {
          label: nameOf(dataset, personId),
          value: `${epochYear(record.birthYear)} to ${epochYear(record.deathYear)}`,
        };
      }),
    ],
    check: { kind: 'alive-in-year', year },
    aboutOverlap: false,
  };
};

// --- put them in order ---------------------------------------------------

const putThemInOrder: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const chosen = random.sample(dated(dataset), 3);
  if (chosen.length < 3) return null;

  const years = new Set(chosen.map((record) => record.birthYear));
  if (years.size < chosen.length) return null;

  const order = [...chosen].sort((a, b) => a.birthYear - b.birthYear);
  const ids = order.map((record) => record.personId);

  const options = personOptions(dataset, random.shuffle(ids));
  if (options === null) return null;

  return {
    ...base(context, 'put-them-in-order', ids),
    prompt: 'Put these three in the order they were born, earliest first.',
    options,
    answerIds: ids,
    ordered: true,
    explanation: `${order
      .map(
        (record) =>
          `${nameOf(dataset, record.personId)} was born in ${epochYear(record.birthYear)}`,
      )
      .join(', then ')}.`,
    working: order.map((record) => ({
      label: nameOf(dataset, record.personId),
      value: `Born ${epochYear(record.birthYear)}`,
    })),
    check: { kind: 'birth-order' },
    aboutOverlap: false,
  };
};

// --- guess the age -------------------------------------------------------

const guessTheAge: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const pool = dated(dataset);
  const subject = random.pick(pool);
  if (!subject) return null;

  const born = pool.filter(
    (record) =>
      record.personId !== subject.personId &&
      record.birthYear > subject.birthYear &&
      record.birthYear < subject.deathYear,
  );
  const other = random.pick(born);
  if (!other) return null;

  const age = getAgeAtPersonBirth(dataset, subject.personId, other.personId);
  /* v8 ignore next -- @preserve: the other was born inside the subject's life. */
  if (age.status !== 'known' || age.value.posthumous) return null;

  const correct = age.value.years;
  const wrong = new Set<number>();
  for (let attempt = 0; attempt < 24 && wrong.size < 3; attempt += 1) {
    const offset = 1 + random.next(120);
    const candidate = random.next(2) === 0 ? correct + offset : correct - offset;
    if (candidate >= 0 && candidate !== correct) wrong.add(candidate);
  }
  /* v8 ignore next -- @preserve: twenty-four draws over a range this wide always find three. */
  if (wrong.size < 3) return null;

  const options = random
    .shuffle([correct, ...wrong])
    .map((value) => ({ id: `${value}`, label: `${value} years` }));

  return {
    ...base(context, 'guess-the-age', [subject.personId, other.personId]),
    prompt: `How old was ${nameOf(dataset, subject.personId)} when ${nameOf(dataset, other.personId)} was born?`,
    options,
    answerIds: [`${correct}`],
    ordered: false,
    explanation:
      `${nameOf(dataset, subject.personId)} was born in ${epochYear(subject.birthYear)} and ` +
      `${nameOf(dataset, other.personId)} in ${epochYear(other.birthYear)}, which leaves an ` +
      `age of ${correct} at that birth.`,
    working: [
      {
        label: `${nameOf(dataset, subject.personId)} born`,
        value: epochYear(subject.birthYear),
      },
      {
        label: `${nameOf(dataset, other.personId)} born`,
        value: epochYear(other.birthYear),
      },
      { label: 'Age at that year', value: `${correct}` },
    ],
    check: {
      kind: 'age-at-other-birth',
      personId: subject.personId,
      otherPersonId: other.personId,
    },
    aboutOverlap: false,
  };
};

// --- family connection ---------------------------------------------------

const familyConnection: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const everyone = [...dataset.people.keys()].sort((a, b) => a.localeCompare(b));
  const subject = random.pick(
    everyone.filter((personId) => ancestorsOf(dataset.relationships, personId).size > 0),
  );
  if (!subject) return null;

  const ancestors = ancestorsOf(dataset.relationships, subject);
  const answer = random.pick([...ancestors].sort((a, b) => a.localeCompare(b)));
  const others = everyone.filter(
    (personId) => personId !== subject && !ancestors.has(personId),
  );
  const distractors = random.sample(others, 3);
  if (!answer || distractors.length < 3) return null;

  const ids = random.shuffle([answer, ...distractors]);
  const options = personOptions(dataset, ids);
  if (options === null) return null;

  /* v8 ignore next -- @preserve: the answer was drawn from this person's ancestors. */
  const path = getAncestorPath(dataset.relationships, subject, answer) ?? [];
  const cited = descentReferences(dataset, path);
  if (cited.length === 0) return null;

  return {
    ...base(context, 'family-connection', [subject, ...ids]),
    sourceReferences: cited,
    prompt: `Which of these is an ancestor of ${nameOf(dataset, subject)}?`,
    options,
    answerIds: [answer],
    ordered: false,
    explanation:
      `The recorded parent lines run from ${nameOf(dataset, answer)} down to ` +
      `${nameOf(dataset, subject)}. The others are in the dataset but not on that line.`,
    working: [
      { label: 'Person', value: nameOf(dataset, subject) },
      { label: 'Recorded ancestors', value: `${ancestors.size}` },
    ],
    check: { kind: 'ancestor-of', personId: subject },
    aboutOverlap: false,
  };
};

// --- timeline placement --------------------------------------------------

const timelinePlacement: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const subject = random.pick(dated(dataset));
  if (!subject) return null;

  const correct = subject.birthYear;
  const wrong = new Set<number>();
  for (let attempt = 0; attempt < 24 && wrong.size < 3; attempt += 1) {
    const offset = 5 + random.next(400);
    const candidate = random.next(2) === 0 ? correct + offset : correct - offset;
    if (candidate >= 0 && candidate !== correct) wrong.add(candidate);
  }
  /* v8 ignore next -- @preserve: twenty-four draws over a range this wide always find three. */
  if (wrong.size < 3) return null;

  const options = random
    .shuffle([correct, ...wrong])
    .map((value) => ({ id: `${value}`, label: epochYear(value) }));

  return {
    ...base(context, 'timeline-placement', [subject.personId]),
    prompt: `In which year does this chronology place the birth of ${nameOf(dataset, subject.personId)}?`,
    options,
    answerIds: [`${correct}`],
    ordered: false,
    explanation:
      `This chronology places the birth of ${nameOf(dataset, subject.personId)} at ` +
      `${epochYear(correct)} and the death at ${epochYear(subject.deathYear)}. The working ` +
      `behind those years is on the person's page.`,
    working: [
      { label: 'Born', value: epochYear(correct) },
      { label: 'Died', value: epochYear(subject.deathYear) },
    ],
    check: { kind: 'born-in-year', personId: subject.personId },
    aboutOverlap: false,
  };
};

// --- who am I ------------------------------------------------------------

const whoAmI: QuestionGenerator = (context) => {
  const { dataset, random } = context;
  const candidates = dated(dataset).filter(
    (record): record is typeof record & { lifespan: number } =>
      record.lifespan !== null &&
      parentsOf(dataset.relationships, record.personId).length > 0,
  );
  const subject = random.pick(candidates);
  if (!subject) return null;

  const parent = parentsOf(dataset.relationships, subject.personId).sort((a, b) =>
    a.localeCompare(b),
  )[0];
  /* v8 ignore next -- @preserve: the candidates all have a recorded parent. */
  if (parent === undefined) return null;

  const others = candidates.filter((record) => record.personId !== subject.personId);
  const distractors = random.sample(others, 3);
  if (distractors.length < 3) return null;

  const ids = random.shuffle([
    subject.personId,
    ...distractors.map((record) => record.personId),
  ]);
  const options = personOptions(dataset, ids);
  if (options === null) return null;

  return {
    ...base(context, 'who-am-i', ids),
    prompt:
      `Who am I? This chronology gives me a lifespan of ${subject.lifespan} years, and ` +
      `the records name ${nameOf(dataset, parent)} as my parent.`,
    options,
    answerIds: [subject.personId],
    ordered: false,
    explanation:
      `${nameOf(dataset, subject.personId)} is the only person in the dataset with both a ` +
      `lifespan of ${subject.lifespan} years and ${nameOf(dataset, parent)} as a parent.`,
    working: [
      { label: 'Lifespan', value: `${subject.lifespan} years` },
      { label: 'Parent', value: nameOf(dataset, parent) },
    ],
    check: { kind: 'identified-by', lifespan: subject.lifespan, parentId: parent },
    aboutOverlap: false,
  };
};

export const GENERATORS: Readonly<Record<QuizMode, QuestionGenerator>> = {
  'who-lived-longer': whoLivedLonger,
  'could-lifetimes-overlap': couldLifetimesOverlap,
  'who-was-alive': whoWasAlive,
  'put-them-in-order': putThemInOrder,
  'guess-the-age': guessTheAge,
  'family-connection': familyConnection,
  'timeline-placement': timelinePlacement,
  'who-am-i': whoAmI,
};

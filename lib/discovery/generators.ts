import {
  datedPeople,
  getEventsDuringLifetime,
  getLifetimeOverlap,
  getLivingAncestorsAtYear,
  getLivingDescendantsAtYear,
  getMaximumConcurrentGenerations,
  getOverlapChain,
  getGenerationDistance,
  referencesFor,
  buildOverlapGraph,
  descendantsOf,
  type Dataset,
} from '@/lib/chronology';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { Discovery, DiscoveryStep } from './types';

/**
 * One generator per finding in requirement section 34.
 *
 * Every one of them reads the chronology engine and nothing else. None
 * contains a name, a year, or a claim: the sentence is a template and the
 * data fills it, so a discovery cannot survive the data that produced it.
 *
 * All of them are deterministic. Where several results tie, the tie is
 * broken by person id, so running the generator twice over the same dataset
 * produces the same discoveries in the same order — which is the Phase 11
 * exit gate.
 */
type Generator = (dataset: Dataset) => Discovery[];

function nameOf(dataset: Dataset, personId: string): string {
  /* v8 ignore next -- @preserve: every id here came out of the dataset. */
  return dataset.people.get(personId)?.canonicalName ?? personId;
}

function year(value: number): string {
  return `${value} ${EPOCH_LABEL}`;
}

/** The people this chronology can place on a timeline, in a stable order. */
function dated(dataset: Dataset) {
  return datedPeople(dataset)
    .slice()
    .sort((a, b) => a.personId.localeCompare(b.personId));
}

/**
 * A superlative needs to say what it is a superlative of. Most of the
 * dataset has no dates at all, so "the longest lifespan" is a fact about
 * the people this chronology can place, not about Scripture.
 */
/**
 * The subset a finding ranged over, in words.
 *
 * Exported because the quiz asks questions over the same subset, and two
 * surfaces describing the same population differently would be worse than
 * either description alone.
 */
export function datedPopulation(dataset: Dataset): string {
  const total = dataset.people.size;
  const placed = dated(dataset).length;
  return `the ${placed} of ${total} people this chronology gives both a birth and a death`;
}

// --- lifespan records ----------------------------------------------------

const lifespanRecords: Generator = (dataset) => {
  const withLifespan = dated(dataset).filter(
    (record): record is typeof record & { lifespan: number } => record.lifespan !== null,
  );
  if (withLifespan.length === 0) return [];

  const longest = withLifespan.reduce((best, record) =>
    record.lifespan > best.lifespan ? record : best,
  );
  const shortest = withLifespan.reduce((best, record) =>
    record.lifespan < best.lifespan ? record : best,
  );

  // Everyone in this population has a recorded death, because that is what
  // `dated` means. Enoch, whose span is stated and whose death is not
  // recorded, is not here at all — which is why the population is named on
  // every finding rather than left implied.
  const record = (
    subject: (typeof withLifespan)[number],
    kind: 'longest-lifespan' | 'shortest-lifespan',
  ): Discovery => ({
    id: `${kind}-${subject.personId}`,
    kind,
    chronologyId: dataset.chronologyId,
    headline:
      `${nameOf(dataset, subject.personId)} has the ` +
      `${kind === 'longest-lifespan' ? 'longest' : 'shortest'} lifespan in this ` +
      `dataset, at ${subject.lifespan} years.`,
    population: datedPopulation(dataset),
    personIds: [subject.personId],
    eventIds: [],
    calculation: [
      { label: 'Lifespan', value: `${subject.lifespan} years` },
      { label: 'Born', value: year(subject.birthYear) },
      { label: 'Died', value: year(subject.deathYear) },
    ],
    sourceReferences: referencesFor(dataset, [subject.personId]),
    aboutOverlap: false,
  });

  return longest.personId === shortest.personId
    ? [record(longest, 'longest-lifespan')]
    : [record(longest, 'longest-lifespan'), record(shortest, 'shortest-lifespan')];
};

// --- overlaps ------------------------------------------------------------

interface Pair {
  a: string;
  b: string;
  years: number;
  start: number;
  end: number;
}

function overlappingPairs(dataset: Dataset): Pair[] {
  const ids = dated(dataset).map((record) => record.personId);
  const pairs: Pair[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = ids[i];
      const b = ids[j];
      /* v8 ignore next -- @preserve: both indices are inside the array. */
      if (a === undefined || b === undefined) continue;
      const result = getLifetimeOverlap(dataset, a, b);
      if (result.status !== 'known' || !result.value.overlaps) continue;
      pairs.push({
        a,
        b,
        years: result.value.years,
        // An overlap that overlaps has both ends; the fallbacks satisfy the
        // type and cannot be reached.
        /* v8 ignore next */
        start: result.value.overlapStart ?? 0,
        /* v8 ignore next */
        end: result.value.overlapEnd ?? 0,
      });
    }
  }
  return pairs.sort(
    (x, y) => y.years - x.years || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
  );
}

function overlapDiscovery(
  dataset: Dataset,
  pair: Pair,
  kind: Discovery['kind'],
  headline: string,
  extra: readonly DiscoveryStep[] = [],
): Discovery {
  return {
    id: `${kind}-${pair.a}-${pair.b}`,
    kind,
    chronologyId: dataset.chronologyId,
    headline,
    population: datedPopulation(dataset),
    personIds: [pair.a, pair.b],
    eventIds: [],
    calculation: [
      { label: 'Overlap begins', value: year(pair.start) },
      { label: 'Overlap ends', value: year(pair.end) },
      { label: 'Years in common', value: `${pair.years}` },
      ...extra,
    ],
    sourceReferences: referencesFor(dataset, [pair.a, pair.b]),
    aboutOverlap: true,
  };
}

const largestOverlap: Generator = (dataset) => {
  const pair = overlappingPairs(dataset)[0];
  if (!pair) return [];
  return [
    overlapDiscovery(
      dataset,
      pair,
      'largest-overlap',
      `${nameOf(dataset, pair.a)} and ${nameOf(dataset, pair.b)} were alive at the same ` +
        `time for ${pair.years} years, the longest shared span in this dataset.`,
    ),
  ];
};

/**
 * Contemporaries a reader would not expect: two people alive in the same
 * years who are many generations apart. "Unexpected" is defined as a
 * measurement — the generation distance — rather than as an opinion about
 * which pairs are surprising.
 */
const unexpectedContemporaries: Generator = (dataset) => {
  const gap = (pair: Pair): number => {
    const distance = getGenerationDistance(dataset.relationships, pair.a, pair.b);
    return distance === null ? 0 : Math.abs(distance);
  };

  return overlappingPairs(dataset)
    .map((pair) => ({ pair, generations: gap(pair) }))
    .filter((entry) => entry.generations >= 5)
    .sort(
      (x, y) =>
        y.generations - x.generations ||
        y.pair.years - x.pair.years ||
        x.pair.a.localeCompare(y.pair.a),
    )
    .slice(0, 3)
    .map(({ pair, generations }) =>
      overlapDiscovery(
        dataset,
        pair,
        'unexpected-contemporaries',
        `${nameOf(dataset, pair.a)} and ${nameOf(dataset, pair.b)} are ${generations} ` +
          `generations apart and were still alive in the same years, ${pair.years} of them.`,
        [{ label: 'Generations apart', value: `${generations}` }],
      ),
    );
};

// --- family, at a moment -------------------------------------------------

const livingAncestorsAtBirth: Generator = (dataset) => {
  const best = dated(dataset)
    .map((record) => {
      const result = getLivingAncestorsAtYear(dataset, record.personId, record.birthYear);
      return {
        personId: record.personId,
        birthYear: record.birthYear,
        /* v8 ignore next -- @preserve: the population is dated, so the result is known. */
        living: result.status === 'known' ? result.value : [],
      };
    })
    .sort(
      (a, b) => b.living.length - a.living.length || a.personId.localeCompare(b.personId),
    )[0];

  if (!best || best.living.length === 0) return [];
  const names = best.living
    .map((person) => nameOf(dataset, person.personId))
    .sort((a, b) => a.localeCompare(b));

  return [
    {
      id: `living-ancestors-at-birth-${best.personId}`,
      kind: 'living-ancestors-at-birth',
      chronologyId: dataset.chronologyId,
      headline:
        `${nameOf(dataset, best.personId)} was born with ${best.living.length} ancestors ` +
        `still alive, more than anyone else in this dataset.`,
      population: datedPopulation(dataset),
      personIds: [best.personId, ...best.living.map((person) => person.personId)],
      eventIds: [],
      calculation: [
        { label: 'Born', value: year(best.birthYear) },
        { label: 'Ancestors alive', value: names.join(', ') },
      ],
      sourceReferences: referencesFor(dataset, [
        best.personId,
        ...best.living.map((person) => person.personId),
      ]),
      aboutOverlap: true,
    },
  ];
};

const livingDescendantsAtDeath: Generator = (dataset) => {
  const best = dated(dataset)
    .map((record) => {
      const result = getLivingDescendantsAtYear(
        dataset,
        record.personId,
        record.deathYear,
      );
      return {
        personId: record.personId,
        deathYear: record.deathYear,
        /* v8 ignore next -- @preserve: the population is dated, so the result is known. */
        living: result.status === 'known' ? result.value : [],
      };
    })
    .sort(
      (a, b) => b.living.length - a.living.length || a.personId.localeCompare(b.personId),
    )[0];

  if (!best || best.living.length === 0) return [];

  return [
    {
      id: `living-descendants-at-death-${best.personId}`,
      kind: 'living-descendants-at-death',
      chronologyId: dataset.chronologyId,
      headline:
        `${nameOf(dataset, best.personId)} died with ${best.living.length} descendants ` +
        `still alive, more than anyone else in this dataset.`,
      population: datedPopulation(dataset),
      personIds: [best.personId, ...best.living.map((person) => person.personId)],
      eventIds: [],
      calculation: [
        { label: 'Died', value: year(best.deathYear) },
        { label: 'Descendants alive', value: `${best.living.length}` },
      ],
      sourceReferences: referencesFor(dataset, [best.personId]),
      aboutOverlap: true,
    },
  ];
};

const mostConcurrentGenerations: Generator = (dataset) => {
  const result = getMaximumConcurrentGenerations(dataset);
  if (result.status !== 'known') return [];
  const { year: at, generations, personIds } = result.value;

  return [
    {
      id: `most-concurrent-generations-${at}`,
      kind: 'most-concurrent-generations',
      chronologyId: dataset.chronologyId,
      headline:
        `In ${year(at)}, ${generations} generations of this family were alive at once, ` +
        `${personIds.length} people in all.`,
      population: datedPopulation(dataset),
      personIds: [...personIds].sort((a, b) => a.localeCompare(b)),
      eventIds: [],
      calculation: [
        { label: 'Year', value: year(at) },
        { label: 'Generations alive', value: `${generations}` },
        { label: 'People alive', value: `${personIds.length}` },
      ],
      sourceReferences: referencesFor(dataset, personIds),
      aboutOverlap: true,
    },
  ];
};

/**
 * Someone who was still alive when one of their own descendants died.
 *
 * Long lifespans early in Genesis make this ordinary rather than tragic, and
 * the sentence says only what the years say.
 */
const outlivedADescendant: Generator = (dataset) => {
  const found: { discovery: Discovery; gap: number }[] = [];

  for (const record of dated(dataset)) {
    const descendantIds = [...descendantsOf(dataset.relationships, record.personId)].sort(
      (a, b) => a.localeCompare(b),
    );
    for (const descendantId of descendantIds) {
      const descendant = dataset.chronology.get(descendantId);
      if (!descendant || descendant.deathYear === null) continue;
      if (descendant.deathYear >= record.deathYear) continue;
      const gap = record.deathYear - descendant.deathYear;
      found.push({
        gap,
        discovery: {
          id: `outlived-a-descendant-${record.personId}-${descendantId}`,
          kind: 'outlived-a-descendant',
          chronologyId: dataset.chronologyId,
          headline:
            `${nameOf(dataset, record.personId)} outlived a descendant: ` +
            `${nameOf(dataset, descendantId)} died ${gap} years first.`,
          population: datedPopulation(dataset),
          personIds: [record.personId, descendantId],
          eventIds: [],
          calculation: [
            {
              label: `${nameOf(dataset, descendantId)} died`,
              value: year(descendant.deathYear),
            },
            {
              label: `${nameOf(dataset, record.personId)} died`,
              value: year(record.deathYear),
            },
            { label: 'Years between', value: `${gap}` },
          ],
          sourceReferences: referencesFor(dataset, [record.personId, descendantId]),
          aboutOverlap: false,
        },
      });
    }
  }

  // Longest gap first, and nobody appears twice. Without that, one
  // long-lived ancestor or one short-lived descendant fills the list and
  // the findings read as a fact about that person rather than about the
  // shape of these generations.
  const seen = new Set<string>();
  return found
    .sort((a, b) => b.gap - a.gap || a.discovery.id.localeCompare(b.discovery.id))
    .map((entry) => entry.discovery)
    .filter((discovery) => {
      if (discovery.personIds.some((personId) => seen.has(personId))) return false;
      for (const personId of discovery.personIds) seen.add(personId);
      return true;
    })
    .slice(0, 3);
};

// --- events --------------------------------------------------------------

const eventsDuringALifetime: Generator = (dataset) => {
  const counted = dated(dataset)
    .map((record) => {
      const result = getEventsDuringLifetime(dataset, record.personId);
      return {
        personId: record.personId,
        /* v8 ignore next -- @preserve: the population is dated, so the result is known. */
        events: result.status === 'known' ? result.value : [],
      };
    })
    .filter((entry) => entry.events.length > 0)
    .sort(
      (a, b) => b.events.length - a.events.length || a.personId.localeCompare(b.personId),
    );

  const best = counted[0];
  if (!best) return [];
  const shared = counted.filter(
    (entry) => entry.events.length === best.events.length,
  ).length;

  return [
    {
      id: `events-during-a-lifetime-${best.personId}`,
      kind: 'events-during-a-lifetime',
      chronologyId: dataset.chronologyId,
      headline:
        `${best.events.length} of the dated events in this chronology fall inside ` +
        `${nameOf(dataset, best.personId)}'s lifetime, ` +
        `${shared > 1 ? 'as many as anyone else\u2019s' : 'more than anyone else\u2019s'}.`,
      population: datedPopulation(dataset),
      personIds: [best.personId],
      eventIds: best.events.map((event) => event.eventId),
      calculation: best.events.map((event) => ({
        /* v8 ignore next -- @preserve: the id came from the same dataset. */
        label: dataset.events.get(event.eventId)?.name ?? event.eventId,
        value: `${year(event.startYear)}, at age ${event.ageAtEvent}`,
      })),
      sourceReferences: referencesFor(dataset, [best.personId]),
      aboutOverlap: false,
    },
  ];
};

// --- the connection chain ------------------------------------------------

/**
 * The shortest chain of overlapping lifetimes between the two dated people
 * furthest apart in generations.
 *
 * Requirement section 20 names what this is and what it is not: a lifetime
 * connection, never a route anything travelled. The sentence says only that
 * each step is two lifetimes that overlapped.
 */
const shortestConnectionChain: Generator = (dataset) => {
  const ids = dated(dataset).map((record) => record.personId);
  const graph = buildOverlapGraph(dataset.chronology.values());

  let furthest: { a: string; b: string; generations: number } | null = null;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = ids[i];
      const b = ids[j];
      /* v8 ignore next -- @preserve: both indices are inside the array. */
      if (a === undefined || b === undefined) continue;
      const distance = getGenerationDistance(dataset.relationships, a, b);
      if (distance === null) continue;
      const generations = Math.abs(distance);
      if (furthest === null || generations > furthest.generations) {
        furthest = { a, b, generations };
      }
    }
  }
  if (furthest === null) return [];

  const chain = getOverlapChain(graph, furthest.a, furthest.b);
  /* v8 ignore next -- @preserve: the two are dated, so the graph connects them. */
  if (chain === null || chain.length < 2) return [];

  const names = chain.map((personId) => nameOf(dataset, personId));

  return [
    {
      id: `shortest-connection-chain-${furthest.a}-${furthest.b}`,
      kind: 'shortest-connection-chain',
      chronologyId: dataset.chronologyId,
      headline:
        `${furthest.generations} generations separate ${nameOf(dataset, furthest.a)} from ` +
        `${nameOf(dataset, furthest.b)}, but only ${chain.length - 2} ` +
        `lifetimes sit between them.`,
      population: datedPopulation(dataset),
      personIds: chain,
      eventIds: [],
      calculation: [
        { label: 'Generations apart', value: `${furthest.generations}` },
        { label: 'Chain', value: names.join(' → ') },
        { label: 'Steps', value: `${chain.length - 1}` },
      ],
      sourceReferences: referencesFor(dataset, chain),
      aboutOverlap: true,
    },
  ];
};

/**
 * The generators, in the order their discoveries are listed.
 *
 * Fixed rather than alphabetical: the list opens on the findings that
 * answer the product's own question, and ends with the records.
 */
export const GENERATORS: readonly Generator[] = [
  largestOverlap,
  unexpectedContemporaries,
  shortestConnectionChain,
  mostConcurrentGenerations,
  livingAncestorsAtBirth,
  livingDescendantsAtDeath,
  outlivedADescendant,
  eventsDuringALifetime,
  lifespanRecords,
];

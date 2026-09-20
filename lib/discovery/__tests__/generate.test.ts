import { describe, expect, it } from 'vitest';
import { buildDataset } from '@/lib/chronology';
import { fixtureDataset } from '@/lib/chronology/__tests__/fixtures';
import { discoveriesOfKind, discoveryById, generateDiscoveries } from '../generate';
import { hashSeed, nextSeed, pickDiscovery } from '../pick';

/**
 * The Phase 11 exit gate, over the synthetic fixture: every discovery is
 * reproducible from the data, and each one links to the records it came
 * from. The real dataset is asserted separately, in tests/golden, for the
 * same reason the engine suite is: a generator test should fail when a
 * generator is wrong, not when the dataset changes.
 */
const dataset = fixtureDataset();

describe('generateDiscoveries', () => {
  it('produces the same discoveries, in the same order, every time', () => {
    expect(generateDiscoveries(dataset)).toEqual(generateDiscoveries(dataset));
  });

  it('gives every discovery a stable id, unique within the run', () => {
    const ids = generateDiscoveries(dataset).map((discovery) => discovery.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(generateDiscoveries(dataset).map((d) => d.id));
  });

  it('names only people the dataset holds', () => {
    for (const discovery of generateDiscoveries(dataset)) {
      for (const personId of discovery.personIds) {
        expect(dataset.people.has(personId), `${discovery.id} names ${personId}`).toBe(
          true,
        );
      }
    }
  });

  it('names only events the dataset holds', () => {
    for (const discovery of generateDiscoveries(dataset)) {
      for (const eventId of discovery.eventIds) {
        expect(dataset.events.has(eventId), `${discovery.id} names ${eventId}`).toBe(
          true,
        );
      }
    }
  });

  it('gives every discovery a reference and some working', () => {
    for (const discovery of generateDiscoveries(dataset)) {
      expect(discovery.sourceReferences.length, discovery.id).toBeGreaterThan(0);
      expect(discovery.calculation.length, discovery.id).toBeGreaterThan(0);
    }
  });

  it('says what population each finding was drawn from', () => {
    for (const discovery of generateDiscoveries(dataset)) {
      expect(discovery.population).toMatch(/\d+ of \d+ people/);
    }
  });

  it('carries the chronology it was generated under', () => {
    for (const discovery of generateDiscoveries(dataset)) {
      expect(discovery.chronologyId).toBe('fixture');
    }
  });
});

describe('the findings themselves', () => {
  const found = generateDiscoveries(dataset);

  it('finds the longest lifespan, and it is the longest', () => {
    const [longest] = discoveriesOfKind(found, 'longest-lifespan');
    // ancestor and parent both live 100 years; child 50; cousin 40.
    // openended has a 200-year span but no recorded death, so it is not in
    // the dated population at all.
    expect(longest?.headline).toContain('100 years');
    expect(longest?.personIds).toEqual(['ancestor']);
  });

  it('finds the shortest lifespan', () => {
    const [shortest] = discoveriesOfKind(found, 'shortest-lifespan');
    expect(shortest?.personIds).toEqual(['cousin']);
    expect(shortest?.headline).toContain('40 years');
  });

  it('finds the largest overlap and marks it as being about an overlap', () => {
    const [largest] = discoveriesOfKind(found, 'largest-overlap');
    // ancestor 0–100 and parent 50–150 share 50 years, the most of any pair.
    expect(largest?.headline).toContain('50 years');
    expect(largest?.aboutOverlap).toBe(true);
  });

  it('never states an overlap for the person the chronology cannot date', () => {
    for (const discovery of found) {
      expect(discovery.personIds).not.toContain('undated');
      expect(discovery.personIds).not.toContain('absent');
    }
  });

  it('never claims two people met, however they overlapped', () => {
    const banned =
      /\bmet\b|knew each other|passed (?:down|on) to|must have|would have known/i;
    for (const discovery of found) {
      expect(discovery.headline, discovery.id).not.toMatch(banned);
      for (const step of discovery.calculation) {
        expect(`${step.label} ${step.value}`, discovery.id).not.toMatch(banned);
      }
    }
  });

  it('finds a discovery by id, and nothing for an id it does not hold', () => {
    const first = found[0];
    expect(discoveryById(found, first?.id ?? '')).toBe(first);
    expect(discoveryById(found, 'no-such-discovery')).toBeNull();
  });
});

describe('Surprise Me', () => {
  const found = generateDiscoveries(dataset);

  it('gives the same seed the same discovery, so a shared link reopens it', () => {
    expect(pickDiscovery(found, 'abc')).toBe(pickDiscovery(found, 'abc'));
  });

  it('lands on a real discovery whatever the seed', () => {
    for (const seed of ['', 'a', 'zzzz', '12345', 'a very long seed indeed']) {
      expect(found).toContain(pickDiscovery(found, seed));
    }
  });

  it('has nothing to pick from an empty list', () => {
    expect(pickDiscovery([], 'abc')).toBeNull();
  });

  it('moves to a different discovery on the next seed', () => {
    const first = pickDiscovery(found, 'start');
    const second = pickDiscovery(found, nextSeed(found, 'start'));
    expect(second).not.toBe(first);
    expect(found).toContain(second);
  });

  it('gives up on a different discovery when there is only one', () => {
    const only = found.slice(0, 1);
    expect(pickDiscovery(only, nextSeed(only, 'start'))).toBe(only[0]);
  });

  it('hashes a string to a number that does not depend on the platform', () => {
    expect(hashSeed('')).toBe(2166136261);
    expect(hashSeed('a')).toBe(hashSeed('a'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('a dataset with nothing to say', () => {
  /**
   * Every generator has to cope with a dataset it cannot draw a finding
   * from. The product will have one: a chronology that places nobody, or a
   * book whose genealogy has been entered but not yet dated. Returning
   * nothing is the right answer, and inventing a finding to fill the page
   * would be the exact failure the discovery engine exists to prevent.
   */
  const empty = buildDataset({
    chronologyId: 'empty',
    people: [],
    chronology: [],
    relationships: [],
  });

  it('finds nothing rather than something', () => {
    expect(generateDiscoveries(empty)).toEqual([]);
  });

  it('has nothing to surprise anyone with', () => {
    expect(pickDiscovery(generateDiscoveries(empty), 'seed')).toBeNull();
  });
});

describe('a dataset with people but no dates', () => {
  const undatedOnly = buildDataset({
    chronologyId: 'undated',
    people: [
      {
        id: 'someone',
        canonicalName: 'Someone',
        slug: 'someone',
        gender: 'unknown',
        description: null,
        eraId: null,
        sortOrder: null,
        primaryScriptureReferences: ['GEN.5.1'],
        reviewStatus: 'DRAFT',
      },
    ],
    chronology: [
      {
        personId: 'someone',
        chronologyId: 'undated',
        birthYear: null,
        deathYear: null,
        lifespan: null,
        birthConfidence: 'UNKNOWN',
        deathConfidence: 'UNKNOWN',
        lifespanConfidence: 'UNKNOWN',
        birthSourceType: 'UNKNOWN',
        deathSourceType: 'UNKNOWN',
        lifespanSourceType: 'UNKNOWN',
        sourceReferences: [],
        calculationMethod: null,
        derivation: null,
        notes: null,
        reviewStatus: 'DRAFT',
      },
    ],
    relationships: [],
  });

  it('says nothing about someone the chronology cannot place', () => {
    expect(generateDiscoveries(undatedOnly)).toEqual([]);
  });
});

describe('a dataset with one dated person', () => {
  /**
   * The longest lifespan and the shortest are then the same person, and
   * reporting both would be the same finding printed twice.
   */
  const person = {
    id: 'only',
    canonicalName: 'Only',
    slug: 'only',
    gender: 'male' as const,
    description: null,
    eraId: null,
    sortOrder: null,
    primaryScriptureReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT' as const,
  };

  const single = buildDataset({
    chronologyId: 'single',
    people: [person],
    chronology: [
      {
        personId: 'only',
        chronologyId: 'single',
        birthYear: 0,
        deathYear: 90,
        lifespan: 90,
        birthConfidence: 'DERIVED',
        deathConfidence: 'DERIVED',
        lifespanConfidence: 'EXPLICIT',
        birthSourceType: 'SCRIPTURE_DERIVED',
        deathSourceType: 'SCRIPTURE_DERIVED',
        lifespanSourceType: 'SCRIPTURE_EXPLICIT',
        sourceReferences: ['GEN.5.1'],
        calculationMethod: null,
        derivation: null,
        notes: null,
        reviewStatus: 'DRAFT',
      },
    ],
    relationships: [],
  });

  it('reports the lifespan once, not as both a longest and a shortest', () => {
    const found = generateDiscoveries(single);
    expect(discoveriesOfKind(found, 'longest-lifespan')).toHaveLength(1);
    expect(discoveriesOfKind(found, 'shortest-lifespan')).toHaveLength(0);
  });
});

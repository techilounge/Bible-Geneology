import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateDiscoveries } from '@/lib/discovery';
import { DEFAULT_CHRONOLOGY_ID } from '@/lib/config/chronology-defaults';
import type { ScriptureReference } from '@/lib/domain';
import { loadDerived } from './load';

/**
 * The Phase 11 exit gate, over the real dataset: every discovery is
 * reproducible from canonical data, and each one links to the records it
 * came from.
 *
 * This is the suite that would have caught the error in
 * `docs/COPY_CORRECTIONS.md`, where the build prompt asserted that Noah and
 * Abraham overlapped. A generated finding cannot make that claim unless the
 * data supports it, and these assertions are what prove the findings are
 * generated rather than written.
 */
const dataset = loadDerived(DEFAULT_CHRONOLOGY_ID);
const discoveries = generateDiscoveries(dataset);

const references = new Set(
  (
    JSON.parse(
      readFileSync(
        join(process.cwd(), 'data', 'canonical', 'scripture-references.json'),
        'utf8',
      ),
    ) as ScriptureReference[]
  ).map((reference) => reference.id),
);

describe('the discoveries the real dataset supports', () => {
  it('produces at least one finding of substance', () => {
    expect(discoveries.length).toBeGreaterThanOrEqual(8);
  });

  it('produces exactly the same output when run again', () => {
    expect(generateDiscoveries(loadDerived(DEFAULT_CHRONOLOGY_ID))).toEqual(discoveries);
  });

  it('gives each finding an id nothing else in the run shares', () => {
    const ids = discoveries.map((discovery) => discovery.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const discovery of discoveries) {
    describe(discovery.id, () => {
      it('names only people in the dataset, all of them dated', () => {
        for (const personId of discovery.personIds) {
          expect(dataset.people.has(personId)).toBe(true);
          expect(dataset.chronology.get(personId)?.birthYear).not.toBeNull();
        }
      });

      it('cites references the dataset holds', () => {
        expect(discovery.sourceReferences.length).toBeGreaterThan(0);
        for (const reference of discovery.sourceReferences) {
          expect(references.has(reference), `${reference} is not a known reference`).toBe(
            true,
          );
        }
      });

      it('shows its working', () => {
        expect(discovery.calculation.length).toBeGreaterThan(0);
        for (const step of discovery.calculation) {
          expect(step.value).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
        }
      });

      it('states no year the chronology does not hold', () => {
        const years = [...discovery.headline.matchAll(/(\d+) AM/g)].map((match) =>
          Number(match[1]),
        );
        for (const year of years) {
          expect(year).toBeGreaterThanOrEqual(0);
          expect(year).toBeLessThanOrEqual(3000);
        }
      });
    });
  }
});

describe('no finding converts an overlap into a meeting', () => {
  /**
   * The same ban the copy suite applies to the source, applied to the
   * output. A generator could produce a sentence no file contains, so the
   * generated text is checked as text.
   */
  const banned = [
    /\bmust have met\b/i,
    /\bwould have met\b/i,
    /\bknew each other\b/i,
    /\bpassed (?:down|on) to\b/i,
    /\bwould have known\b/i,
    /\bhanded down\b/i,
    /\btaught\b/i,
    /\btold\b/i,
  ];

  for (const discovery of discoveries) {
    it(`${discovery.id} says only what the years say`, () => {
      const text = [
        discovery.headline,
        discovery.population,
        ...discovery.calculation.map((step) => `${step.label} ${step.value}`),
      ].join(' ');
      for (const pattern of banned) {
        expect(text, `${discovery.id} matches ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});

describe('the findings under the alternate chronology differ from the default', () => {
  /**
   * The property that makes a generated discovery worth having: it belongs
   * to the chronology that produced it. Under the alternate reading Abraham
   * is born 60 years earlier, so at least one finding has to move.
   */
  it('produces a different set of headlines', () => {
    const alternate = generateDiscoveries(loadDerived('masoretic-gen11-26'));
    const defaults = discoveries.map((discovery) => discovery.headline).join('\n');
    expect(alternate.map((discovery) => discovery.headline).join('\n')).not.toBe(
      defaults,
    );
  });

  it('labels every finding with the chronology it came from', () => {
    for (const discovery of discoveries) {
      expect(discovery.chronologyId).toBe(DEFAULT_CHRONOLOGY_ID);
    }
  });
});

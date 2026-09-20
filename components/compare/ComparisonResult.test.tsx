import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TimelineRow } from '@/lib/chronology/scale';
import { NOT_CONTACT } from '@/lib/config/copy';
import type { ChronologyResult, Person } from '@/lib/domain';
import type { Age, LifespanComparison, Overlap } from '@/lib/chronology';
import { ComparisonResult, type ComparisonProps } from './ComparisonResult';

/**
 * The wordings the comparison page is judged on.
 *
 * The golden pairs are checked through the real page in the browser suite.
 * What is here is the set of cases the real dataset does not happen to
 * contain — above all the same-year boundary, which no pair in Genesis
 * produces. Inventing a person to make one would be inventing data, so the
 * case is exercised against the component instead.
 */
function person(id: string, name: string): Person {
  return {
    id,
    canonicalName: name,
    slug: id,
    gender: 'male',
    description: null,
    eraId: null,
    sortOrder: null,
    primaryScriptureReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT',
  };
}

const A = person('a', 'Ada');
const B = person('b', 'Bede');

const row = (id: string, start: number, end: number): TimelineRow => ({
  personId: id,
  name: id,
  slug: id,
  startYear: start,
  endYear: end,
  openEnded: false,
  lengthYears: end - start,
  birthConfidence: 'DERIVED',
  deathConfidence: 'DERIVED',
  lane: 0,
});

const known = <T,>(value: T): ChronologyResult<T> => ({
  status: 'known',
  value,
  confidence: 'DERIVED',
});

const AGE: ChronologyResult<Age> = known({ years: 40, posthumous: false });

const LIFESPANS: ChronologyResult<LifespanComparison> = known({
  longerPersonId: 'a',
  differenceYears: 20,
  lifespans: { a: 100, b: 80 },
});

function renderResult(
  overlap: ChronologyResult<Overlap>,
  extra: Partial<ComparisonProps> = {},
) {
  return render(
    <ComparisonResult
      a={A}
      b={B}
      overlap={overlap}
      lifespans={LIFESPANS}
      aAtBsBirth={AGE}
      bAtAsBirth={AGE}
      relationship={[{ from: 'a', to: 'b', type: 'parent_of' }]}
      connection={null}
      nameOf={{ a: 'Ada', b: 'Bede' }}
      rows={[row('a', 0, 100), row('b', 50, 150)]}
      bounds={[0, 150]}
      references={[]}
      {...extra}
    />,
  );
}

const overlapping: Overlap = {
  personAId: 'a',
  personBId: 'b',
  overlaps: true,
  years: 50,
  overlapStart: 50,
  overlapEnd: 100,
  sameYearBoundary: false,
  gapYears: 0,
};

describe('ComparisonResult', () => {
  it('reports an overlap with its years and its span', () => {
    renderResult(known(overlapping));
    const verdict = screen.getByTestId('verdict').textContent ?? '';
    expect(verdict).toContain('both were alive at the same time');
    expect(verdict).toContain('50 years');
    expect(verdict).toContain('50 to 100 AM');
  });

  it('carries the sentence that says an overlap is not contact, every time', () => {
    for (const overlap of [
      known(overlapping),
      known({
        ...overlapping,
        overlaps: false,
        years: 0,
        overlapStart: null,
        overlapEnd: null,
        gapYears: 12,
      }),
      { status: 'unknown', reason: 'unknown-in-chronology' } as ChronologyResult<Overlap>,
    ]) {
      const { unmount } = renderResult(overlap);
      expect(screen.getByText(NOT_CONTACT)).toBeDefined();
      unmount();
    }
  });

  it('gives the same-year boundary its own message, not a bare no', () => {
    // One life ends in the very year the other begins. Under the half-open
    // convention that is zero years of overlap, and it is a different
    // statement from "these two are centuries apart".
    renderResult(
      known({
        ...overlapping,
        overlaps: false,
        years: 0,
        overlapStart: null,
        overlapEnd: null,
        sameYearBoundary: true,
        gapYears: 0,
      }),
    );
    const verdict = screen.getByTestId('verdict').textContent ?? '';
    expect(verdict).toContain('One life ends in the very year the other begins');
    expect(verdict).toContain('not precise enough');
    expect(verdict).not.toMatch(/^No\./);
  });

  it('says how far apart two lifetimes are when they do not overlap', () => {
    renderResult(
      known({
        ...overlapping,
        overlaps: false,
        years: 0,
        overlapStart: null,
        overlapEnd: null,
        gapYears: 2,
      }),
    );
    expect(screen.getByTestId('verdict').textContent).toContain('2 years apart');
  });

  it('uses the singular for a gap of one year', () => {
    renderResult(
      known({
        ...overlapping,
        overlaps: false,
        years: 0,
        overlapStart: null,
        overlapEnd: null,
        gapYears: 1,
      }),
    );
    expect(screen.getByTestId('verdict').textContent).toContain('1 year apart');
  });

  it('says it cannot tell, rather than guessing, when a date is missing', () => {
    renderResult({ status: 'unknown', reason: 'unknown-in-chronology' });
    expect(screen.getByTestId('verdict').textContent).toContain('cannot say');
  });

  it('reports a disagreement between readings as a disagreement', () => {
    renderResult({
      status: 'disputed',
      alternatives: [
        { sourceId: 'masoretic', value: overlapping, confidence: 'DERIVED' },
        {
          sourceId: 'masoretic-gen11-26',
          value: { ...overlapping, years: 58 },
          confidence: 'DISPUTED',
        },
      ],
    });
    expect(screen.getByTestId('verdict').textContent).toContain('Readings disagree');
  });

  it('shows the lifetime connection only when asked, and labels what it is not', () => {
    expect(screen.queryByTestId('connection-chain')).toBeNull();

    renderResult(known({ ...overlapping, overlaps: false, years: 0, gapYears: 2 }), {
      connection: ['a', 'c', 'b'],
      nameOf: { a: 'Ada', b: 'Bede', c: 'Cuthbert' },
    });
    expect(screen.getByTestId('connection-chain').textContent).toBe(
      'Ada → Cuthbert → Bede',
    );
    expect(screen.getByText(/not a route anything travelled/)).toBeDefined();
  });

  it('says the dataset records no line rather than that the two are unrelated', () => {
    renderResult(known(overlapping), { relationship: null });
    expect(
      screen.getByText(/statement about what has been entered, not about the family/),
    ).toBeDefined();
  });

  it('keeps the chart out of the accessibility tree, since the page says it in words', () => {
    const { container } = renderResult(known(overlapping));
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChronologyResult } from '@/lib/domain';
import { ChronologyValue } from './ChronologyValue';

/**
 * Requirement section 57: never show NaN, undefined, null or a negative age.
 * The engine makes that possible by returning a union; this component is
 * where the union is unwrapped, so this is where the requirement is either
 * kept or broken.
 */
const year = (value: number) => <span>{value} AM</span>;

describe('ChronologyValue', () => {
  it('renders a known value with its confidence', () => {
    const result: ChronologyResult<number> = {
      status: 'known',
      value: 2008,
      confidence: 'DERIVED',
    };
    render(<ChronologyValue result={result} render={year} />);
    expect(screen.getByText('2008 AM')).toBeDefined();
    expect(screen.getByText('Derived')).toBeDefined();
  });

  it.each([
    ['no-data', /Scripture does not give this/],
    ['unknown-in-chronology', /Cannot be worked out/],
    ['not-applicable', /Not part of this chronology/],
  ] as const)('gives %s its own wording', (reason, pattern) => {
    const result: ChronologyResult<number> = { status: 'unknown', reason };
    render(<ChronologyValue result={result} render={year} />);
    expect(screen.getByText(pattern)).toBeDefined();
  });

  it('never renders the words null, undefined or NaN', () => {
    const results: Array<ChronologyResult<number>> = [
      { status: 'unknown', reason: 'no-data' },
      { status: 'unknown', reason: 'unknown-in-chronology' },
      { status: 'unknown', reason: 'not-applicable' },
    ];
    for (const result of results) {
      const { container } = render(<ChronologyValue result={result} render={year} />);
      expect(container.textContent).not.toMatch(/null|undefined|NaN/);
    }
  });

  it('shows both readings of a disputed value rather than choosing', () => {
    const result: ChronologyResult<number> = {
      status: 'disputed',
      alternatives: [
        { value: 2008, sourceId: 'masoretic', confidence: 'DERIVED' },
        { value: 1948, sourceId: 'masoretic-gen11-26', confidence: 'DISPUTED' },
      ],
    };
    render(<ChronologyValue result={result} render={year} />);
    expect(screen.getByText('2008 AM')).toBeDefined();
    expect(screen.getByText('1948 AM')).toBeDefined();
    expect(screen.getByText(/masoretic-gen11-26/)).toBeDefined();
  });

  it('can be asked to leave the confidence badge off', () => {
    const result: ChronologyResult<number> = {
      status: 'known',
      value: 930,
      confidence: 'EXPLICIT',
    };
    const { container } = render(
      <ChronologyValue result={result} render={year} showConfidence={false} />,
    );
    expect(container.textContent).toBe('930 AM');
  });
});

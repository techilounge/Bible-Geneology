import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_LEVELS } from '@/lib/domain/enums';
import { ConfidenceBadge } from './ConfidenceBadge';

/**
 * Requirement section 51: colour is never the only carrier of meaning. These
 * assert the property directly rather than trusting the stylesheet, because
 * the failure mode is silent — a badge that reads correctly to most people
 * and says nothing at all to some.
 */
describe('ConfidenceBadge', () => {
  it.each([
    ['EXPLICIT', 'Stated'],
    ['DERIVED', 'Derived'],
    ['APPROXIMATE', 'Approximate'],
    ['DISPUTED', 'Disputed'],
    ['UNKNOWN', 'Unknown'],
  ] as const)('labels %s with the word "%s"', (level, word) => {
    render(<ConfidenceBadge level={level} />);
    expect(screen.getByText(word)).toBeDefined();
  });

  it.each(CONFIDENCE_LEVELS)('explains %s in words, not only in colour', (level) => {
    const { container } = render(<ConfidenceBadge level={level} />);
    const screenReaderText = container.querySelector('.sr-only')?.textContent ?? '';
    expect(screenReaderText.trim().length).toBeGreaterThan(10);
  });

  it.each(CONFIDENCE_LEVELS)('hides the decorative swatch from %s', (level) => {
    const { container } = render(<ConfidenceBadge level={level} />);
    // The colour chip carries no information a screen reader can use, so it
    // must not be announced alongside the word that does.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('gives every level a distinct word', () => {
    const labels = CONFIDENCE_LEVELS.map((level) => {
      const { container } = render(<ConfidenceBadge level={level} />);
      return container.textContent ?? '';
    });
    expect(new Set(labels).size).toBe(CONFIDENCE_LEVELS.length);
  });

  it('says plainly that UNKNOWN means Scripture does not say', () => {
    render(<ConfidenceBadge level="UNKNOWN" />);
    expect(screen.getByText(/Scripture does not say/)).toBeDefined();
  });
});

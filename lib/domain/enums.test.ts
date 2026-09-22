import { describe, expect, it } from 'vitest';
import {
  REVIEW_STATUSES,
  isProductionVisible,
  reviewStatusRank,
  weakestReviewStatus,
  type ReviewStatus,
} from './enums';

describe('isProductionVisible', () => {
  it('admits VERIFIED and nothing else', () => {
    expect(isProductionVisible('VERIFIED')).toBe(true);
    for (const status of REVIEW_STATUSES.filter((s) => s !== 'VERIFIED')) {
      expect(isProductionVisible(status)).toBe(false);
    }
  });
});

describe('reviewStatusRank', () => {
  it('orders the statuses from least to most trusted', () => {
    const ordered: ReviewStatus[] = [
      'DEPRECATED',
      'DISPUTED',
      'DRAFT',
      'SOURCE_CHECKED',
      'VERIFIED',
    ];
    const ranks = ordered.map(reviewStatusRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ordered.length);
  });

  it('ranks a contested reading below a merely unreviewed one', () => {
    // A reader needs to see DISPUTED more than DRAFT, so it must lose the fold.
    expect(reviewStatusRank('DISPUTED')).toBeLessThan(reviewStatusRank('DRAFT'));
  });
});

describe('weakestReviewStatus', () => {
  it('is VERIFIED for an empty chain, the identity for the fold', () => {
    expect(weakestReviewStatus()).toBe('VERIFIED');
  });

  it('returns the sole status when only one is given', () => {
    for (const status of REVIEW_STATUSES) {
      expect(weakestReviewStatus(status)).toBe(status);
    }
  });

  it('returns the least-trusted status, order-independently', () => {
    expect(weakestReviewStatus('VERIFIED', 'SOURCE_CHECKED')).toBe('SOURCE_CHECKED');
    expect(weakestReviewStatus('SOURCE_CHECKED', 'VERIFIED')).toBe('SOURCE_CHECKED');
    expect(weakestReviewStatus('VERIFIED', 'DISPUTED', 'SOURCE_CHECKED')).toBe(
      'DISPUTED',
    );
    expect(weakestReviewStatus('VERIFIED', 'VERIFIED', 'VERIFIED')).toBe('VERIFIED');
    expect(weakestReviewStatus('DRAFT', 'DEPRECATED')).toBe('DEPRECATED');
  });
});

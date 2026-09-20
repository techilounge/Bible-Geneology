import { describe, expect, it } from 'vitest';
import { SIGN_IN_LIMIT, consume, limitKey, type Bucket } from '../rate-limit';

const LIMIT = { capacity: 3, refillPerSecond: 1 };
const START = 1_000_000;

describe('spending from a bucket', () => {
  it('lets the first caller through and starts the count', () => {
    const decision = consume(null, LIMIT, START);
    expect(decision.allowed).toBe(true);
    expect(decision.bucket.tokens).toBe(2);
    expect(decision.retryAfterSeconds).toBe(0);
  });

  it('allows a burst up to the capacity and then refuses', () => {
    let bucket: Bucket | null = null;
    for (let attempt = 0; attempt < LIMIT.capacity; attempt += 1) {
      const decision = consume(bucket, LIMIT, START);
      expect(decision.allowed, `attempt ${attempt}`).toBe(true);
      bucket = decision.bucket;
    }
    const refused = consume(bucket, LIMIT, START);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(1);
  });

  it('refills over time rather than at a window boundary', () => {
    const spent: Bucket = { tokens: 0, updatedAt: START };
    expect(consume(spent, LIMIT, START + 500).allowed).toBe(false);
    expect(consume(spent, LIMIT, START + 1000).allowed).toBe(true);
  });

  it('never refills past the capacity, however long it waits', () => {
    const decision = consume({ tokens: 0, updatedAt: START }, LIMIT, START + 86_400_000);
    expect(decision.bucket.tokens).toBe(LIMIT.capacity - 1);
  });

  it('ignores a clock that went backwards', () => {
    const decision = consume({ tokens: 1, updatedAt: START }, LIMIT, START - 5000);
    expect(decision.allowed).toBe(true);
    expect(decision.bucket.tokens).toBe(0);
  });

  it('says how long to wait, in whole seconds', () => {
    const refused = consume({ tokens: 0, updatedAt: START }, SIGN_IN_LIMIT, START);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(120);
  });
});

describe('what a limit is counted against', () => {
  it('folds case and spacing, so two spellings are one caller', () => {
    expect(limitKey('sign-in', '  Alice@Example.test ')).toBe(
      'sign-in:alice@example.test',
    );
    expect(limitKey('sign-in', 'a')).not.toBe(limitKey('sign-out', 'a'));
  });
});

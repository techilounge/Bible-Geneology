/**
 * A token bucket, as arithmetic.
 *
 * The one endpoint here worth limiting is the sign-in link: it sends
 * an email to an address somebody typed, so an unlimited one is a way
 * to post mail to a stranger, repeatedly, from this site's sender
 * reputation. Reading a page is not limited, and should not be.
 *
 * A bucket refills continuously rather than resetting on a window
 * boundary, because a fixed window lets somebody spend a whole window
 * at the end of one and a whole window at the start of the next.
 *
 * Pure: the state goes in and comes out, so the rule can be tested
 * against a clock that does not tick.
 */
export interface Bucket {
  tokens: number;
  /** When the tokens were last counted, in milliseconds. */
  updatedAt: number;
}

export interface Limit {
  /** The most that can be spent in a burst. */
  capacity: number;
  refillPerSecond: number;
}

export interface Decision {
  allowed: boolean;
  bucket: Bucket;
  /** Whole seconds until one more would be allowed. Zero when it is. */
  retryAfterSeconds: number;
}

/** Five links in a burst, and one more every two minutes after that. */
export const SIGN_IN_LIMIT: Limit = { capacity: 5, refillPerSecond: 1 / 120 };

export function consume(bucket: Bucket | null, limit: Limit, now: number): Decision {
  const elapsedSeconds =
    bucket === null ? 0 : Math.max(0, (now - bucket.updatedAt) / 1000);
  const refilled = Math.min(
    limit.capacity,
    (bucket?.tokens ?? limit.capacity) + elapsedSeconds * limit.refillPerSecond,
  );

  if (refilled >= 1) {
    return {
      allowed: true,
      bucket: { tokens: refilled - 1, updatedAt: now },
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    bucket: { tokens: refilled, updatedAt: now },
    retryAfterSeconds: Math.ceil((1 - refilled) / limit.refillPerSecond),
  };
}

/**
 * The key a limit is counted against.
 *
 * Both the address and the caller, because either alone is a hole: one
 * caller must not be able to mail a thousand addresses, and a thousand
 * callers must not be able to mail one address.
 */
export function limitKey(action: string, value: string): string {
  return `${action}:${value.trim().toLowerCase()}`;
}

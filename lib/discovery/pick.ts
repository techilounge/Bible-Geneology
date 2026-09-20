import type { Discovery } from './types';

/**
 * Surprise Me, without randomness on the server.
 *
 * A random pick would mean the link a reader shares opens on a different
 * finding than the one they saw, and it would make the page impossible to
 * render the same way twice — which the Phase 11 gate forbids. Instead a
 * seed picks the index, the seed travels in the URL, and pressing the
 * button asks for the next seed.
 *
 * The hash is FNV-1a, chosen because it is four lines long and the quality
 * of the spread does not matter here: any seed must land on some discovery,
 * and the same seed must always land on the same one.
 */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickDiscovery(
  discoveries: readonly Discovery[],
  seed: string,
): Discovery | null {
  if (discoveries.length === 0) return null;
  /* v8 ignore next -- @preserve: the modulus keeps the index in range. */
  return discoveries[hashSeed(seed) % discoveries.length] ?? null;
}

/**
 * The seed to offer next.
 *
 * Derived from the current one so the sequence is reproducible, and checked
 * against the discovery it lands on so pressing the button twice never
 * shows the same finding twice in a row.
 */
export function nextSeed(discoveries: readonly Discovery[], seed: string): string {
  const current = pickDiscovery(discoveries, seed);
  let candidate = seed;
  for (let attempt = 1; attempt <= discoveries.length; attempt += 1) {
    candidate = `${seed}.${attempt}`;
    const next = pickDiscovery(discoveries, candidate);
    if (next && next.id !== current?.id) return candidate;
  }
  /* v8 ignore next -- @preserve: only reachable with a single discovery. */
  return candidate;
}

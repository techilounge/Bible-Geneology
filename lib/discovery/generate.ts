import type { Dataset } from '@/lib/chronology';
import { GENERATORS } from './generators';
import type { Discovery, DiscoveryKind } from './types';

/**
 * Every discovery the dataset supports, in a fixed order.
 *
 * The Phase 11 exit gate is that running this twice over the same dataset
 * produces identical output. Nothing here consults the clock or a random
 * number, every generator sorts its own results, and the generators run in
 * a fixed order, so the gate holds by construction rather than by luck.
 */
export function generateDiscoveries(dataset: Dataset): Discovery[] {
  return GENERATORS.flatMap((generate) => generate(dataset));
}

export function discoveryById(
  discoveries: readonly Discovery[],
  id: string,
): Discovery | null {
  return discoveries.find((discovery) => discovery.id === id) ?? null;
}

export function discoveriesOfKind(
  discoveries: readonly Discovery[],
  kind: DiscoveryKind,
): Discovery[] {
  return discoveries.filter((discovery) => discovery.kind === kind);
}

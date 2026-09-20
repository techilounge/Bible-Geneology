import type { PersonChronology } from '@/lib/domain';

/**
 * The lifetime connection graph (requirement section 20).
 *
 * A node is a person with dates. An edge exists when two lifetimes overlap.
 * The shortest path between two people is the shortest chain of overlapping
 * lifetimes connecting them.
 *
 * What this is NOT: evidence that anything was passed along that chain. The
 * product calls the result a "Lifetime Connection" and never says information
 * travelled it. That wording rule is enforced in the UI copy; the engine's job
 * is to keep the name of the thing accurate.
 */
export interface OverlapGraph {
  nodes: string[];
  neighbours: ReadonlyMap<string, string[]>;
}

interface Dated {
  personId: string;
  birthYear: number;
  deathYear: number;
}

export function buildOverlapGraph(records: Iterable<PersonChronology>): OverlapGraph {
  const dated: Dated[] = [];
  for (const record of records) {
    if (record.birthYear === null || record.deathYear === null) continue;
    dated.push({
      personId: record.personId,
      birthYear: record.birthYear,
      deathYear: record.deathYear,
    });
  }

  dated.sort((a, b) => a.birthYear - b.birthYear);

  const neighbours = new Map<string, string[]>();
  for (const person of dated) neighbours.set(person.personId, []);

  // Sorted by birth year, so once a candidate is born after this person's
  // death, every later candidate is too.
  for (let i = 0; i < dated.length; i += 1) {
    const a = dated[i];
    if (!a) continue;
    for (let j = i + 1; j < dated.length; j += 1) {
      const b = dated[j];
      if (!b) continue;
      if (b.birthYear >= a.deathYear) break;

      const years =
        Math.min(a.deathYear, b.deathYear) - Math.max(a.birthYear, b.birthYear);
      if (years > 0) {
        neighbours.get(a.personId)?.push(b.personId);
        neighbours.get(b.personId)?.push(a.personId);
      }
    }
  }

  return { nodes: dated.map((d) => d.personId), neighbours };
}

/**
 * Shortest chain of overlapping lifetimes between two people.
 *
 * Breadth-first, because every edge costs the same: one overlapping lifetime.
 * Returns null when the two are not connected by any chain.
 */
export function getOverlapChain(
  graph: OverlapGraph,
  fromId: string,
  toId: string,
): string[] | null {
  if (!graph.neighbours.has(fromId) || !graph.neighbours.has(toId)) return null;
  if (fromId === toId) return [fromId];

  const previous = new Map<string, string>();
  const seen = new Set([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    for (const neighbour of graph.neighbours.get(current) ?? []) {
      if (seen.has(neighbour)) continue;
      seen.add(neighbour);
      previous.set(neighbour, current);

      if (neighbour === toId) {
        const chain = [toId];
        let cursor = toId;
        while (cursor !== fromId) {
          const prev = previous.get(cursor);
          if (prev === undefined) return null;
          chain.unshift(prev);
          cursor = prev;
        }
        return chain;
      }

      queue.push(neighbour);
    }
  }

  return null;
}

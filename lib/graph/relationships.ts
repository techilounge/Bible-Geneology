import type { Relationship } from '@/lib/domain';

/**
 * Graph operations over the relationship records.
 *
 * Only `parent` edges are stored for descent; ancestor, descendant and
 * sibling-by-shared-parent are computed here. Storing them would mean the same
 * fact recorded twice, with the two copies free to drift.
 */

export function parentsOf(
  relationships: readonly Relationship[],
  personId: string,
): string[] {
  return relationships
    .filter((r) => r.relationshipType === 'parent' && r.targetPersonId === personId)
    .map((r) => r.sourcePersonId);
}

export function childrenOf(
  relationships: readonly Relationship[],
  personId: string,
): string[] {
  return relationships
    .filter((r) => r.relationshipType === 'parent' && r.sourcePersonId === personId)
    .map((r) => r.targetPersonId);
}

export function spousesOf(
  relationships: readonly Relationship[],
  personId: string,
): string[] {
  return relationships
    .filter(
      (r) =>
        r.relationshipType === 'spouse' &&
        (r.sourcePersonId === personId || r.targetPersonId === personId),
    )
    .map((r) => (r.sourcePersonId === personId ? r.targetPersonId : r.sourcePersonId));
}

/** Siblings share at least one parent, and are computed rather than stored. */
export function siblingsOf(
  relationships: readonly Relationship[],
  personId: string,
): string[] {
  const siblings = new Set<string>();
  for (const parent of parentsOf(relationships, personId)) {
    for (const child of childrenOf(relationships, parent)) {
      if (child !== personId) siblings.add(child);
    }
  }
  return [...siblings].sort();
}

export function ancestorsOf(
  relationships: readonly Relationship[],
  personId: string,
): Set<string> {
  return traverse(personId, (id) => parentsOf(relationships, id));
}

export function descendantsOf(
  relationships: readonly Relationship[],
  personId: string,
): Set<string> {
  return traverse(personId, (id) => childrenOf(relationships, id));
}

function traverse(start: string, next: (id: string) => string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...next(start)];
  while (queue.length > 0) {
    const id = queue.shift();
    /* v8 ignore next -- @preserve: the loop condition guarantees a value; the seen check is exercised by the cycle tests. */
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    queue.push(...next(id));
  }
  return seen;
}

/**
 * The shortest chain of parent edges from a descendant up to an ancestor,
 * inclusive of both ends. Returns null when no such chain exists.
 */
export function getAncestorPath(
  relationships: readonly Relationship[],
  descendantId: string,
  ancestorId: string,
): string[] | null {
  return breadthFirstPath(descendantId, ancestorId, (id) => parentsOf(relationships, id));
}

export function getDescendantPath(
  relationships: readonly Relationship[],
  ancestorId: string,
  descendantId: string,
): string[] | null {
  return breadthFirstPath(ancestorId, descendantId, (id) =>
    childrenOf(relationships, id),
  );
}

export interface RelationshipEdge {
  from: string;
  to: string;
  type: string;
}

/**
 * The shortest path between two people over every stored relationship,
 * treated as undirected. Used for "how are these two related?".
 */
export function getRelationshipPath(
  relationships: readonly Relationship[],
  fromId: string,
  toId: string,
): RelationshipEdge[] | null {
  if (fromId === toId) return [];

  const neighbours = new Map<string, RelationshipEdge[]>();
  const push = (from: string, to: string, type: string) => {
    neighbours.set(from, [...(neighbours.get(from) ?? []), { from, to, type }]);
  };
  for (const rel of relationships) {
    push(rel.sourcePersonId, rel.targetPersonId, rel.relationshipType);
    push(rel.targetPersonId, rel.sourcePersonId, inverseOf(rel.relationshipType));
  }

  const previous = new Map<string, RelationshipEdge>();
  const seen = new Set([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift();
    /* v8 ignore next -- @preserve: noUncheckedIndexedAccess forces this guard; the index is always in range. */
    if (current === undefined) break;
    if (current === toId) break;

    for (const edge of neighbours.get(current) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      previous.set(edge.to, edge);
      queue.push(edge.to);
    }
  }

  if (!previous.has(toId)) return null;

  const path: RelationshipEdge[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const edge = previous.get(cursor);
    /* v8 ignore next -- @preserve: noUncheckedIndexedAccess forces this guard; the index is always in range. */
    if (!edge) return null;
    path.unshift(edge);
    cursor = edge.from;
  }
  return path;
}

function inverseOf(type: string): string {
  if (type === 'parent') return 'child';
  if (type === 'child') return 'parent';
  if (type === 'teacher') return 'disciple';
  if (type === 'disciple') return 'teacher';
  if (type === 'successor') return 'predecessor';
  if (type === 'predecessor') return 'successor';
  return type;
}

/**
 * Generations between two people along the descent graph.
 *
 * Direct line: the number of parent edges between them. Otherwise, the
 * distance through their nearest common ancestor.
 */
export function getGenerationDistance(
  relationships: readonly Relationship[],
  personAId: string,
  personBId: string,
): number | null {
  const up = getAncestorPath(relationships, personBId, personAId);
  if (up) return up.length - 1;

  const down = getAncestorPath(relationships, personAId, personBId);
  if (down) return down.length - 1;

  const ancestorsA = new Map<string, number>();
  let depth = 0;
  let frontier = [personAId];
  const seenA = new Set([personAId]);
  ancestorsA.set(personAId, 0);
  while (frontier.length > 0) {
    depth += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const parent of parentsOf(relationships, id)) {
        if (seenA.has(parent)) continue;
        seenA.add(parent);
        ancestorsA.set(parent, depth);
        next.push(parent);
      }
    }
    frontier = next;
  }

  let bestTotal: number | null = null;
  let bDepth = 0;
  let bFrontier = [personBId];
  const seenB = new Set([personBId]);
  while (bFrontier.length > 0) {
    for (const id of bFrontier) {
      const aDepth = ancestorsA.get(id);
      if (aDepth !== undefined) {
        const total = aDepth + bDepth;
        if (bestTotal === null || total < bestTotal) bestTotal = total;
      }
    }
    bDepth += 1;
    const next: string[] = [];
    for (const id of bFrontier) {
      for (const parent of parentsOf(relationships, id)) {
        if (seenB.has(parent)) continue;
        seenB.add(parent);
        next.push(parent);
      }
    }
    bFrontier = next;
  }

  return bestTotal;
}

/** Depth from the earliest ancestor, used to count concurrent generations. */
export function generationDepths(
  relationships: readonly Relationship[],
): Map<string, number> {
  const depths = new Map<string, number>();

  const depthOf = (id: string, trail: Set<string>): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (trail.has(id)) return 0;

    const parents = parentsOf(relationships, id);
    if (parents.length === 0) {
      depths.set(id, 0);
      return 0;
    }

    const next = new Set(trail).add(id);
    const depth = Math.max(...parents.map((p) => depthOf(p, next))) + 1;
    depths.set(id, depth);
    return depth;
  };

  const everyone = new Set<string>();
  for (const rel of relationships) {
    everyone.add(rel.sourcePersonId);
    everyone.add(rel.targetPersonId);
  }
  for (const id of everyone) depthOf(id, new Set());

  return depths;
}

function breadthFirstPath(
  start: string,
  goal: string,
  next: (id: string) => string[],
): string[] | null {
  if (start === goal) return [start];

  const previous = new Map<string, string>();
  const seen = new Set([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    /* v8 ignore next -- @preserve: noUncheckedIndexedAccess forces this guard; the index is always in range. */
    if (current === undefined) break;
    for (const neighbour of next(current)) {
      if (seen.has(neighbour)) continue;
      seen.add(neighbour);
      previous.set(neighbour, current);
      if (neighbour === goal) {
        const path = [goal];
        let cursor = goal;
        while (cursor !== start) {
          const prev = previous.get(cursor);
          /* v8 ignore next -- @preserve: noUncheckedIndexedAccess forces this guard; the index is always in range. */
          if (prev === undefined) return null;
          path.unshift(prev);
          cursor = prev;
        }
        return path;
      }
      queue.push(neighbour);
    }
  }

  return null;
}

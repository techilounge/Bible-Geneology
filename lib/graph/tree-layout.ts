import type { ConfidenceLevel, Relationship } from '@/lib/domain';
import { childrenOf, parentsOf, spousesOf } from './relationships';

/**
 * Layout for the family tree.
 *
 * Pure: relationships in, coordinates out, no DOM and no React. The Phase 10
 * gate asks that every edge trace to a `relationships` row and that no
 * relationship literal exist in any visualisation component. Both fall out
 * of doing the work here — the component receives edges it cannot invent,
 * because it never sees the relationship records at all.
 *
 * Coordinates are abstract. `depth` counts generations from the root, up
 * being negative, and `order` is the position within that generation. The
 * component decides what a generation is worth in pixels.
 */
export interface TreeNode {
  personId: string;
  depth: number;
  order: number;
  /** True when this person is in the tree only as someone's spouse. */
  spouseOnly: boolean;
}

/**
 * An edge is a stored relationship row, carried whole.
 *
 * Nothing is derived here: sibling links, for instance, are not edges,
 * because no row records them. Drawing one would be the visualisation
 * asserting a relationship the dataset does not hold.
 */
export interface TreeEdge {
  sourcePersonId: string;
  targetPersonId: string;
  relationshipType: Relationship['relationshipType'];
  confidence: ConfidenceLevel;
  sourceReferences: readonly string[];
  /**
   * True when this edge is a line of descent rather than a marriage.
   *
   * Classified here so the drawing can style the two differently without
   * naming a relationship type. A visualisation that compares against
   * `'parent'` has started to hold an opinion about the data model, and
   * the Phase 10 gate is that it holds none.
   */
  isDescent: boolean;
}

export interface TreeLayout {
  rootId: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
  /** Lowest and highest depth present, for sizing the canvas. */
  depthRange: [number, number];
  /** Widest generation, in node count. */
  width: number;
  /**
   * People reached by a stored relationship but left out because the
   * generation limits stopped short. Counted so the page can say how much
   * it is not showing, rather than implying the tree is complete.
   */
  omittedCount: number;
}

export interface TreeOptions {
  /** Generations of ancestors to include. */
  up?: number;
  /** Generations of descendants to include. */
  down?: number;
  /** Include the spouses of everyone already in the tree. */
  includeSpouses?: boolean;
}

export function buildFamilyTree(
  relationships: readonly Relationship[],
  rootId: string,
  options: TreeOptions = {},
): TreeLayout {
  const up = options.up ?? 2;
  const down = options.down ?? 2;
  const includeSpouses = options.includeSpouses ?? true;

  const depths = new Map<string, number>([[rootId, 0]]);
  const spouseOnly = new Set<string>();

  collect(rootId, 0, -1, up, (id) => parentsOf(relationships, id), depths);
  collect(rootId, 0, 1, down, (id) => childrenOf(relationships, id), depths);

  if (includeSpouses) {
    for (const [personId, depth] of [...depths]) {
      for (const spouse of spousesOf(relationships, personId)) {
        if (depths.has(spouse)) continue;
        depths.set(spouse, depth);
        spouseOnly.add(spouse);
      }
    }
  }

  const edges: TreeEdge[] = relationships
    .filter(
      (row) => depths.has(row.sourcePersonId) && depths.has(row.targetPersonId),
    )
    .map((row) => ({
      sourcePersonId: row.sourcePersonId,
      targetPersonId: row.targetPersonId,
      relationshipType: row.relationshipType,
      confidence: row.confidence,
      sourceReferences: row.sourceReferences,
      isDescent: row.relationshipType === 'parent',
    }));

  const nodes = order(relationships, depths, spouseOnly);
  const allDepths = nodes.map((node) => node.depth);

  return {
    rootId,
    nodes,
    edges,
    depthRange: [Math.min(...allDepths), Math.max(...allDepths)],
    width: widestGeneration(nodes),
    omittedCount: countOmitted(relationships, depths),
  };
}

function collect(
  start: string,
  startDepth: number,
  step: number,
  limit: number,
  next: (id: string) => string[],
  into: Map<string, number>,
): void {
  let frontier = [start];
  for (let generation = 1; generation <= limit; generation += 1) {
    const found: string[] = [];
    for (const id of frontier) {
      for (const other of next(id)) {
        if (into.has(other)) continue;
        into.set(other, startDepth + step * generation);
        found.push(other);
      }
    }
    if (found.length === 0) return;
    frontier = found;
  }
}

/**
 * Orders each generation by the average position of its parents, so lines
 * cross as little as possible, with ties broken by id so the layout is the
 * same every time it is computed.
 *
 * This is a barycentre pass, not a tidy-tree algorithm. The genealogies
 * here are nearly linear, and a single pass puts the lines where a reader
 * expects them; a full Reingold-Tilford would be more machinery for no
 * visible difference on this data.
 *
 * Spouses are held back from that pass and seated afterwards, beside the
 * partner they are in the tree for. Scoring them with everyone else cannot
 * work: a spouse's score would be their partner's position, and within a
 * generation nobody has one until the sort has finished.
 */
function order(
  relationships: readonly Relationship[],
  depths: ReadonlyMap<string, number>,
  spouseOnly: ReadonlySet<string>,
): TreeNode[] {
  const byDepth = new Map<number, string[]>();
  for (const [personId, depth] of depths) {
    byDepth.set(depth, [...(byDepth.get(depth) ?? []), personId]);
  }

  const positions = new Map<string, number>();
  const nodes: TreeNode[] = [];

  for (const [depth, generation] of [...byDepth].sort((a, b) => a[0] - b[0])) {
    const seated = generation
      .filter((personId) => !spouseOnly.has(personId))
      .map((personId) => ({
        personId,
        score: barycentre(relationships, personId, positions),
      }))
      .sort((a, b) => a.score - b.score || a.personId.localeCompare(b.personId))
      .map((entry) => entry.personId);

    const ordered = seatSpouses(
      relationships,
      seated,
      generation.filter((personId) => spouseOnly.has(personId)),
    );

    ordered.forEach((personId, index) => {
      positions.set(personId, index);
      nodes.push({
        personId,
        depth,
        order: index,
        spouseOnly: spouseOnly.has(personId),
      });
    });
  }

  return nodes;
}

/**
 * Puts each spouse in the seat next to the partner they are here for.
 *
 * It happens after the rest of the generation has been ordered, because
 * "next to" is a position and nobody has one until then. A spouse with no
 * seated partner goes on the end of the row rather than nowhere.
 */
function seatSpouses(
  relationships: readonly Relationship[],
  seated: readonly string[],
  spouses: readonly string[],
): string[] {
  const ordered = [...seated];
  for (const spouse of [...spouses].sort((a, b) => a.localeCompare(b))) {
    const beside = spousesOf(relationships, spouse)
      .map((partner) => ordered.indexOf(partner))
      .filter((index) => index >= 0);
    // The minimum of nothing is Infinity, and splicing at Infinity appends,
    // which is exactly where a spouse with no seated partner belongs.
    ordered.splice(Math.min(...beside) + 1, 0, spouse);
  }
  return ordered;
}

function barycentre(
  relationships: readonly Relationship[],
  personId: string,
  positions: ReadonlyMap<string, number>,
): number {
  const placed = parentsOf(relationships, personId)
    .map((id) => positions.get(id))
    .filter((value): value is number => value !== undefined);

  if (placed.length === 0) return Number.MAX_SAFE_INTEGER;
  return placed.reduce((total, value) => total + value, 0) / placed.length;
}

function widestGeneration(nodes: readonly TreeNode[]): number {
  const counts = new Map<number, number>();
  for (const node of nodes) {
    counts.set(node.depth, (counts.get(node.depth) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

/** People a stored relationship reaches that the generation limits cut off. */
function countOmitted(
  relationships: readonly Relationship[],
  depths: ReadonlyMap<string, number>,
): number {
  const omitted = new Set<string>();
  for (const row of relationships) {
    if (depths.has(row.sourcePersonId) !== depths.has(row.targetPersonId)) {
      omitted.add(
        depths.has(row.sourcePersonId) ? row.targetPersonId : row.sourcePersonId,
      );
    }
  }
  return omitted.size;
}

/**
 * The same tree as a nested outline, for the list beside the drawing.
 *
 * Assembled from the layout's own edges, so the words and the picture
 * describe one family. It is here rather than in the component for the
 * Phase 10 gate: a component that filtered edges by relationship type
 * would be a second, untested reading of the data model.
 */
export interface OutlineBranch {
  personId: string;
  spouseIds: string[];
  children: OutlineBranch[];
}

export interface TreeOutlineModel {
  /** Root last: the recorded line of descent down to the person in focus. */
  ancestorLine: string[];
  root: OutlineBranch;
}

export function buildTreeOutline(layout: TreeLayout): TreeOutlineModel {
  const present = new Set(layout.nodes.map((node) => node.personId));

  const childrenOf = (personId: string): string[] =>
    layout.edges
      .filter(
        (edge) =>
          edge.isDescent &&
          edge.sourcePersonId === personId &&
          present.has(edge.targetPersonId),
      )
      .map((edge) => edge.targetPersonId);

  const parentOf = (personId: string): string | undefined =>
    layout.edges.find(
      (edge) =>
        edge.isDescent &&
        edge.targetPersonId === personId &&
        present.has(edge.sourcePersonId),
    )?.sourcePersonId;

  const spousesOf = (personId: string): string[] =>
    layout.edges
      .filter(
        (edge) =>
          !edge.isDescent &&
          (edge.sourcePersonId === personId || edge.targetPersonId === personId),
      )
      .map((edge) =>
        edge.sourcePersonId === personId ? edge.targetPersonId : edge.sourcePersonId,
      )
      .filter((id) => present.has(id));

  const branch = (personId: string, seen: ReadonlySet<string>): OutlineBranch => {
    const visited = new Set([...seen, personId]);
    return {
      personId,
      spouseIds: spousesOf(personId),
      children: childrenOf(personId)
        .filter((child) => !visited.has(child))
        .map((child) => branch(child, visited)),
    };
  };

  const ancestorLine: string[] = [];
  const walked = new Set([layout.rootId]);
  let current: string | undefined = layout.rootId;
  for (;;) {
    const parent: string | undefined = parentOf(current);
    if (parent === undefined || walked.has(parent)) break;
    ancestorLine.unshift(parent);
    walked.add(parent);
    current = parent;
  }
  if (ancestorLine.length > 0) ancestorLine.push(layout.rootId);

  return { ancestorLine, root: branch(layout.rootId, new Set()) };
}

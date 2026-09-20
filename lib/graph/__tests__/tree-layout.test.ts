import { describe, expect, it } from 'vitest';
import { buildFamilyTree, buildTreeOutline } from '../tree-layout';
import { CYCLE, FAMILY, relationship } from './fixtures';

/**
 * The family tree layout.
 *
 * The property the Phase 10 gate rests on is that an edge cannot exist
 * unless a relationship row does, so that is asserted from both sides:
 * every edge matches a row, and a relationship the dataset does not hold
 * (siblings, for instance) produces no edge.
 */
const ids = (layout: ReturnType<typeof buildFamilyTree>) =>
  layout.nodes.map((node) => node.personId).sort();

describe('buildFamilyTree', () => {
  it('puts the root at depth zero', () => {
    const layout = buildFamilyTree(FAMILY, 'root');
    expect(layout.nodes.find((node) => node.personId === 'root')?.depth).toBe(0);
  });

  it('counts descendants down and ancestors up', () => {
    const layout = buildFamilyTree(FAMILY, 'elder', { up: 1, down: 1 });
    const depth = (id: string) =>
      layout.nodes.find((node) => node.personId === id)?.depth;

    expect(depth('elder')).toBe(0);
    expect(depth('root')).toBe(-1);
    expect(depth('grandchild')).toBe(1);
  });

  it('stops at the generation limits it was given', () => {
    const shallow = buildFamilyTree(FAMILY, 'root', { up: 0, down: 1 });
    expect(ids(shallow)).not.toContain('grandchild');

    const deeper = buildFamilyTree(FAMILY, 'root', { up: 0, down: 2 });
    expect(ids(deeper)).toContain('grandchild');
  });

  it('counts the people the limits cut off, rather than implying completeness', () => {
    const shallow = buildFamilyTree(FAMILY, 'root', {
      up: 0,
      down: 1,
      includeSpouses: false,
    });
    // Two people are reachable by a stored row and not shown: grandchild,
    // who is elder's child, and spouse, who is root's spouse and elder's
    // other parent.
    expect(shallow.omittedCount).toBe(2);
  });

  it('reports nothing omitted when the whole family fits', () => {
    expect(buildFamilyTree(FAMILY, 'root', { up: 5, down: 5 }).omittedCount).toBe(0);
  });

  it('includes spouses at their partner’s generation, and marks them', () => {
    const layout = buildFamilyTree(FAMILY, 'root', { up: 0, down: 0 });
    const spouse = layout.nodes.find((node) => node.personId === 'spouse');
    expect(spouse?.depth).toBe(0);
    expect(spouse?.spouseOnly).toBe(true);
    expect(layout.nodes.find((node) => node.personId === 'root')?.spouseOnly).toBe(false);
  });

  it('leaves spouses out when asked to', () => {
    const layout = buildFamilyTree(FAMILY, 'root', {
      up: 0,
      down: 0,
      includeSpouses: false,
    });
    expect(ids(layout)).toEqual(['root']);
  });

  it('seats a spouse next to the partner they are here for', () => {
    const layout = buildFamilyTree(FAMILY, 'root', { up: 0, down: 0 });
    const order = (id: string) =>
      layout.nodes.find((node) => node.personId === id)?.order;
    expect(Math.abs((order('spouse') ?? 0) - (order('root') ?? 0))).toBe(1);
  });

  it('seats a spouse beside a partner who is not first in the row', () => {
    // Three siblings share a parent, so they tie on score and sort by id:
    // alpha, beta, gamma. Beta's spouse belongs at index 2, between beta
    // and gamma, which only happens if the seat is chosen from the
    // partner's position rather than from a score of its own.
    const rows = [
      relationship('parent', 'alpha'),
      relationship('parent', 'beta'),
      relationship('parent', 'gamma'),
      relationship('beta', 'partner', 'spouse'),
    ];
    const layout = buildFamilyTree(rows, 'parent', { up: 0, down: 1 });
    const order = (id: string) =>
      layout.nodes.find((node) => node.personId === id)?.order;

    expect(order('alpha')).toBe(0);
    expect(order('beta')).toBe(1);
    expect(order('partner')).toBe(2);
    expect(order('gamma')).toBe(3);
  });

  it('seats two spouses in one generation, each beside their own partner', () => {
    const rows = [
      relationship('parent', 'alpha'),
      relationship('parent', 'beta'),
      relationship('alpha', 'zara', 'spouse'),
      relationship('beta', 'mira', 'spouse'),
    ];
    const layout = buildFamilyTree(rows, 'parent', { up: 0, down: 1 });
    const order = (id: string) =>
      layout.nodes.find((node) => node.personId === id)?.order;

    expect(order('zara')).toBe((order('alpha') ?? 0) + 1);
    expect(order('mira')).toBe((order('beta') ?? 0) + 1);
  });

  it('gives every edge a stored relationship row', () => {
    const layout = buildFamilyTree(FAMILY, 'root', { up: 3, down: 3 });
    for (const edge of layout.edges) {
      const row = FAMILY.find(
        (candidate) =>
          candidate.sourcePersonId === edge.sourcePersonId &&
          candidate.targetPersonId === edge.targetPersonId &&
          candidate.relationshipType === edge.relationshipType,
      );
      expect(row, `${edge.sourcePersonId} -> ${edge.targetPersonId}`).toBeDefined();
    }
    expect(layout.edges.length).toBe(FAMILY.length);
  });

  it('draws no edge for a relationship the dataset does not record', () => {
    // elder and younger are siblings, which is computed elsewhere and
    // stored nowhere. An edge between them would be the picture asserting
    // something the data does not.
    const layout = buildFamilyTree(FAMILY, 'root', { up: 3, down: 3 });
    const between = layout.edges.filter(
      (edge) =>
        [edge.sourcePersonId, edge.targetPersonId].includes('elder') &&
        [edge.sourcePersonId, edge.targetPersonId].includes('younger'),
    );
    expect(between).toEqual([]);
  });

  it('carries each edge’s confidence and verses, so the picture can show them', () => {
    const [edge] = buildFamilyTree(FAMILY, 'root', { up: 0, down: 1 }).edges;
    expect(edge?.confidence).toBe('EXPLICIT');
    expect(edge?.sourceReferences).toEqual(['GEN.5.1']);
  });

  it('drops an edge with one end outside the tree', () => {
    const layout = buildFamilyTree(FAMILY, 'root', {
      up: 0,
      down: 1,
      includeSpouses: false,
    });
    const reaches = layout.edges.flatMap((edge) => [
      edge.sourcePersonId,
      edge.targetPersonId,
    ]);
    expect(reaches).not.toContain('grandchild');
  });

  it('reports the shape of the canvas it needs', () => {
    const layout = buildFamilyTree(FAMILY, 'root', { up: 0, down: 2 });
    expect(layout.depthRange).toEqual([0, 2]);
    // root and spouse at depth 0; elder and younger at depth 1.
    expect(layout.width).toBe(2);
  });

  it('handles a person with no relationships at all', () => {
    const layout = buildFamilyTree(FAMILY, 'orphan', { up: 2, down: 2 });
    expect(ids(layout)).toEqual(['orphan']);
    expect(layout.edges).toEqual([]);
    expect(layout.depthRange).toEqual([0, 0]);
    expect(layout.width).toBe(1);
  });

  it('terminates on a parent cycle rather than hanging', () => {
    const layout = buildFamilyTree(CYCLE, 'loop-a', { up: 10, down: 10 });
    expect(ids(layout)).toEqual(['loop-a', 'loop-b']);
  });

  it('is the same layout every time it is computed', () => {
    const once = buildFamilyTree(FAMILY, 'root', { up: 2, down: 2 });
    const twice = buildFamilyTree([...FAMILY].reverse(), 'root', { up: 2, down: 2 });
    expect(twice.nodes).toEqual(once.nodes);
  });

  it('orders a generation by where its parents sit', () => {
    // Two parents in fixed positions, each with one child. The children
    // must come out in the same order as the parents, not alphabetically.
    const family = [
      relationship('alpha', 'zed'),
      relationship('omega', 'abe'),
      relationship('top', 'alpha'),
      relationship('top', 'omega'),
    ];
    const layout = buildFamilyTree(family, 'top', { up: 0, down: 2 });
    const order = (id: string) =>
      layout.nodes.find((node) => node.personId === id)?.order;

    expect(order('alpha')).toBeLessThan(order('omega') ?? 0);
    expect(order('zed')).toBeLessThan(order('abe') ?? 0);
  });
});

describe('buildTreeOutline', () => {
  it('nests descendants under the person they descend from', () => {
    const outline = buildTreeOutline(buildFamilyTree(FAMILY, 'root', { up: 0, down: 2 }));
    expect(outline.root.personId).toBe('root');
    expect(outline.root.children.map((child) => child.personId).sort()).toEqual([
      'elder',
      'younger',
    ]);
    const elder = outline.root.children.find((child) => child.personId === 'elder');
    expect(elder?.children.map((child) => child.personId)).toEqual(['grandchild']);
  });

  it('names a spouse the same whichever side of the row records the marriage', () => {
    // FAMILY stores the marriage as root → spouse. Asking from the other
    // end has to give the same answer, or the outline would depend on
    // which way round the record happens to be written.
    const outline = buildTreeOutline(
      buildFamilyTree(FAMILY, 'spouse', { up: 0, down: 0 }),
    );
    expect(outline.root.spouseIds).toEqual(['root']);
  });

  it('names the spouses beside the person, not as children', () => {
    const outline = buildTreeOutline(buildFamilyTree(FAMILY, 'root', { up: 0, down: 1 }));
    expect(outline.root.spouseIds).toEqual(['spouse']);
    expect(outline.root.children.map((child) => child.personId)).not.toContain('spouse');
  });

  it('gives the recorded line of descent down to the person in focus', () => {
    const outline = buildTreeOutline(
      buildFamilyTree(FAMILY, 'grandchild', { up: 3, down: 0 }),
    );
    expect(outline.ancestorLine).toEqual(['root', 'elder', 'grandchild']);
  });

  it('has no line to give when no parent is in view', () => {
    const outline = buildTreeOutline(buildFamilyTree(FAMILY, 'root', { up: 0, down: 1 }));
    expect(outline.ancestorLine).toEqual([]);
  });

  it('does not recurse for ever on a cycle', () => {
    const outline = buildTreeOutline(
      buildFamilyTree(CYCLE, 'loop-a', { up: 2, down: 2 }),
    );
    expect(outline.root.personId).toBe('loop-a');
    expect(outline.root.children.map((child) => child.personId)).toEqual(['loop-b']);
    expect(outline.root.children[0]?.children).toEqual([]);
  });

  it('marks descent and marriage apart, so the drawing need not know the difference', () => {
    const layout = buildFamilyTree(FAMILY, 'root', { up: 0, down: 1 });
    const spouseEdge = layout.edges.find((edge) => edge.relationshipType === 'spouse');
    const parentEdge = layout.edges.find((edge) => edge.relationshipType === 'parent');
    expect(spouseEdge?.isDescent).toBe(false);
    expect(parentEdge?.isDescent).toBe(true);
  });
});

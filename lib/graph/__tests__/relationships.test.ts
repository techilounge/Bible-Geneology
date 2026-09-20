import { describe, expect, it } from 'vitest';
import {
  ancestorsOf,
  childrenOf,
  descendantsOf,
  generationDepths,
  getAncestorPath,
  getDescendantPath,
  getGenerationDistance,
  getRelationshipPath,
  parentsOf,
  siblingsOf,
  spousesOf,
} from '../relationships';
import { CYCLE, FAMILY, relationship } from './fixtures';

describe('immediate relations', () => {
  it('reads parents off the stored parent edges', () => {
    expect(parentsOf(FAMILY, 'elder').sort()).toEqual(['root', 'spouse']);
    expect(parentsOf(FAMILY, 'root')).toEqual([]);
  });

  it('reads children off the same edges in the other direction', () => {
    expect(childrenOf(FAMILY, 'root').sort()).toEqual(['elder', 'younger']);
    expect(childrenOf(FAMILY, 'grandchild')).toEqual([]);
  });

  it('treats a spouse edge as undirected', () => {
    expect(spousesOf(FAMILY, 'root')).toEqual(['spouse']);
    expect(spousesOf(FAMILY, 'spouse')).toEqual(['root']);
  });

  it('does not report a spouse as a parent', () => {
    expect(parentsOf(FAMILY, 'spouse')).toEqual([]);
  });

  it('computes siblings from a shared parent rather than storing them', () => {
    expect(siblingsOf(FAMILY, 'elder')).toEqual(['younger']);
    expect(siblingsOf(FAMILY, 'younger')).toEqual(['elder']);
  });

  it('does not make a person their own sibling', () => {
    expect(siblingsOf(FAMILY, 'grandchild')).toEqual([]);
  });

  it('reports each half-sibling once, not once per shared parent', () => {
    // elder has two parents; younger shares only one of them.
    const graph = [...FAMILY, relationship('spouse', 'younger')];
    expect(siblingsOf(graph, 'elder')).toEqual(['younger']);
  });
});

describe('transitive relations', () => {
  it('walks the whole ancestry, not just the first generation', () => {
    expect([...ancestorsOf(FAMILY, 'grandchild')].sort()).toEqual([
      'elder',
      'root',
      'spouse',
    ]);
  });

  it('walks the whole descent', () => {
    expect([...descendantsOf(FAMILY, 'root')].sort()).toEqual([
      'elder',
      'grandchild',
      'younger',
    ]);
  });

  it('excludes the person themselves from their own ancestry', () => {
    expect(ancestorsOf(FAMILY, 'root').has('root')).toBe(false);
  });

  it('terminates on a parent cycle rather than hanging', () => {
    expect([...ancestorsOf(CYCLE, 'loop-a')].sort()).toEqual(['loop-a', 'loop-b']);
    expect([...descendantsOf(CYCLE, 'loop-a')].sort()).toEqual(['loop-a', 'loop-b']);
  });
});

describe('paths', () => {
  it('returns the chain up to an ancestor, inclusive of both ends', () => {
    expect(getAncestorPath(FAMILY, 'grandchild', 'root')).toEqual([
      'grandchild',
      'elder',
      'root',
    ]);
  });

  it('returns the chain down to a descendant', () => {
    expect(getDescendantPath(FAMILY, 'root', 'grandchild')).toEqual([
      'root',
      'elder',
      'grandchild',
    ]);
  });

  it('returns a single-element path when both ends are the same person', () => {
    expect(getAncestorPath(FAMILY, 'root', 'root')).toEqual(['root']);
  });

  it('returns null when no line of descent connects the two', () => {
    expect(getAncestorPath(FAMILY, 'root', 'grandchild')).toBeNull();
    expect(getAncestorPath(FAMILY, 'elder', 'younger')).toBeNull();
  });

  it('returns null for someone who is not in the graph at all', () => {
    expect(getAncestorPath(FAMILY, 'nobody', 'root')).toBeNull();
  });

  it('finds a path through relationships of mixed type and direction', () => {
    const path = getRelationshipPath(FAMILY, 'grandchild', 'younger');
    expect(path).not.toBeNull();
    expect(path?.map((e) => e.to)).toEqual(['elder', 'root', 'younger']);
    expect(path?.map((e) => e.type)).toEqual(['child', 'child', 'parent']);
  });

  it('inverts an edge traversed against its stored direction', () => {
    const path = getRelationshipPath(FAMILY, 'elder', 'root');
    expect(path?.[0]).toEqual({ from: 'elder', to: 'root', type: 'child' });
  });

  it('returns an empty path from a person to themselves', () => {
    expect(getRelationshipPath(FAMILY, 'root', 'root')).toEqual([]);
  });

  it('returns null when the two are in unconnected parts of the graph', () => {
    const graph = [...FAMILY, relationship('stranger', 'stranger-child')];
    expect(getRelationshipPath(graph, 'root', 'stranger')).toBeNull();
  });

  it('takes the shortest path when more than one exists', () => {
    // spouse reaches grandchild directly as a parent, and also via root.
    const path = getRelationshipPath(FAMILY, 'spouse', 'grandchild');
    expect(path).toHaveLength(2);
  });
});

describe('generation distance', () => {
  it('counts parent edges along a direct line', () => {
    expect(getGenerationDistance(FAMILY, 'root', 'grandchild')).toBe(2);
  });

  it('is symmetric on a direct line', () => {
    expect(getGenerationDistance(FAMILY, 'grandchild', 'root')).toBe(2);
  });

  it('is zero between a person and themselves', () => {
    expect(getGenerationDistance(FAMILY, 'root', 'root')).toBe(0);
  });

  it('measures through the nearest common ancestor off the direct line', () => {
    // elder and younger are both one step from root.
    expect(getGenerationDistance(FAMILY, 'elder', 'younger')).toBe(2);
  });

  it('returns null when the two share no ancestor', () => {
    const graph = [...FAMILY, relationship('stranger', 'stranger-child')];
    expect(getGenerationDistance(graph, 'root', 'stranger')).toBeNull();
  });
});

describe('generation depths', () => {
  it('measures depth from the earliest ancestor', () => {
    const depths = generationDepths(FAMILY);
    expect(depths.get('root')).toBe(0);
    expect(depths.get('spouse')).toBe(0);
    expect(depths.get('elder')).toBe(1);
    expect(depths.get('younger')).toBe(1);
    expect(depths.get('grandchild')).toBe(2);
  });

  it('takes the longest line when a person has parents at different depths', () => {
    // grandchild via elder is 2; add a direct edge from root and it stays 2,
    // because depth is the deepest line, not the shallowest.
    const depths = generationDepths([...FAMILY, relationship('root', 'grandchild')]);
    expect(depths.get('grandchild')).toBe(2);
  });

  it('covers everyone who appears on any edge', () => {
    const depths = generationDepths(FAMILY);
    expect([...depths.keys()].sort()).toEqual([
      'elder',
      'grandchild',
      'root',
      'spouse',
      'younger',
    ]);
  });

  it('terminates on a cycle rather than recursing forever', () => {
    const depths = generationDepths(CYCLE);
    expect(depths.size).toBe(2);
  });
});

/**
 * A diamond: two lines of descent converging on one person. Genealogies do
 * this constantly, and the shortest-path and depth calculations both have a
 * branch that only a diamond reaches.
 *
 *   founder ─┬─ branch-a ─┬─ heir
 *            └─ branch-b ─┘
 */
const DIAMOND = [
  relationship('founder', 'branch-a'),
  relationship('founder', 'branch-b'),
  relationship('branch-a', 'heir'),
  relationship('branch-b', 'heir'),
];

describe('converging lines of descent', () => {
  it('counts a shared ancestor once', () => {
    expect([...ancestorsOf(DIAMOND, 'heir')].sort()).toEqual([
      'branch-a',
      'branch-b',
      'founder',
    ]);
  });

  it('counts a shared descendant once', () => {
    expect([...descendantsOf(DIAMOND, 'founder')].sort()).toEqual([
      'branch-a',
      'branch-b',
      'heir',
    ]);
  });

  it('measures the distance to the nearer of two common ancestors', () => {
    // branch-a and branch-b meet at founder, one step up from each.
    expect(getGenerationDistance(DIAMOND, 'branch-a', 'branch-b')).toBe(2);
  });

  it('takes the shorter line when a cousin pair has two meeting points', () => {
    const graph = [...DIAMOND, relationship('branch-a', 'branch-b')];
    // branch-b is now both a child of branch-a and its sibling; the direct
    // line wins.
    expect(getGenerationDistance(graph, 'branch-a', 'branch-b')).toBe(1);
  });

  it('gives an heir the depth of their longest line, not their shortest', () => {
    const graph = [...DIAMOND, relationship('founder', 'heir')];
    expect(generationDepths(graph).get('heir')).toBe(2);
  });
});

describe('revisiting a person reached by more than one line', () => {
  it('does not queue a shared ancestor twice when finding a path', () => {
    expect(getAncestorPath(DIAMOND, 'heir', 'founder')).toEqual([
      'heir',
      'branch-a',
      'founder',
    ]);
  });

  it('takes the nearest meeting point when two lines meet at different depths', () => {
    // 'other' descends from founder directly and from branch-a as well, so
    // the search meets heir's ancestry twice and must keep the shorter.
    const graph = [
      ...DIAMOND,
      relationship('founder', 'other'),
      relationship('branch-a', 'other'),
    ];
    expect(getGenerationDistance(graph, 'heir', 'other')).toBe(2);
  });
});

describe('the relationship path over non-descent edges', () => {
  it('names the inverse of each directional relationship type', () => {
    const graph = [
      relationship('rabbi', 'student', 'teacher'),
      relationship('student', 'rabbi', 'disciple'),
      relationship('first', 'second', 'successor'),
      relationship('second', 'first', 'predecessor'),
    ];
    // Traversed against their stored direction, each type inverts.
    expect(getRelationshipPath(graph, 'student', 'rabbi')?.[0]?.type).toBe('disciple');
    expect(getRelationshipPath(graph, 'second', 'first')?.[0]?.type).toBe('predecessor');
  });

  it('inverts a child edge back to parent', () => {
    // 'child' is derivable rather than stored, so the canonical dataset
    // holds none. The inverse is defined anyway, because an import or a
    // future source may carry one and a silent wrong label is worse.
    const graph = [relationship('kid', 'elder', 'child')];
    expect(getRelationshipPath(graph, 'elder', 'kid')?.[0]?.type).toBe('parent');
  });

  it('leaves a symmetric type alone when inverted', () => {
    const graph = [relationship('a', 'b', 'spouse')];
    expect(getRelationshipPath(graph, 'b', 'a')?.[0]?.type).toBe('spouse');
  });

  it('returns null when the starting person has no edges at all', () => {
    expect(getRelationshipPath([], 'a', 'b')).toBeNull();
  });

  it('keeps the first of two equally short meeting points', () => {
    const graph = [
      ...DIAMOND,
      relationship('founder', 'other'),
      relationship('branch-a', 'other'),
      relationship('branch-b', 'other'),
    ];
    // branch-a and branch-b are both one step from heir, so the second of
    // them is not an improvement and must not replace the first.
    expect(getGenerationDistance(graph, 'heir', 'other')).toBe(2);
  });
});

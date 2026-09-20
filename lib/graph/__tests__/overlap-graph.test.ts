import { describe, expect, it } from 'vitest';
import type { PersonChronology } from '@/lib/domain';
import { buildOverlapGraph, getOverlapChain } from '../overlap-graph';

/**
 * A chain of lifetimes where nobody overlaps their grandparent:
 *
 *   a   0 ──── 50
 *   b        40 ──── 90
 *   c              80 ──── 130
 *   d                   120 ──── 170
 *   touching        50 ──── 60      born exactly when a dies
 *   undated          ?
 */
function record(
  personId: string,
  birthYear: number | null,
  deathYear: number | null,
): PersonChronology {
  return {
    personId,
    chronologyId: 'fixture',
    birthYear,
    deathYear,
    lifespan: birthYear !== null && deathYear !== null ? deathYear - birthYear : null,
    birthConfidence: birthYear === null ? 'UNKNOWN' : 'DERIVED',
    deathConfidence: deathYear === null ? 'UNKNOWN' : 'DERIVED',
    lifespanConfidence: birthYear === null ? 'UNKNOWN' : 'DERIVED',
    birthSourceType: birthYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    deathSourceType: deathYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    lifespanSourceType: birthYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    sourceReferences: birthYear === null ? [] : ['GEN.5.1'],
    calculationMethod: null,
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

const RECORDS = [
  record('a', 0, 50),
  record('b', 40, 90),
  record('c', 80, 130),
  record('d', 120, 170),
  record('touching', 50, 60),
  record('undated', null, null),
];

const graph = buildOverlapGraph(RECORDS);

describe('buildOverlapGraph', () => {
  it('includes only people whose lifetimes are dated', () => {
    expect(graph.nodes).not.toContain('undated');
    expect(graph.nodes).toHaveLength(5);
  });

  it('orders nodes by birth year', () => {
    expect(graph.nodes).toEqual(['a', 'b', 'touching', 'c', 'd']);
  });

  it('connects lifetimes that genuinely overlap', () => {
    expect(graph.neighbours.get('a')).toEqual(['b']);
    expect(graph.neighbours.get('b')?.sort()).toEqual(['a', 'c', 'touching']);
  });

  it('does not connect lifetimes that only touch at a year boundary', () => {
    // 'touching' is born in the year 'a' dies. Half-open intervals give zero
    // years, and zero years is not an overlap.
    expect(graph.neighbours.get('touching')).not.toContain('a');
    expect(graph.neighbours.get('a')).not.toContain('touching');
  });

  it('does not connect people two generations apart', () => {
    expect(graph.neighbours.get('a')).not.toContain('c');
  });

  it('is symmetric', () => {
    for (const [person, neighbours] of graph.neighbours) {
      for (const neighbour of neighbours) {
        expect(graph.neighbours.get(neighbour)).toContain(person);
      }
    }
  });

  it('handles an empty dataset', () => {
    const empty = buildOverlapGraph([]);
    expect(empty.nodes).toEqual([]);
    expect(empty.neighbours.size).toBe(0);
  });
});

describe('getOverlapChain', () => {
  it('finds the shortest chain of overlapping lifetimes', () => {
    expect(getOverlapChain(graph, 'a', 'd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is a single step when the two overlap directly', () => {
    expect(getOverlapChain(graph, 'a', 'b')).toEqual(['a', 'b']);
  });

  it('returns the person alone when both ends are the same', () => {
    expect(getOverlapChain(graph, 'a', 'a')).toEqual(['a']);
  });

  it('returns null for someone with no dates, rather than an empty chain', () => {
    expect(getOverlapChain(graph, 'a', 'undated')).toBeNull();
    expect(getOverlapChain(graph, 'undated', 'a')).toBeNull();
  });

  it('returns null for someone not in the dataset', () => {
    expect(getOverlapChain(graph, 'a', 'nobody')).toBeNull();
  });

  it('returns null when no chain connects the two', () => {
    const disjoint = buildOverlapGraph([
      record('early', 0, 10),
      record('late', 500, 510),
    ]);
    expect(getOverlapChain(disjoint, 'early', 'late')).toBeNull();
  });
});

describe('a life of zero recorded length', () => {
  it('is a node but overlaps nobody', () => {
    // Born and dead in the same year. Half-open intervals give it no extent,
    // so it connects to no one, and it still belongs on the graph because
    // the text recorded the person.
    const graph = buildOverlapGraph([record('long', 0, 50), record('brief', 0, 0)]);
    expect(graph.nodes.sort()).toEqual(['brief', 'long']);
    expect(graph.neighbours.get('brief')).toEqual([]);
    expect(graph.neighbours.get('long')).toEqual([]);
  });
});

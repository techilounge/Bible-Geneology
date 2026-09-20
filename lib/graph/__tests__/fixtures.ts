import type { Relationship } from '@/lib/domain';

/**
 * A relationship graph with the shapes that break naive traversal:
 *
 *   root ─┬─ elder ── grandchild
 *         └─ younger
 *   spouse — root
 *   orphan                       no edges of any kind
 *   loop-a ── loop-b ── loop-a   a parent cycle, which must not hang
 *
 * The cycle is not something the canonical dataset contains. It is here
 * because a genealogy tool that hangs on bad input is worse than one that
 * reports it, and the validator's cycle check is only trustworthy if the
 * traversal underneath it terminates.
 */
export function relationship(
  source: string,
  target: string,
  relationshipType: Relationship['relationshipType'] = 'parent',
): Relationship {
  return {
    sourcePersonId: source,
    targetPersonId: target,
    relationshipType,
    sourceReferences: ['GEN.5.1'],
    confidence: 'EXPLICIT',
    sourceType: 'SCRIPTURE_EXPLICIT',
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

export const FAMILY: Relationship[] = [
  relationship('root', 'elder'),
  relationship('root', 'younger'),
  relationship('elder', 'grandchild'),
  relationship('spouse', 'elder'),
  relationship('root', 'spouse', 'spouse'),
];

export const CYCLE: Relationship[] = [
  relationship('loop-a', 'loop-b'),
  relationship('loop-b', 'loop-a'),
];

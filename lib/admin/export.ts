/**
 * Turning reviewed database rows back into canonical files.
 *
 * Git is the system of record (ARCHITECTURE.md section 3), and it stays
 * that way: the CMS is where a change is proposed and reviewed, and the
 * export is how a reviewed change gets back into the repository where it
 * can be read as a diff before anybody merges it.
 *
 * Two rules, both here rather than in the script, so they can be tested
 * without a database:
 *
 *   1. Only a VERIFIED row is exported. Requirement section 8: only
 *      verified data reaches production calculations, and the canonical
 *      files are what production calculates from.
 *   2. A row that is not VERIFIED does not remove what the file already
 *      says. An export is an addition to the record, never a truncation
 *      of it.
 */
export interface CanonicalPerson {
  id: string;
  canonicalName: string;
  slug: string;
  gender: string | null;
  description: string | null;
  eraId: string | null;
  sortOrder: number | null;
  primaryScriptureReferences: string[];
  reviewStatus: string;
}

export interface CanonicalRelationship {
  sourcePersonId: string;
  targetPersonId: string;
  relationshipType: string;
  sourceReferences: string[];
  confidence: string;
  sourceType: string;
  notes: string | null;
  reviewStatus: string;
}

type Row = Readonly<Record<string, unknown>>;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const integer = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

export function canonicalPerson(
  row: Row,
  references: readonly string[],
): CanonicalPerson {
  return {
    id: String(row.id),
    canonicalName: String(row.canonical_name),
    slug: String(row.slug),
    gender: text(row.gender),
    description: text(row.description),
    eraId: text(row.era_id),
    sortOrder: integer(row.sort_order),
    primaryScriptureReferences: [...references].sort(),
    reviewStatus: String(row.review_status),
  };
}

export function canonicalRelationship(
  row: Row,
  references: readonly string[],
): CanonicalRelationship {
  return {
    sourcePersonId: String(row.source_person_id),
    targetPersonId: String(row.target_person_id),
    relationshipType: String(row.relationship_type),
    sourceReferences: [...references].sort(),
    confidence: String(row.confidence),
    sourceType: String(row.source_type),
    notes: text(row.notes),
    reviewStatus: String(row.review_status),
  };
}

export const isVerified = (row: Row): boolean => row.review_status === 'VERIFIED';

export interface MergeResult<T> {
  merged: T[];
  replaced: string[];
  added: string[];
}

/**
 * Folds exported records into what the file already holds.
 *
 * Existing order is preserved, because a diff where every line moved is
 * a diff nobody reads. New records are appended in key order.
 */
export function mergeCanonical<T>(
  existing: readonly T[],
  updates: readonly T[],
  keyOf: (record: T) => string,
): MergeResult<T> {
  const byKey = new Map(updates.map((record) => [keyOf(record), record]));
  const replaced: string[] = [];
  const merged = existing.map((record) => {
    const key = keyOf(record);
    const update = byKey.get(key);
    if (update === undefined) return record;
    byKey.delete(key);
    if (JSON.stringify(update) === JSON.stringify(record)) return record;
    replaced.push(key);
    return update;
  });

  const added = [...byKey.keys()].sort();
  for (const key of added) {
    const record = byKey.get(key);
    /* v8 ignore next -- @preserve: the key came from this map a line ago. */
    if (record !== undefined) merged.push(record);
  }

  return { merged, replaced, added };
}

/** The key a relationship is identified by, which is the pair and the type. */
export const relationshipKey = (record: CanonicalRelationship): string =>
  `${record.sourcePersonId}|${record.targetPersonId}|${record.relationshipType}`;

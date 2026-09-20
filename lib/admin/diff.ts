/**
 * What actually changed, for the audit history to show.
 *
 * The database writes the audit row; this reads it back into something a
 * person can scan. `updated_at` and `updated_by` change on every write
 * and say nothing about the edit, so they are left out — the same two
 * the trigger ignores when deciding whether a write changed anything at
 * all.
 */
export interface FieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

const IGNORED = new Set(['updated_at', 'updated_by', 'created_at', 'created_by']);

/** A value as a reviewer would read it, rather than as JSON. */
export function readable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function changedFields(
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
): FieldChange[] {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];
  for (const field of [...fields].sort()) {
    if (IGNORED.has(field)) continue;
    const from = readable(before?.[field]);
    const to = readable(after?.[field]);
    if (from === to) continue;
    changes.push({ field, before: from, after: to });
  }
  return changes;
}

/** One line for a history row: "3 fields changed", or what it was. */
export function summariseChange(action: string, changes: readonly FieldChange[]): string {
  if (action === 'insert') return 'Record created';
  if (action === 'delete') return 'Record deleted';
  if (changes.length === 0) return 'No fields changed';
  if (changes.length === 1) return `${changes[0]?.field} changed`;
  return `${changes.length} fields changed`;
}

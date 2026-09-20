/**
 * What the CMS is allowed to edit, named field by field.
 *
 * An editor posts a form, and a form is just a POST: anybody who can
 * reach the route can put any field name in it. So the writable surface
 * is a list rather than "whatever arrived", and a field that is not on
 * the list is dropped rather than written. That keeps `id`, `slug`,
 * `created_by` and every audit column out of reach of a hand-written
 * post, and it keeps the review columns — `review_status`,
 * `revision_notes`, `verification` — under the rules in `rules.ts`
 * rather than settable as ordinary fields.
 */
export type FieldKind = 'text' | 'longtext' | 'integer' | 'enum';

export interface EditableField {
  name: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
}

export interface EditableTable {
  /** The table name, which is also its segment in the address. */
  name: string;
  label: string;
  /** The column that identifies a row. */
  key: string;
  /** A human label for a row, for the queue and the history. */
  display: string;
  fields: readonly EditableField[];
}

const CONFIDENCE = ['EXPLICIT', 'DERIVED', 'INFERRED', 'DISPUTED', 'UNKNOWN'] as const;
const SOURCE_TYPE = [
  'SCRIPTURE_EXPLICIT',
  'SCRIPTURE_DERIVED',
  'SCHOLARLY',
  'TRADITION',
  'UNKNOWN',
] as const;

export const EDITABLE_TABLES: readonly EditableTable[] = [
  {
    name: 'people',
    label: 'People',
    key: 'id',
    display: 'canonical_name',
    fields: [
      { name: 'canonical_name', label: 'Canonical name', kind: 'text' },
      { name: 'description', label: 'Description', kind: 'longtext' },
    ],
  },
  {
    name: 'person_chronology',
    label: 'Chronology',
    key: 'person_id',
    display: 'person_id',
    fields: [
      { name: 'birth_year', label: 'Birth year', kind: 'integer' },
      { name: 'death_year', label: 'Death year', kind: 'integer' },
      { name: 'lifespan', label: 'Lifespan', kind: 'integer' },
      {
        name: 'birth_confidence',
        label: 'Birth confidence',
        kind: 'enum',
        options: CONFIDENCE,
      },
      {
        name: 'birth_source_type',
        label: 'Birth source',
        kind: 'enum',
        options: SOURCE_TYPE,
      },
      { name: 'supplied_by', label: 'Supplied by', kind: 'text' },
    ],
  },
] as const;

export const tableByName = (name: string): EditableTable | null =>
  EDITABLE_TABLES.find((table) => table.name === name) ?? null;

export interface FieldValues {
  values: Record<string, string | number | null>;
  /** Fields that were posted but are not editable, or could not be read. */
  rejected: string[];
}

/**
 * Reads a posted form into the fields this table actually has.
 *
 * Anything not on the list is rejected rather than ignored quietly, so
 * the page can say so and a test can assert it. An integer field that
 * is not an integer is rejected for the same reason: writing 0 for
 * "twelvety" would be inventing a number, which is the one thing this
 * whole product is built not to do.
 */
export function readFields(
  table: EditableTable,
  posted: Readonly<Record<string, string>>,
): FieldValues {
  const values: Record<string, string | number | null> = {};
  const rejected: string[] = [];
  const known = new Map(table.fields.map((field) => [field.name, field]));

  for (const [name, raw] of Object.entries(posted)) {
    const field = known.get(name);
    if (!field) {
      rejected.push(name);
      continue;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      values[name] = null;
      continue;
    }

    if (field.kind === 'integer') {
      if (!/^-?\d+$/.test(trimmed)) {
        rejected.push(name);
        continue;
      }
      values[name] = Number.parseInt(trimmed, 10);
      continue;
    }

    if (field.kind === 'enum' && !field.options?.includes(trimmed)) {
      rejected.push(name);
      continue;
    }

    values[name] = trimmed;
  }

  return { values, rejected };
}

/** The sources a reviewer typed, one per line, blanks dropped. */
export function readSources(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

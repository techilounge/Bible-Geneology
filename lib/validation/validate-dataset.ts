import {
  CONFIDENCE_LEVELS,
  REVIEW_STATUSES,
  type ConfidenceLevel,
  type ReviewStatus,
} from '@/lib/domain/enums';
import {
  AssumptionSchema,
  ChronologySchema,
  EventSchema,
  PersonSchema,
  RelationshipSchema,
  ScriptureReferenceSchema,
  SourceSchema,
} from '@/lib/domain/schemas';

export type Severity = 'severe' | 'warning';

export interface Finding {
  severity: Severity;
  check: string;
  subject: string;
  message: string;
}

export interface CanonicalFiles {
  people: unknown[];
  personNames: unknown[];
  relationships: unknown[];
  chronologies: unknown[];
  personChronology: unknown[];
  /** One entry per alternate chronology, keyed by its id. */
  chronologyOverrides?: Record<string, unknown>;
  events: unknown[];
  eventChronology: unknown[];
  scriptureReferences: unknown[];
  sources: unknown[];
  assumptions: unknown[];
  eras: unknown[];
}

/**
 * Validates the canonical dataset. Pure: it takes parsed JSON and returns
 * findings, so it is testable without a filesystem and reusable from the CLI,
 * from CI, and from the Phase 14 admin tooling.
 *
 * Severity decides the build. A severe finding fails it; a warning is reported
 * and does not.
 */
export function validateDataset(files: CanonicalFiles): Finding[] {
  const findings: Finding[] = [];
  const severe = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'severe', check, subject, message });
  const warn = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'warning', check, subject, message });

  // --- shape ---------------------------------------------------------------
  const parseAll = <T>(
    label: string,
    rows: unknown[],
    schema: {
      safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown };
    },
  ): T[] => {
    const out: T[] = [];
    rows.forEach((row, index) => {
      const result = schema.safeParse(row);
      if (result.success && result.data !== undefined) {
        out.push(result.data);
      } else {
        severe('schema', `${label}[${index}]`, describeZodError(result.error));
      }
    });
    return out;
  };

  const people = parseAll('people', files.people, PersonSchema);
  const relationships = parseAll(
    'relationships',
    files.relationships,
    RelationshipSchema,
  );
  const chronologies = parseAll('chronologies', files.chronologies, ChronologySchema);
  const references = parseAll(
    'scriptureReferences',
    files.scriptureReferences,
    ScriptureReferenceSchema,
  );
  const sources = parseAll('sources', files.sources, SourceSchema);
  const assumptions = parseAll('assumptions', files.assumptions, AssumptionSchema);
  const events = parseAll('events', files.events, EventSchema);

  const personIds = new Set(people.map((p) => p.id));
  const chronologyIds = new Set(chronologies.map((c) => c.id));
  const referenceIds = new Set(references.map((r) => r.id));
  const assumptionIds = new Set(assumptions.map((a) => a.id));
  const eraIds = new Set(
    (files.eras as Array<{ id?: string }>)
      .map((e) => e.id)
      .filter((id): id is string => !!id),
  );
  const sourceIds = new Set(sources.map((s) => s.id));

  // --- duplicates ----------------------------------------------------------
  duplicates(people.map((p) => p.id)).forEach((id) =>
    severe('duplicate-person', id, 'Two people share this identifier'),
  );
  duplicates(references.map((r) => r.id)).forEach((id) =>
    severe('duplicate-reference', id, 'Two scripture references share this identifier'),
  );

  // --- referential integrity ----------------------------------------------
  for (const person of people) {
    if (person.eraId && !eraIds.has(person.eraId)) {
      severe('missing-era', person.id, `Unknown era ${person.eraId}`);
    }
    for (const ref of person.primaryScriptureReferences) {
      if (!referenceIds.has(ref)) {
        severe('missing-reference', person.id, `Unknown scripture reference ${ref}`);
      }
    }
    if (person.primaryScriptureReferences.length === 0) {
      warn('no-reference', person.id, 'Person has no scripture reference');
    }
  }

  for (const chronology of chronologies) {
    if (chronology.sourceId && !sourceIds.has(chronology.sourceId)) {
      severe('missing-source', chronology.id, `Unknown source ${chronology.sourceId}`);
    }
  }
  if (chronologies.filter((c) => c.isDefault).length !== 1) {
    severe(
      'default-chronology',
      'chronologies',
      'Exactly one chronology must be the default',
    );
  }

  for (const [index, rel] of relationships.entries()) {
    const subject = `${rel.sourcePersonId} -> ${rel.targetPersonId} (${rel.relationshipType})`;
    if (!personIds.has(rel.sourcePersonId)) {
      severe('missing-person', subject, `Unknown person ${rel.sourcePersonId}`);
    }
    if (!personIds.has(rel.targetPersonId)) {
      severe('missing-person', subject, `Unknown person ${rel.targetPersonId}`);
    }
    for (const ref of rel.sourceReferences) {
      if (!referenceIds.has(ref)) {
        severe('missing-reference', subject, `Unknown scripture reference ${ref}`);
      }
    }
    if (
      (rel.relationshipType === 'ancestor' ||
        rel.relationshipType === 'descendant' ||
        rel.relationshipType === 'child') &&
      !rel.notes
    ) {
      severe(
        'derivable-relationship',
        subject,
        'Transitive relationships are computed from parent edges; storing one requires a note explaining why it is not derivable',
      );
    }
    if (index !== relationships.findIndex((r) => sameEdge(r, rel))) {
      severe('duplicate-relationship', subject, 'Duplicate relationship record');
    }
  }

  // --- ancestry cycles -----------------------------------------------------
  for (const cycle of findParentCycles(relationships)) {
    severe('parent-cycle', cycle.join(' -> '), 'Parent relationships form a cycle');
  }

  // --- orphans -------------------------------------------------------------
  const connected = new Set<string>();
  for (const rel of relationships) {
    connected.add(rel.sourcePersonId);
    connected.add(rel.targetPersonId);
  }
  for (const person of people) {
    if (!connected.has(person.id)) {
      warn('orphan-person', person.id, 'Person has no relationship to anyone');
    }
  }

  // --- events --------------------------------------------------------------
  for (const event of events) {
    for (const pid of event.relatedPersonIds) {
      if (!personIds.has(pid)) {
        severe('missing-person', event.id, `Unknown person ${pid}`);
      }
    }
    for (const ref of event.sourceReferences) {
      if (!referenceIds.has(ref)) {
        severe('missing-reference', event.id, `Unknown scripture reference ${ref}`);
      }
    }
  }

  // --- assumptions ---------------------------------------------------------
  for (const assumption of assumptions) {
    for (const ref of assumption.sourceReferences) {
      if (!referenceIds.has(ref)) {
        severe('missing-reference', assumption.id, `Unknown scripture reference ${ref}`);
      }
    }
  }

  // --- chronology input ----------------------------------------------------
  const ctx: InputContext = { personIds, chronologyIds, referenceIds, assumptionIds };
  findings.push(...validateChronologyInput(files.personChronology, ctx));
  findings.push(
    ...validateEventChronologyInput(files.eventChronology, {
      ...ctx,
      eventIds: new Set(events.map((e) => e.id)),
    }),
  );

  for (const [chronologyId, override] of Object.entries(
    files.chronologyOverrides ?? {},
  )) {
    findings.push(
      ...validateChronologyOverride(chronologyId, override, ctx, files.personChronology),
    );
  }

  return findings;
}

/**
 * An alternate chronology is a short list of differences from a base, not a
 * second copy of the dataset. Two copies drift silently; this checks that the
 * list still refers to records the base actually has.
 */
export function validateChronologyOverride(
  chronologyId: string,
  raw: unknown,
  ctx: InputContext,
  baseRows: unknown[],
): Finding[] {
  const findings: Finding[] = [];
  const severe = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'severe', check, subject, message });

  const file = raw as {
    chronologyId?: string;
    baseChronologyId?: string;
    rationale?: string;
    records?: Array<Record<string, unknown>>;
  };
  const subject = `chronology-overrides.${chronologyId}`;

  if (file.chronologyId !== chronologyId) {
    severe('override-id-mismatch', subject, `File declares ${String(file.chronologyId)}`);
  }
  if (!file.baseChronologyId || !ctx.chronologyIds.has(file.baseChronologyId)) {
    severe(
      'override-missing-base',
      subject,
      `Unknown base chronology ${String(file.baseChronologyId)}`,
    );
  }
  if (!file.rationale) {
    severe(
      'override-no-rationale',
      subject,
      'An alternate chronology must say in the data why it differs, not only in prose elsewhere',
    );
  }

  const basePeople = new Set(
    (baseRows as Array<{ personId?: string }>)
      .map((r) => r.personId)
      .filter((id): id is string => !!id),
  );

  for (const record of file.records ?? []) {
    const personId = String(record['personId'] ?? '');
    if (!basePeople.has(personId)) {
      severe(
        'override-unknown-person',
        `${subject}:${personId}`,
        'Overrides a person with no record in the base chronology',
      );
    }
    for (const key of FORBIDDEN_DERIVED_KEYS) {
      if (key in record) {
        severe(
          'derived-value-in-canonical',
          `${subject}:${personId}`,
          `${key} is derived and must not appear in canonical input`,
        );
      }
    }
  }

  return findings;
}

interface EventInputContext extends InputContext {
  eventIds: Set<string>;
}

const FORBIDDEN_EVENT_KEYS = ['startYear', 'endYear', 'start_year', 'end_year'];

/**
 * Event years are derived from an age the text states plus the anchor
 * person's own derived birth year, so the canonical file holds the age and
 * never the year.
 */
export function validateEventChronologyInput(
  rows: unknown[],
  ctx: EventInputContext,
): Finding[] {
  const findings: Finding[] = [];
  const severe = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'severe', check, subject, message });

  const seen = new Set<string>();

  rows.forEach((raw, index) => {
    const row = raw as Record<string, unknown>;
    const eventId = String(row['eventId'] ?? `[${index}]`);
    const chronologyId = String(row['chronologyId'] ?? '');
    const subject = `${eventId}@${chronologyId}`;

    if (!ctx.eventIds.has(eventId)) {
      severe('missing-event', subject, `Unknown event ${eventId}`);
    }
    if (!ctx.chronologyIds.has(chronologyId)) {
      severe('missing-chronology', subject, `Unknown chronology ${chronologyId}`);
    }
    const key = `${eventId}@${chronologyId}`;
    if (seen.has(key)) {
      severe('duplicate-event-chronology', subject, 'Two records for this event');
    }
    seen.add(key);

    for (const forbidden of FORBIDDEN_EVENT_KEYS) {
      if (forbidden in row) {
        severe(
          'derived-value-in-canonical',
          subject,
          `${forbidden} is derived and must not appear in canonical input; it is computed into data/generated/`,
        );
      }
    }

    const rule = String(row['rule'] ?? '');
    if (rule === 'person-age') {
      const anchor = String(row['anchorPersonId'] ?? '');
      if (!ctx.personIds.has(anchor)) {
        severe('missing-anchor', subject, `Unknown anchor person ${anchor}`);
      }
      if (row['value'] === null || row['value'] === undefined) {
        severe(
          'missing-figure',
          subject,
          'A person-age event needs the age the text states',
        );
      }
    } else if (rule !== 'epoch' && rule !== 'unknown') {
      severe('unknown-rule', subject, `Unrecognised event rule ${rule}`);
    }

    const reference = row['reference'];
    if (typeof reference === 'string' && reference && !ctx.referenceIds.has(reference)) {
      severe('missing-reference', subject, `Unknown scripture reference ${reference}`);
    }

    for (const id of (row['assumptions'] as string[] | undefined) ?? []) {
      if (!ctx.assumptionIds.has(id)) {
        severe('missing-assumption', subject, `Unknown assumption ${id}`);
      }
    }
  });

  return findings;
}

export interface InputContext {
  personIds: Set<string>;
  chronologyIds: Set<string>;
  referenceIds: Set<string>;
  assumptionIds: Set<string>;
}

/**
 * The chronology input file holds sourced figures only. Derived values live in
 * data/generated/ and are recomputed, never typed, so a birth year appearing
 * here is a severe error rather than a convenience.
 */
const FORBIDDEN_DERIVED_KEYS = ['birthYear', 'deathYear', 'birth_year', 'death_year'];

export function validateChronologyInput(rows: unknown[], ctx: InputContext): Finding[] {
  const findings: Finding[] = [];
  const severe = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'severe', check, subject, message });
  const warn = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'warning', check, subject, message });

  const seen = new Set<string>();

  rows.forEach((raw, index) => {
    const row = raw as Record<string, unknown>;
    const personId = typeof row.personId === 'string' ? row.personId : `[${index}]`;
    const chronologyId = typeof row.chronologyId === 'string' ? row.chronologyId : '';
    const subject = `${personId}@${chronologyId}`;

    if (!ctx.personIds.has(personId)) {
      severe('missing-person', subject, `Unknown person ${personId}`);
    }
    if (!ctx.chronologyIds.has(chronologyId)) {
      severe('missing-chronology', subject, `Unknown chronology ${chronologyId}`);
    }
    if (seen.has(subject)) {
      severe(
        'duplicate-chronology-record',
        subject,
        'Duplicate person/chronology record',
      );
    }
    seen.add(subject);

    const father = row.father;
    if (father !== null && typeof father === 'string' && !ctx.personIds.has(father)) {
      severe('missing-person', subject, `Unknown father ${father}`);
    }

    for (const key of FORBIDDEN_DERIVED_KEYS) {
      if (key in row) {
        severe(
          'derived-value-in-canonical',
          subject,
          `${key} is derived and must not appear in canonical input; it is computed into data/generated/`,
        );
      }
    }

    // The figure format is hand-written rather than Zod-parsed, so the
    // enums have to be checked here or a typo silently becomes a label the
    // UI has no wording for.
    if (
      typeof row.reviewStatus === 'string' &&
      !REVIEW_STATUSES.includes(row.reviewStatus as ReviewStatus)
    ) {
      severe('unknown-review-status', subject, `Unrecognised status ${row.reviewStatus}`);
    }
    for (const [path, confidence] of confidencesIn(row)) {
      if (!CONFIDENCE_LEVELS.includes(confidence as ConfidenceLevel)) {
        severe(
          'unknown-confidence',
          `${subject}.${path}`,
          `Unrecognised confidence ${confidence}`,
        );
      }
    }

    const assumptions = Array.isArray(row.assumptions) ? row.assumptions : [];
    for (const a of assumptions) {
      if (typeof a === 'string' && !ctx.assumptionIds.has(a)) {
        severe('missing-assumption', subject, `Unknown assumption ${a}`);
      }
    }

    // Every figure must name the verse it comes from, whether or not a human
    // has read the number off it yet.
    let unfilled = 0;
    walkFigures(row, (figure, path) => {
      const ref = figure.reference;
      if (typeof ref !== 'string') {
        severe(
          'missing-provenance',
          `${subject}.${path}`,
          'Figure has no scripture reference',
        );
      } else if (!ctx.referenceIds.has(ref)) {
        severe(
          'missing-reference',
          `${subject}.${path}`,
          `Unknown scripture reference ${ref}`,
        );
      }
      if (figure.value === null) unfilled += 1;
    });

    const rule = (row.birthOffsetFromFather as Record<string, unknown> | undefined)?.rule;
    const lifespanRule = (row.lifespan as Record<string, unknown> | undefined)?.rule;

    if (
      rule !== 'unknown' &&
      rule !== 'epoch' &&
      father === null &&
      rule === 'father-age'
    ) {
      severe('missing-father', subject, 'A father-age birth offset requires a father');
    }

    if (row.reviewStatus === 'VERIFIED' && !row.verifiedBy) {
      severe(
        'verified-without-reviewer',
        subject,
        'A VERIFIED record needs verifiedBy and verifiedAt',
      );
    }

    // VERIFIED means someone checked the figure against a named source, and
    // the record has to say which source and by what method. Without that
    // the status is an assertion about an act nobody can reproduce, which is
    // the thing requirement section 5 exists to prevent.
    if (row.reviewStatus === 'VERIFIED') {
      const provenance = row.verification as Record<string, unknown> | undefined;
      if (
        typeof provenance?.method !== 'string' ||
        typeof provenance.primarySource !== 'string'
      ) {
        severe(
          'verified-without-provenance',
          subject,
          'A VERIFIED record must record the verification method and the source it was checked against',
        );
      }
    }

    // The supplier of a reading and the verifier of it are different roles.
    // Recording a person as the verifier of a source they did not inspect is
    // the specific thing the Phase 2 verification pass was asked to stop.
    if (
      typeof row.verifiedBy === 'string' &&
      !row.verifiedBy.startsWith('source-check:')
    ) {
      severe(
        'verifier-is-not-a-check',
        subject,
        'verifiedBy names who or what performed the check; a person who supplied a reading belongs in suppliedBy',
      );
    }

    if (unfilled > 0) {
      warn(
        'figure-not-yet-read',
        subject,
        `${unfilled} figure(s) still awaiting a reading from the text; the record cannot leave DRAFT`,
      );
      if (row.reviewStatus !== 'DRAFT') {
        severe(
          'unread-figure-not-draft',
          subject,
          'A record with unread figures must stay DRAFT',
        );
      }
    }

    if (rule === 'unknown' && lifespanRule !== 'unknown') {
      warn(
        'partial-unknown',
        subject,
        'Birth is unknown but lifespan is not; check this is intended',
      );
    }
  });

  return findings;
}

interface Figure {
  value: unknown;
  reference?: unknown;
}

/** Every confidence label anywhere in a figure record, with its path. */
function confidencesIn(row: Record<string, unknown>): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'confidence' && typeof child === 'string') {
        found.push([path ? `${path}.${key}` : key, child]);
      } else {
        visit(child, path ? `${path}.${key}` : key);
      }
    }
  };
  visit(row, '');
  return found;
}

function walkFigures(
  node: unknown,
  visit: (figure: Figure, path: string) => void,
  path = '',
) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkFigures(item, visit, `${path}[${i}]`));
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const record = node as Record<string, unknown>;
  if ('value' in record && 'reference' in record) {
    visit({ value: record.value, reference: record.reference }, path || 'figure');
    return;
  }
  for (const [key, value] of Object.entries(record)) {
    walkFigures(value, visit, path ? `${path}.${key}` : key);
  }
}

function sameEdge(
  a: { sourcePersonId: string; targetPersonId: string; relationshipType: string },
  b: { sourcePersonId: string; targetPersonId: string; relationshipType: string },
) {
  return (
    a.sourcePersonId === b.sourcePersonId &&
    a.targetPersonId === b.targetPersonId &&
    a.relationshipType === b.relationshipType
  );
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

/** Depth-first cycle detection over parent edges. */
export function findParentCycles(
  relationships: Array<{
    sourcePersonId: string;
    targetPersonId: string;
    relationshipType: string;
  }>,
): string[][] {
  const children = new Map<string, string[]>();
  for (const rel of relationships) {
    if (rel.relationshipType !== 'parent') continue;
    const list = children.get(rel.sourcePersonId) ?? [];
    list.push(rel.targetPersonId);
    children.set(rel.sourcePersonId, list);
  }

  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (node: string) => {
    const current = state.get(node);
    if (current === 'done') return;
    if (current === 'visiting') {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const child of children.get(node) ?? []) visit(child);
    stack.pop();
    state.set(node, 'done');
  };

  for (const node of children.keys()) visit(node);
  return cycles;
}

function describeZodError(error: unknown): string {
  const issues = (
    error as { issues?: Array<{ path: unknown[]; message: string }> } | undefined
  )?.issues;
  if (!issues) return 'Failed schema validation';
  return issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

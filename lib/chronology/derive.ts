import type {
  ConfidenceLevel,
  DateType,
  Derivation,
  DerivationStep,
  EventChronology,
  PersonChronology,
} from '@/lib/domain';

/**
 * Turns the sourced figures in data/canonical into resolved birth, death and
 * lifespan years, carrying a derivation record for each computed value.
 *
 * Nothing here invents a number. Every value is either a figure a human read
 * from the text, or arithmetic over such figures with the steps recorded so
 * "Why this date?" can show its working.
 *
 * Pure: it takes parsed records and returns records. The CLI in
 * scripts/derive-chronology.ts is a thin wrapper.
 */

export interface Figure {
  value: number | null;
  reference: string;
  confidence?: ConfidenceLevel;
}

export interface NamedFigure extends Figure {
  name: string;
}

export interface BirthRule {
  rule:
    | 'epoch'
    | 'father-age'
    | 'shem-from-gen-11-10'
    | 'terah-lifespan-minus-departure-age'
    | 'derived-from-own-age-at-event'
    | 'joseph-from-egypt-years'
    | 'unknown';
  value?: number | null;
  reference?: string;
  confidence?: ConfidenceLevel;
  calculationMethod?: string;
  sourceReferences?: string[];
}

export interface LifespanRule {
  rule: 'explicit' | 'sum-fathering-and-remainder' | 'unknown';
  value?: number | null;
  reference?: string;
  confidence?: ConfidenceLevel;
  ageAtFathering?: Figure;
  remainingYears?: Figure;
  sourceReferences?: string[];
}

export interface ChronologyInputRecord {
  personId: string;
  chronologyId: string;
  father: string | null;
  birthOffsetFromFather: BirthRule;
  lifespan: LifespanRule;
  deathRule: 'birth-plus-lifespan' | 'not-recorded' | 'unknown';
  assumptions: string[];
  dependsOn?: string[];
  additionalFigures?: NamedFigure[];
  notes?: string | null;
  reviewStatus: string;
}

export interface DeriveIssue {
  personId: string;
  message: string;
}

export interface DeriveResult {
  records: PersonChronology[];
  issues: DeriveIssue[];
  /** Figures still awaiting a reading from the text, by person. */
  unread: Map<string, number>;
}

interface Resolved {
  birthYear: number | null;
  deathYear: number | null;
  lifespan: number | null;
  birthDerivation: Derivation | null;
  /** The reference a synthetic epoch step cites when this birth has no chain. */
  birthReference: string;
  birthConfidence: ConfidenceLevel;
  deathConfidence: ConfidenceLevel;
  lifespanConfidence: ConfidenceLevel;
}

export function deriveChronology(
  input: ChronologyInputRecord[],
  chronologyId: string,
): DeriveResult {
  const rows = input.filter((r) => r.chronologyId === chronologyId);
  const byId = new Map(rows.map((r) => [r.personId, r]));
  const issues: DeriveIssue[] = [];
  const unread = new Map<string, number>();

  for (const row of rows) {
    const count = countUnread(row);
    if (count > 0) unread.set(row.personId, count);
  }

  const order = topologicalOrder(rows, issues);
  const resolved = new Map<string, Resolved>();

  for (const personId of order) {
    const row = byId.get(personId);
    /* v8 ignore next -- @preserve: noUncheckedIndexedAccess forces this guard; the index is always in range. */
    if (!row) continue;
    resolved.set(personId, resolveRow(row, resolved, byId, issues));
  }

  const records: PersonChronology[] = [];
  for (const row of rows) {
    const r = resolved.get(row.personId);
    /* v8 ignore next -- @preserve: every row was resolved in the loop above. */
    if (!r) continue;
    records.push({
      personId: row.personId,
      chronologyId,
      birthYear: r.birthYear,
      deathYear: r.deathYear,
      lifespan: r.lifespan,
      birthConfidence: r.birthConfidence,
      deathConfidence: r.deathConfidence,
      lifespanConfidence: r.lifespanConfidence,
      birthSourceType: sourceTypeFor(r.birthConfidence),
      deathSourceType: sourceTypeFor(r.deathConfidence),
      lifespanSourceType: sourceTypeFor(r.lifespanConfidence),
      sourceReferences: collectReferences(row),
      calculationMethod: row.birthOffsetFromFather.calculationMethod ?? null,
      derivation: r.birthDerivation,
      notes: row.notes ?? null,
      reviewStatus: 'DRAFT',
    });
  }

  return { records, issues, unread };
}

function resolveRow(
  row: ChronologyInputRecord,
  resolved: Map<string, Resolved>,
  byId: Map<string, ChronologyInputRecord>,
  issues: DeriveIssue[],
): Resolved {
  const lifespan = resolveLifespan(row);
  const birth = resolveBirth(row, resolved, byId, issues);

  let deathYear: number | null = null;
  let deathConfidence: ConfidenceLevel = 'UNKNOWN';

  if (
    row.deathRule === 'birth-plus-lifespan' &&
    birth.year !== null &&
    lifespan.value !== null
  ) {
    deathYear = birth.year + lifespan.value;
    // A death year is only as firm as the weaker of the two values behind it.
    deathConfidence = 'DERIVED';
  }

  return {
    birthYear: birth.year,
    deathYear,
    lifespan: lifespan.value,
    birthDerivation: birth.derivation,
    birthReference: primaryReference(row.birthOffsetFromFather),
    birthConfidence: birth.year === null ? 'UNKNOWN' : birth.confidence,
    deathConfidence,
    lifespanConfidence: lifespan.value === null ? 'UNKNOWN' : lifespan.confidence,
  };
}

function resolveLifespan(row: ChronologyInputRecord): {
  value: number | null;
  confidence: ConfidenceLevel;
} {
  const spec = row.lifespan;
  if (spec.rule === 'explicit') {
    return { value: spec.value ?? null, confidence: spec.confidence ?? 'EXPLICIT' };
  }
  if (spec.rule === 'sum-fathering-and-remainder') {
    const a = spec.ageAtFathering?.value ?? null;
    const b = spec.remainingYears?.value ?? null;
    if (a === null || b === null) return { value: null, confidence: 'UNKNOWN' };
    // Genesis 11 gives remaining years rather than a total, so the total is
    // DERIVED here where Genesis 5's is EXPLICIT. Mislabelling this would
    // overstate the firmness of nine records.
    return { value: a + b, confidence: 'DERIVED' };
  }
  return { value: null, confidence: 'UNKNOWN' };
}

function resolveBirth(
  row: ChronologyInputRecord,
  resolved: Map<string, Resolved>,
  byId: Map<string, ChronologyInputRecord>,
  issues: DeriveIssue[],
): { year: number | null; confidence: ConfidenceLevel; derivation: Derivation | null } {
  const spec = row.birthOffsetFromFather;
  const none = { year: null, confidence: 'UNKNOWN' as ConfidenceLevel, derivation: null };

  switch (spec.rule) {
    case 'epoch':
      return { year: spec.value ?? 0, confidence: 'DERIVED', derivation: null };

    case 'father-age': {
      const father = row.father ? resolved.get(row.father) : undefined;
      const offset = spec.value ?? null;
      if (!row.father) {
        issues.push({
          personId: row.personId,
          message: 'father-age rule with no father',
        });
        return none;
      }
      if (offset === null || !father || father.birthYear === null) return none;

      const steps: DerivationStep[] = [
        ...chainPrefix(row.father, resolved),
        {
          from: row.father,
          to: row.personId,
          years: offset,
          reference: spec.reference ?? '',
          runningTotal: father.birthYear + offset,
        },
      ];
      return {
        year: father.birthYear + offset,
        confidence: 'DERIVED',
        derivation: {
          method: 'begetting-chain',
          unit: 'AM',
          result: father.birthYear + offset,
          steps,
          assumptions: row.assumptions,
        },
      };
    }

    case 'shem-from-gen-11-10': {
      // Genesis 5:32 gives one age for three brothers, so Shem is dated
      // backward from Genesis 11:10 instead: Arphaxad was born a stated number
      // of years after the flood, and Shem was a stated age at that point.
      const noah = row.father ? resolved.get(row.father) : undefined;
      const ageAtFlood = figureValue(byId.get(row.father ?? ''), 'ageAtFlood');
      const yearsAfterFlood = figureValue(row, 'yearsAfterFloodAtArphaxadBirth');
      const ageAtArphaxad = row.lifespan.ageAtFathering?.value ?? null;

      if (
        !noah ||
        noah.birthYear === null ||
        ageAtFlood === null ||
        yearsAfterFlood === null ||
        ageAtArphaxad === null
      ) {
        return none;
      }

      const floodYear = noah.birthYear + ageAtFlood;
      const arphaxadBirth = floodYear + yearsAfterFlood;
      const birthYear = arphaxadBirth - ageAtArphaxad;

      return {
        year: birthYear,
        confidence: 'DERIVED',
        derivation: {
          method: 'shem-from-gen-11-10',
          unit: 'AM',
          result: birthYear,
          steps: [
            ...chainPrefix(row.father, resolved),
            {
              /* v8 ignore next -- @preserve: the guard above returns unless row.father is set. */
              from: row.father ?? 'noah',
              to: 'the-flood',
              years: ageAtFlood,
              reference: 'GEN.7.6',
              runningTotal: floodYear,
            },
            {
              from: 'the-flood',
              to: 'arphaxad',
              years: yearsAfterFlood,
              reference: 'GEN.11.10',
              runningTotal: arphaxadBirth,
            },
            {
              from: 'arphaxad',
              to: row.personId,
              years: -ageAtArphaxad,
              reference: 'GEN.11.10',
              runningTotal: birthYear,
            },
          ],
          assumptions: row.assumptions,
        },
      };
    }

    case 'terah-lifespan-minus-departure-age': {
      // The decision of 2026-09-20. Genesis 11:26 gives one age for three sons
      // and does not say Abram was eldest, so his birth is derived from
      // Terah's lifespan and his own age at the departure from Haran instead.
      const father = row.father ? resolved.get(row.father) : undefined;
      const fatherRow = row.father ? byId.get(row.father) : undefined;
      const terahLifespan = fatherRow?.lifespan.value ?? null;
      const ageAtDeparture = figureValue(row, 'ageAtDepartureFromHaran');

      if (
        !father ||
        father.birthYear === null ||
        terahLifespan === null ||
        ageAtDeparture === null
      ) {
        return none;
      }

      const offset = terahLifespan - ageAtDeparture;
      const birthYear = father.birthYear + offset;

      return {
        year: birthYear,
        confidence: 'DERIVED',
        derivation: {
          method: 'terah-lifespan-minus-departure-age',
          unit: 'AM',
          result: birthYear,
          steps: [
            ...chainPrefix(row.father, resolved),
            {
              /* v8 ignore next -- @preserve: the guard above returns unless row.father is set. */
              from: row.father ?? 'terah',
              to: 'terah-death',
              years: terahLifespan,
              reference: 'GEN.11.32',
              runningTotal: father.birthYear + terahLifespan,
            },
            {
              from: 'terah-death',
              to: row.personId,
              years: -ageAtDeparture,
              reference: 'GEN.12.4',
              runningTotal: birthYear,
            },
          ],
          assumptions: row.assumptions,
        },
      };
    }

    case 'derived-from-own-age-at-event': {
      // Sarah: her birth comes from Isaac's, minus her stated age at his birth.
      const anchorId = row.dependsOn?.[0];
      const anchor = anchorId ? resolved.get(anchorId) : undefined;
      const ageAtAnchor = figureValue(row, 'ageAtIsaacBirth');
      if (!anchor || anchor.birthYear === null || ageAtAnchor === null) return none;

      const birthYear = anchor.birthYear - ageAtAnchor;
      return {
        year: birthYear,
        confidence: 'DERIVED',
        derivation: {
          method: 'own-age-at-event',
          unit: 'AM',
          result: birthYear,
          steps: [
            ...chainPrefix(anchorId, resolved),
            {
              /* v8 ignore next -- @preserve: the guard above returns unless the anchor resolved. */
              from: anchorId ?? 'anchor',
              to: row.personId,
              years: -ageAtAnchor,
              reference: 'GEN.17.17',
              runningTotal: birthYear,
            },
          ],
          assumptions: row.assumptions,
        },
      };
    }

    case 'joseph-from-egypt-years': {
      const father = row.father ? resolved.get(row.father) : undefined;
      const fatherRow = row.father ? byId.get(row.father) : undefined;
      const jacobAgeBeforePharaoh = figureValue(fatherRow, 'ageBeforePharaoh');
      const josephAgeBeforePharaoh = figureValue(row, 'ageBeforePharaoh');
      const plenty = figureValue(row, 'yearsOfPlenty');
      const famine = figureValue(row, 'yearsOfFamineAtJacobsArrival');

      if (
        !father ||
        father.birthYear === null ||
        jacobAgeBeforePharaoh === null ||
        josephAgeBeforePharaoh === null ||
        plenty === null ||
        famine === null
      ) {
        return none;
      }

      const josephAgeAtArrival = josephAgeBeforePharaoh + plenty + famine;
      const offset = jacobAgeBeforePharaoh - josephAgeAtArrival;
      const birthYear = father.birthYear + offset;

      return {
        year: birthYear,
        confidence: 'DERIVED',
        derivation: {
          method: 'joseph-from-egypt-years',
          unit: 'AM',
          result: birthYear,
          steps: [
            ...chainPrefix(row.father, resolved),
            {
              /* v8 ignore next -- @preserve: the guard above returns unless row.father is set. */
              from: row.father ?? 'jacob',
              to: 'jacob-before-pharaoh',
              years: jacobAgeBeforePharaoh,
              reference: 'GEN.47.9',
              runningTotal: father.birthYear + jacobAgeBeforePharaoh,
            },
            {
              from: 'jacob-before-pharaoh',
              to: row.personId,
              years: -josephAgeAtArrival,
              reference: 'GEN.41.46',
              runningTotal: birthYear,
            },
          ],
          assumptions: row.assumptions,
        },
      };
    }

    case 'unknown':
    default:
      return none;
  }
}

/**
 * The steps that already get from the epoch to the anchor's birth year.
 *
 * Every derivation carries the whole path from year zero rather than just its
 * last hop, because DerivationSchema checks that each running total equals the
 * cumulative sum of the years before it. A chain that started midway would
 * fail that check, and rightly: a reader asking "why this date?" wants the
 * path, not the final addition.
 *
 * The caller's arithmetic is always anchor.birthYear + something, so the
 * prefix has to sum to exactly the anchor's birth year or the whole
 * derivation is inconsistent with the number it claims to explain. An anchor
 * whose own birth carries no chain — the epoch, or any figure stated outright
 * — gets a single step from the epoch instead, which is the honest
 * description of where that year came from.
 */
function chainPrefix(
  anchorId: string | null | undefined,
  resolved: Map<string, Resolved>,
): DerivationStep[] {
  /* v8 ignore next -- @preserve: every caller has already established the anchor and its birth year. */
  if (!anchorId) return [];
  const anchor = resolved.get(anchorId);
  /* v8 ignore next -- @preserve: as above: the caller's own guard has already returned otherwise. */
  if (!anchor || anchor.birthYear === null) return [];

  const steps = anchor.birthDerivation?.steps ?? [];
  const sum = steps[steps.length - 1]?.runningTotal ?? 0;
  if (sum === anchor.birthYear) return steps;

  return [
    {
      from: 'epoch',
      to: anchorId,
      years: anchor.birthYear,
      reference: anchor.birthReference,
      runningTotal: anchor.birthYear,
    },
  ];
}

function primaryReference(spec: BirthRule): string {
  return spec.reference ?? spec.sourceReferences?.[0] ?? 'GEN.5.1';
}

function figureValue(
  row: ChronologyInputRecord | undefined,
  name: string,
): number | null {
  return row?.additionalFigures?.find((f) => f.name === name)?.value ?? null;
}

function collectReferences(row: ChronologyInputRecord): string[] {
  const refs = new Set<string>();
  const add = (r?: string) => {
    if (r) refs.add(r);
  };
  add(row.birthOffsetFromFather.reference);
  for (const r of row.birthOffsetFromFather.sourceReferences ?? []) add(r);
  add(row.lifespan.reference);
  add(row.lifespan.ageAtFathering?.reference);
  add(row.lifespan.remainingYears?.reference);
  for (const r of row.lifespan.sourceReferences ?? []) add(r);
  for (const f of row.additionalFigures ?? []) add(f.reference);
  return [...refs];
}

function sourceTypeFor(confidence: ConfidenceLevel) {
  if (confidence === 'EXPLICIT') return 'SCRIPTURE_EXPLICIT' as const;
  if (confidence === 'DERIVED') return 'SCRIPTURE_DERIVED' as const;
  return 'UNKNOWN' as const;
}

function countUnread(row: ChronologyInputRecord): number {
  let count = 0;
  const check = (f?: Figure) => {
    if (f && f.value === null) count += 1;
  };
  if (row.birthOffsetFromFather.rule === 'father-age') {
    check({ value: row.birthOffsetFromFather.value ?? null, reference: '' });
  }
  if (row.lifespan.rule === 'explicit') {
    check({ value: row.lifespan.value ?? null, reference: '' });
  }
  check(row.lifespan.ageAtFathering);
  check(row.lifespan.remainingYears);
  for (const f of row.additionalFigures ?? []) check(f);
  return count;
}

/**
 * Orders records so every record is resolved after the records it depends on.
 * Dependencies are the father plus any explicit dependsOn, which is how Sarah
 * (anchored to Isaac) and Joseph (anchored to Jacob) resolve correctly despite
 * not following the simple father chain.
 */
export function topologicalOrder(
  rows: ChronologyInputRecord[],
  issues: DeriveIssue[],
): string[] {
  const deps = new Map<string, string[]>();
  const ids = new Set(rows.map((r) => r.personId));

  for (const row of rows) {
    const list: string[] = [];
    if (row.father && ids.has(row.father)) list.push(row.father);
    for (const d of row.dependsOn ?? []) if (ids.has(d)) list.push(d);
    deps.set(row.personId, list);
  }

  const order: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (id: string, trail: string[]) => {
    const current = state.get(id);
    if (current === 'done') return;
    if (current === 'visiting') {
      issues.push({
        personId: id,
        message: `Circular chronology dependency: ${[...trail, id].join(' -> ')}`,
      });
      return;
    }
    state.set(id, 'visiting');
    /* v8 ignore next -- @preserve: every row was seeded into deps above. */
    for (const dep of deps.get(id) ?? []) visit(dep, [...trail, id]);
    state.set(id, 'done');
    order.push(id);
  };

  for (const row of rows) visit(row.personId, []);
  return order;
}

/* -------------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------- */

export interface EventChronologyInputRecord {
  eventId: string;
  chronologyId: string;
  rule: 'epoch' | 'person-age' | 'unknown';
  anchorPersonId?: string;
  value: number | null;
  reference: string;
  dateType: DateType;
  assumptions: string[];
  notes?: string | null;
}

export interface DeriveEventsResult {
  records: EventChronology[];
  issues: DeriveIssue[];
}

/**
 * Event years, derived the same way person years are: from an age Scripture
 * states plus the anchor person's own derived birth year.
 *
 * Babel is the case that matters here. Genesis 10:25 says the earth was
 * divided in Peleg's days, and it is tempting to read that as a date because
 * it would fill the one hole in the sequence. It is not one, so this returns
 * UNKNOWN for it, and the timeline will show a gap rather than a guess.
 */
export function deriveEventChronology(
  input: EventChronologyInputRecord[],
  chronologyId: string,
  people: readonly PersonChronology[],
): DeriveEventsResult {
  const rows = input.filter((r) => r.chronologyId === chronologyId);
  const byPerson = new Map(people.map((p) => [p.personId, p]));
  const issues: DeriveIssue[] = [];
  const records: EventChronology[] = [];

  for (const row of rows) {
    const unknownRecord = (): EventChronology => ({
      eventId: row.eventId,
      chronologyId,
      startYear: null,
      endYear: null,
      dateType: row.dateType,
      confidence: 'UNKNOWN',
      sourceType: 'UNKNOWN',
      derivation: null,
      notes: row.notes ?? null,
      reviewStatus: 'DRAFT',
    });

    if (row.rule === 'unknown') {
      records.push(unknownRecord());
      continue;
    }

    if (row.rule === 'epoch') {
      const year = row.value ?? 0;
      records.push({
        eventId: row.eventId,
        chronologyId,
        startYear: year,
        endYear: year,
        dateType: row.dateType,
        confidence: 'DERIVED',
        sourceType: 'SCRIPTURE_DERIVED',
        derivation: null,
        notes: row.notes ?? null,
        reviewStatus: 'DRAFT',
      });
      continue;
    }

    const anchorId = row.anchorPersonId;
    if (!anchorId) {
      issues.push({
        personId: row.eventId,
        message: 'person-age rule with no anchorPersonId',
      });
      records.push(unknownRecord());
      continue;
    }

    const anchor = byPerson.get(anchorId);
    if (!anchor) {
      issues.push({
        personId: row.eventId,
        message: `anchor person ${anchorId} has no record in ${chronologyId}`,
      });
      records.push(unknownRecord());
      continue;
    }

    if (anchor.birthYear === null || row.value === null) {
      records.push(unknownRecord());
      continue;
    }

    const year = anchor.birthYear + row.value;
    const steps: DerivationStep[] = [
      ...(anchor.derivation?.steps ?? [
        {
          from: 'epoch',
          to: anchorId,
          years: anchor.birthYear,
          reference: anchor.sourceReferences[0] ?? row.reference,
          runningTotal: anchor.birthYear,
        },
      ]),
      {
        from: anchorId,
        to: row.eventId,
        years: row.value,
        reference: row.reference,
        runningTotal: year,
      },
    ];

    records.push({
      eventId: row.eventId,
      chronologyId,
      startYear: year,
      endYear: year,
      dateType: row.dateType,
      confidence: 'DERIVED',
      sourceType: 'SCRIPTURE_DERIVED',
      derivation: {
        method: 'age-at-event',
        unit: 'AM',
        result: year,
        steps,
        assumptions: row.assumptions,
      },
      notes: row.notes ?? null,
      reviewStatus: 'DRAFT',
    });
  }

  return { records, issues };
}

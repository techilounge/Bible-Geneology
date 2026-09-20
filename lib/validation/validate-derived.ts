import type { EventChronology, PersonChronology, Relationship } from '@/lib/domain';
import { DerivationSchema } from '@/lib/domain';
import type { Finding } from './validate-dataset';

/**
 * Validates the chronology the engine derives, as opposed to the figures a
 * human read from the text.
 *
 * The canonical validator can only check that the figures are well formed and
 * that everything they reference exists. It cannot catch a death before a
 * birth or a child older than their father, because the canonical files hold
 * no years at all — those are computed. This is the other half of requirement
 * section 21, and it runs on every build for the same reason: a chronology
 * that contradicts itself must not reach a reader.
 *
 * Pure: it takes parsed records and returns findings.
 */
export interface DerivedInput {
  chronologyId: string;
  records: readonly PersonChronology[];
  events: readonly EventChronology[];
  relationships: readonly Relationship[];
  referenceIds: ReadonlySet<string>;
}

/**
 * A father under this age at a child's birth is almost certainly a
 * transcription error rather than a reading. It is a warning, never an error:
 * the text is the authority and the number is only a smell.
 */
const IMPLAUSIBLY_YOUNG_PARENT = 12;

export function validateDerived(input: DerivedInput): Finding[] {
  const findings: Finding[] = [];
  const severe = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'severe', check, subject, message });
  const warn = (check: string, subject: string, message: string) =>
    findings.push({ severity: 'warning', check, subject, message });

  const { chronologyId, records, events, relationships, referenceIds } = input;
  const byPerson = new Map<string, PersonChronology>();

  for (const record of records) {
    const subject = `${record.personId}@${chronologyId}`;

    if (record.chronologyId !== chronologyId) {
      severe(
        'wrong-chronology',
        subject,
        `Record declares chronology ${record.chronologyId}`,
      );
    }
    if (byPerson.has(record.personId)) {
      severe('duplicate-chronology-record', subject, 'Two records for this person');
    }
    byPerson.set(record.personId, record);

    // --- unknown stays unknown -------------------------------------------
    const pairs: Array<[string, number | null, string]> = [
      ['birth', record.birthYear, record.birthConfidence],
      ['death', record.deathYear, record.deathConfidence],
      ['lifespan', record.lifespan, record.lifespanConfidence],
    ];
    for (const [field, value, confidence] of pairs) {
      if ((confidence === 'UNKNOWN') !== (value === null)) {
        severe(
          'unknown-means-null',
          subject,
          `${field} is ${value === null ? 'null' : String(value)} with confidence ${confidence}`,
        );
      }
    }

    // --- the years have to make sense ------------------------------------
    if (record.birthYear !== null && record.deathYear !== null) {
      if (record.deathYear < record.birthYear) {
        severe(
          'death-before-birth',
          subject,
          `Dies in ${record.deathYear}, born in ${record.birthYear}`,
        );
      }
      if (
        record.lifespan !== null &&
        record.deathYear - record.birthYear !== record.lifespan
      ) {
        severe(
          'lifespan-inconsistent',
          subject,
          `${record.birthYear} to ${record.deathYear} is ${record.deathYear - record.birthYear} years, but the lifespan says ${record.lifespan}`,
        );
      }
    }
    if (record.lifespan !== null && record.lifespan < 0) {
      severe('negative-lifespan', subject, `Lifespan is ${record.lifespan}`);
    }

    // --- provenance -------------------------------------------------------
    const statesSomething =
      record.birthYear !== null || record.deathYear !== null || record.lifespan !== null;
    if (statesSomething && record.sourceReferences.length === 0) {
      severe(
        'no-provenance',
        subject,
        'States a year or a lifespan and cites no scripture reference',
      );
    }
    for (const ref of record.sourceReferences) {
      if (!referenceIds.has(ref)) {
        severe('missing-reference', subject, `Unknown scripture reference ${ref}`);
      }
    }

    findings.push(...checkDerivation(subject, record, referenceIds));

    if (record.reviewStatus === 'VERIFIED') {
      warn(
        'verified-without-reviewer',
        subject,
        'A VERIFIED record needs a recorded reviewer; the derived output is never reviewed directly',
      );
    }
  }

  // --- descent has to run forwards in time --------------------------------
  for (const rel of relationships) {
    if (rel.relationshipType !== 'parent') continue;
    const parent = byPerson.get(rel.sourcePersonId);
    const child = byPerson.get(rel.targetPersonId);
    if (!parent || !child) continue;
    if (parent.birthYear === null || child.birthYear === null) continue;

    const subject = `${rel.sourcePersonId} -> ${rel.targetPersonId}@${chronologyId}`;
    const gap = child.birthYear - parent.birthYear;

    if (gap < 0) {
      severe(
        'child-born-before-parent',
        subject,
        `Parent born in ${parent.birthYear}, child in ${child.birthYear}`,
      );
    } else if (gap < IMPLAUSIBLY_YOUNG_PARENT) {
      warn(
        'implausible-parent-age',
        subject,
        `Parent would be ${gap} at the child's birth`,
      );
    }

    if (parent.deathYear !== null && child.birthYear > parent.deathYear) {
      // Possible for a father, so this is a warning and not an error. A
      // posthumous birth is a real thing and the text sometimes says so.
      warn(
        'posthumous-birth',
        subject,
        `Child born in ${child.birthYear}, after the parent's death in ${parent.deathYear}`,
      );
    }
  }

  // --- events --------------------------------------------------------------
  const seenEvents = new Set<string>();
  for (const event of events) {
    const subject = `${event.eventId}@${chronologyId}`;
    if (seenEvents.has(event.eventId)) {
      severe('duplicate-event-record', subject, 'Two records for this event');
    }
    seenEvents.add(event.eventId);

    if ((event.confidence === 'UNKNOWN') !== (event.startYear === null)) {
      severe(
        'unknown-means-null',
        subject,
        `Start year is ${event.startYear === null ? 'null' : String(event.startYear)} with confidence ${event.confidence}`,
      );
    }
    if (
      event.startYear !== null &&
      event.endYear !== null &&
      event.endYear < event.startYear
    ) {
      severe(
        'event-ends-before-it-starts',
        subject,
        `Starts in ${event.startYear}, ends in ${event.endYear}`,
      );
    }
    findings.push(...checkDerivation(subject, event, referenceIds));
  }

  return findings;
}

/**
 * A derivation has to produce the number it is attached to, and every step
 * has to cite a reference that resolves. This is what stops a plausible
 * explanation being shown beside a value it does not actually explain.
 */
function checkDerivation(
  subject: string,
  record: Pick<PersonChronology, 'derivation'> & {
    birthYear?: number | null;
    startYear?: number | null;
  },
  referenceIds: ReadonlySet<string>,
): Finding[] {
  const findings: Finding[] = [];
  const derivation = record.derivation;
  if (!derivation) return findings;

  const severe = (check: string, message: string) =>
    findings.push({ severity: 'severe', check, subject, message });

  const parsed = DerivationSchema.safeParse(derivation);
  if (!parsed.success) {
    severe(
      'derivation-does-not-add-up',
      parsed.error.issues.map((i) => i.message).join('; '),
    );
    return findings;
  }

  const value = record.birthYear ?? record.startYear ?? null;
  if (value !== null && derivation.result !== value) {
    severe(
      'derivation-explains-another-number',
      `The derivation resolves to ${derivation.result} but the record states ${value}`,
    );
  }

  for (const step of derivation.steps) {
    if (!referenceIds.has(step.reference)) {
      severe('missing-reference', `Derivation step cites unknown ${step.reference}`);
    }
  }

  return findings;
}

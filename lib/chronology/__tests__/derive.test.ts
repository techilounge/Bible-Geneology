import { describe, expect, it } from 'vitest';
import { DerivationSchema } from '@/lib/domain';
import {
  deriveChronology,
  deriveEventChronology,
  topologicalOrder,
  type ChronologyInputRecord,
  type EventChronologyInputRecord,
} from '../derive';

/**
 * The derivation engine, tested against invented figures.
 *
 * The numbers are round and obviously not scriptural, for the same reason the
 * other engine fixtures are: this suite must fail when the arithmetic is
 * wrong and not when the dataset changes. The real figures are asserted by
 * tests/golden.
 */
function row(patch: Partial<ChronologyInputRecord>): ChronologyInputRecord {
  return {
    personId: 'someone',
    chronologyId: 'fixture',
    father: null,
    birthOffsetFromFather: { rule: 'unknown' },
    lifespan: { rule: 'unknown' },
    deathRule: 'unknown',
    assumptions: [],
    reviewStatus: 'DRAFT',
    ...patch,
  };
}

const epoch = row({
  personId: 'first',
  birthOffsetFromFather: { rule: 'epoch', value: 0, sourceReferences: ['GEN.5.1'] },
  lifespan: { rule: 'explicit', value: 100, reference: 'GEN.5.5' },
  deathRule: 'birth-plus-lifespan',
  assumptions: ['adam-created-at-year-zero'],
});

const child = row({
  personId: 'second',
  father: 'first',
  birthOffsetFromFather: { rule: 'father-age', value: 30, reference: 'GEN.5.3' },
  lifespan: { rule: 'explicit', value: 90, reference: 'GEN.5.8' },
  deathRule: 'birth-plus-lifespan',
  assumptions: ['adam-created-at-year-zero'],
});

function derive(rows: ChronologyInputRecord[]) {
  const result = deriveChronology(rows, 'fixture');
  return {
    ...result,
    byId: new Map(result.records.map((r) => [r.personId, r])),
  };
}

describe('deriveChronology: the epoch', () => {
  it('anchors the first person at year zero', () => {
    const { byId } = derive([epoch]);
    expect(byId.get('first')?.birthYear).toBe(0);
  });

  it('marks even the epoch DERIVED, never EXPLICIT', () => {
    // Scripture states no birth year for anyone, the epoch included: year
    // zero is a convention this chronology adopts, not a figure it read.
    const { byId } = derive([epoch]);
    expect(byId.get('first')?.birthConfidence).toBe('DERIVED');
  });

  it('adds the lifespan to get a death year', () => {
    const { byId } = derive([epoch]);
    expect(byId.get('first')?.deathYear).toBe(100);
    expect(byId.get('first')?.deathConfidence).toBe('DERIVED');
  });
});

describe('deriveChronology: the begetting chain', () => {
  it('adds the offset to the father’s birth year', () => {
    const { byId } = derive([epoch, child]);
    expect(byId.get('second')?.birthYear).toBe(30);
    expect(byId.get('second')?.deathYear).toBe(120);
  });

  it('resolves in dependency order however the input is ordered', () => {
    const forwards = derive([epoch, child]).byId.get('second')?.birthYear;
    const backwards = derive([child, epoch]).byId.get('second')?.birthYear;
    expect(backwards).toBe(forwards);
  });

  it('carries the chain from the epoch, not just the last hop', () => {
    const { byId } = derive([epoch, child]);
    const derivation = byId.get('second')?.derivation;
    expect(derivation?.steps).toHaveLength(1);
    expect(derivation?.result).toBe(30);
  });

  it('produces derivations whose own arithmetic checks out', () => {
    const grandchild = row({
      personId: 'third',
      father: 'second',
      birthOffsetFromFather: { rule: 'father-age', value: 25, reference: 'GEN.5.6' },
      lifespan: { rule: 'explicit', value: 80, reference: 'GEN.5.8' },
      deathRule: 'birth-plus-lifespan',
      assumptions: ['adam-created-at-year-zero'],
    });
    const { byId } = derive([epoch, child, grandchild]);
    const derivation = byId.get('third')?.derivation;

    expect(derivation?.result).toBe(55);
    expect(derivation?.steps.map((s) => s.runningTotal)).toEqual([30, 55]);
    expect(DerivationSchema.safeParse(derivation).success).toBe(true);
  });

  it('leaves a birth unknown when the figure has not been read yet', () => {
    const unread = row({
      personId: 'second',
      father: 'first',
      birthOffsetFromFather: { rule: 'father-age', value: null, reference: 'GEN.5.3' },
    });
    const { byId, unread: pending } = derive([epoch, unread]);
    expect(byId.get('second')?.birthYear).toBeNull();
    expect(byId.get('second')?.birthConfidence).toBe('UNKNOWN');
    expect(pending.get('second')).toBe(1);
  });

  it('reports a father-age rule with no father rather than guessing', () => {
    const { issues } = derive([
      row({ personId: 'x', birthOffsetFromFather: { rule: 'father-age', value: 10 } }),
    ]);
    expect(issues.map((i) => i.message)).toContain('father-age rule with no father');
  });

  it('does not date a person whose father is undated', () => {
    const undatedFather = row({ personId: 'first' });
    const { byId } = derive([undatedFather, child]);
    expect(byId.get('second')?.birthYear).toBeNull();
  });
});

describe('deriveChronology: lifespan rules', () => {
  it('takes an explicit total as EXPLICIT', () => {
    const { byId } = derive([epoch]);
    expect(byId.get('first')?.lifespanConfidence).toBe('EXPLICIT');
  });

  it('sums fathering age and remaining years, and calls the total DERIVED', () => {
    // Genesis 11 gives years remaining after fathering, not a total. The sum
    // is arithmetic, so it is DERIVED where Genesis 5's totals are EXPLICIT.
    // Mislabelling this would overstate the firmness of nine real records.
    const gen11 = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', value: 0 },
      lifespan: {
        rule: 'sum-fathering-and-remainder',
        ageAtFathering: { value: 35, reference: 'GEN.11.12' },
        remainingYears: { value: 403, reference: 'GEN.11.13' },
      },
      deathRule: 'birth-plus-lifespan',
    });
    const { byId } = derive([gen11]);
    expect(byId.get('first')?.lifespan).toBe(438);
    expect(byId.get('first')?.lifespanConfidence).toBe('DERIVED');
  });

  it('leaves the total unknown when either half is unread', () => {
    const half = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', value: 0 },
      lifespan: {
        rule: 'sum-fathering-and-remainder',
        ageAtFathering: { value: 35, reference: 'GEN.11.12' },
        remainingYears: { value: null, reference: 'GEN.11.13' },
      },
      deathRule: 'birth-plus-lifespan',
    });
    const { byId } = derive([half]);
    expect(byId.get('first')?.lifespan).toBeNull();
    expect(byId.get('first')?.lifespanConfidence).toBe('UNKNOWN');
  });

  it('gives no death year when the text records none', () => {
    // Enoch. A lifespan and a birth year, and still no death, because
    // Genesis 5:24 does not give one.
    const enoch = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', value: 0 },
      lifespan: { rule: 'explicit', value: 365, reference: 'GEN.5.23' },
      deathRule: 'not-recorded',
    });
    const { byId } = derive([enoch]);
    expect(byId.get('first')?.lifespan).toBe(365);
    expect(byId.get('first')?.deathYear).toBeNull();
    expect(byId.get('first')?.deathConfidence).toBe('UNKNOWN');
  });
});

describe('deriveChronology: the anchored rules', () => {
  const terah = row({
    personId: 'terah',
    birthOffsetFromFather: { rule: 'epoch', value: 1000 },
    lifespan: { rule: 'explicit', value: 205, reference: 'GEN.11.32' },
    deathRule: 'birth-plus-lifespan',
  });

  it('derives a birth from a father’s lifespan less an age at departure', () => {
    const abraham = row({
      personId: 'abraham',
      father: 'terah',
      birthOffsetFromFather: {
        rule: 'terah-lifespan-minus-departure-age',
        sourceReferences: ['GEN.11.32', 'GEN.12.4', 'ACT.7.4'],
      },
      lifespan: { rule: 'explicit', value: 175, reference: 'GEN.25.7' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'ageAtDepartureFromHaran', value: 75, reference: 'GEN.12.4' },
      ],
    });
    const { byId } = derive([terah, abraham]);
    // 1000 + (205 - 75)
    expect(byId.get('abraham')?.birthYear).toBe(1130);
    expect(DerivationSchema.safeParse(byId.get('abraham')?.derivation).success).toBe(
      true,
    );
  });

  it('derives a birth backwards from a dependant’s', () => {
    const isaac = row({
      personId: 'isaac',
      birthOffsetFromFather: { rule: 'epoch', value: 1100 },
      lifespan: { rule: 'explicit', value: 180, reference: 'GEN.35.28' },
      deathRule: 'birth-plus-lifespan',
    });
    const sarah = row({
      personId: 'sarah',
      birthOffsetFromFather: {
        rule: 'derived-from-own-age-at-event',
        sourceReferences: ['GEN.17.17'],
      },
      lifespan: { rule: 'explicit', value: 127, reference: 'GEN.23.1' },
      deathRule: 'birth-plus-lifespan',
      dependsOn: ['isaac'],
      additionalFigures: [{ name: 'ageAtIsaacBirth', value: 90, reference: 'GEN.17.17' }],
    });
    const { byId } = derive([sarah, isaac]);
    expect(byId.get('sarah')?.birthYear).toBe(1010);
  });

  it('derives a birth from a chain of elapsed years in Egypt', () => {
    const jacob = row({
      personId: 'jacob',
      birthOffsetFromFather: { rule: 'epoch', value: 2000 },
      lifespan: { rule: 'explicit', value: 147, reference: 'GEN.47.28' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'ageBeforePharaoh', value: 130, reference: 'GEN.47.9' },
      ],
    });
    const joseph = row({
      personId: 'joseph',
      father: 'jacob',
      birthOffsetFromFather: {
        rule: 'joseph-from-egypt-years',
        sourceReferences: ['GEN.41.46', 'GEN.41.53', 'GEN.45.6', 'GEN.47.9'],
      },
      lifespan: { rule: 'explicit', value: 110, reference: 'GEN.50.26' },
      deathRule: 'birth-plus-lifespan',
      dependsOn: ['jacob'],
      additionalFigures: [
        { name: 'ageBeforePharaoh', value: 30, reference: 'GEN.41.46' },
        { name: 'yearsOfPlenty', value: 7, reference: 'GEN.41.53' },
        { name: 'yearsOfFamineAtJacobsArrival', value: 2, reference: 'GEN.45.6' },
      ],
    });
    const { byId } = derive([jacob, joseph]);
    // 2000 + (130 - (30 + 7 + 2))
    expect(byId.get('joseph')?.birthYear).toBe(2091);
  });

  it('leaves the Egypt chain unknown while any of its figures is unread', () => {
    // This is the real state of Joseph's record: the rule is implemented and
    // two of the four figures have not been read from the text, so the birth
    // year stays null rather than being filled in from somewhere else.
    const jacob = row({
      personId: 'jacob',
      birthOffsetFromFather: { rule: 'epoch', value: 2000 },
      lifespan: { rule: 'explicit', value: 147, reference: 'GEN.47.28' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'ageBeforePharaoh', value: 130, reference: 'GEN.47.9' },
      ],
    });
    const joseph = row({
      personId: 'joseph',
      father: 'jacob',
      birthOffsetFromFather: { rule: 'joseph-from-egypt-years' },
      lifespan: { rule: 'explicit', value: 110, reference: 'GEN.50.26' },
      deathRule: 'birth-plus-lifespan',
      dependsOn: ['jacob'],
      additionalFigures: [
        { name: 'ageBeforePharaoh', value: 30, reference: 'GEN.41.46' },
        { name: 'yearsOfPlenty', value: null, reference: 'GEN.41.53' },
        { name: 'yearsOfFamineAtJacobsArrival', value: null, reference: 'GEN.45.6' },
      ],
    });
    const { byId, unread } = derive([jacob, joseph]);
    expect(byId.get('joseph')?.birthYear).toBeNull();
    expect(byId.get('joseph')?.lifespan).toBe(110);
    expect(unread.get('joseph')).toBe(2);
  });

  it('derives a birth backwards through the flood', () => {
    const noah = row({
      personId: 'noah',
      birthOffsetFromFather: { rule: 'epoch', value: 1000 },
      lifespan: { rule: 'explicit', value: 950, reference: 'GEN.9.29' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [{ name: 'ageAtFlood', value: 600, reference: 'GEN.7.6' }],
    });
    const shem = row({
      personId: 'shem',
      father: 'noah',
      birthOffsetFromFather: {
        rule: 'shem-from-gen-11-10',
        sourceReferences: ['GEN.11.10'],
      },
      lifespan: {
        rule: 'sum-fathering-and-remainder',
        ageAtFathering: { value: 100, reference: 'GEN.11.10' },
        remainingYears: { value: 500, reference: 'GEN.11.11' },
      },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'yearsAfterFloodAtArphaxadBirth', value: 2, reference: 'GEN.11.10' },
      ],
    });
    const { byId } = derive([noah, shem]);
    // flood 1600, Arphaxad 1602, Shem 100 years earlier
    expect(byId.get('shem')?.birthYear).toBe(1502);
  });
});

describe('deriveChronology: provenance and hygiene', () => {
  it('never emits a VERIFIED record; review happens on the figures', () => {
    const { records } = derive([epoch, child]);
    expect(records.every((r) => r.reviewStatus === 'DRAFT')).toBe(true);
  });

  it('collects every reference the figures cite', () => {
    const { byId } = derive([epoch, child]);
    expect(byId.get('second')?.sourceReferences.sort()).toEqual(['GEN.5.3', 'GEN.5.8']);
  });

  it('ignores records belonging to another chronology', () => {
    const other = { ...epoch, chronologyId: 'elsewhere' };
    expect(deriveChronology([other], 'fixture').records).toEqual([]);
  });

  it('keeps every unknown value null rather than zero', () => {
    const { byId } = derive([row({ personId: 'nobody' })]);
    const record = byId.get('nobody');
    expect(record?.birthYear).toBeNull();
    expect(record?.deathYear).toBeNull();
    expect(record?.lifespan).toBeNull();
  });
});

describe('topologicalOrder', () => {
  it('places a father before their children', () => {
    const order = topologicalOrder([child, epoch], []);
    expect(order.indexOf('first')).toBeLessThan(order.indexOf('second'));
  });

  it('honours an explicit dependsOn as well as the father edge', () => {
    const anchored = row({ personId: 'sarah', dependsOn: ['second'] });
    const order = topologicalOrder([anchored, child, epoch], []);
    expect(order.indexOf('second')).toBeLessThan(order.indexOf('sarah'));
  });

  it('reports a circular dependency rather than looping', () => {
    const a = row({ personId: 'a', father: 'b' });
    const b = row({ personId: 'b', father: 'a' });
    const issues: Array<{ personId: string; message: string }> = [];
    topologicalOrder([a, b], issues);
    expect(issues[0]?.message).toContain('Circular chronology dependency');
  });

  it('ignores a father who is not in this chronology', () => {
    const orphan = row({ personId: 'a', father: 'not-here' });
    expect(topologicalOrder([orphan], [])).toEqual(['a']);
  });
});

describe('deriveEventChronology', () => {
  const people = deriveChronology([epoch, child], 'fixture').records;

  function events(rows: Array<Partial<EventChronologyInputRecord>>) {
    const full = rows.map((r) => ({
      eventId: 'an-event',
      chronologyId: 'fixture',
      rule: 'unknown' as const,
      value: null,
      reference: 'GEN.5.1',
      dateType: 'point' as const,
      assumptions: [],
      ...r,
    }));
    const result = deriveEventChronology(full, 'fixture', people);
    return { ...result, byId: new Map(result.records.map((r) => [r.eventId, r])) };
  }

  it('dates an event from an anchor’s birth plus a stated age', () => {
    const { byId } = events([
      { rule: 'person-age', anchorPersonId: 'second', value: 40 },
    ]);
    expect(byId.get('an-event')?.startYear).toBe(70);
    expect(byId.get('an-event')?.confidence).toBe('DERIVED');
  });

  it('extends the anchor’s own derivation rather than starting a new chain', () => {
    const { byId } = events([
      { rule: 'person-age', anchorPersonId: 'second', value: 40 },
    ]);
    const derivation = byId.get('an-event')?.derivation;
    expect(derivation?.steps.map((s) => s.runningTotal)).toEqual([30, 70]);
    expect(DerivationSchema.safeParse(derivation).success).toBe(true);
  });

  it('fixes the epoch without a derivation chain', () => {
    const { byId } = events([{ rule: 'epoch', value: 0 }]);
    expect(byId.get('an-event')?.startYear).toBe(0);
    expect(byId.get('an-event')?.derivation).toBeNull();
  });

  it('leaves an event the text gives no date for as UNKNOWN', () => {
    // Babel. Genesis 10:25 says the earth was divided in Peleg's days, which
    // is an era and not a date, so the timeline shows a gap.
    const { byId } = events([{ rule: 'unknown', dateType: 'unknown' }]);
    expect(byId.get('an-event')?.startYear).toBeNull();
    expect(byId.get('an-event')?.confidence).toBe('UNKNOWN');
  });

  it('reports a person-age event with no anchor', () => {
    const { issues } = events([{ rule: 'person-age', value: 10 }]);
    expect(issues[0]?.message).toBe('person-age rule with no anchorPersonId');
  });

  it('reports an anchor with no record in this chronology', () => {
    const { issues, byId } = events([
      { rule: 'person-age', anchorPersonId: 'nobody', value: 10 },
    ]);
    expect(issues[0]?.message).toContain('nobody');
    expect(byId.get('an-event')?.startYear).toBeNull();
  });

  it('leaves the event unknown when the anchor has no birth year', () => {
    const undatedPeople = deriveChronology(
      [row({ personId: 'nobody' })],
      'fixture',
    ).records;
    const result = deriveEventChronology(
      [
        {
          eventId: 'an-event',
          chronologyId: 'fixture',
          rule: 'person-age',
          anchorPersonId: 'nobody',
          value: 10,
          reference: 'GEN.5.1',
          dateType: 'point',
          assumptions: [],
        },
      ],
      'fixture',
      undatedPeople,
    );
    expect(result.records[0]?.startYear).toBeNull();
    expect(result.issues).toEqual([]);
  });

  it('ignores events belonging to another chronology', () => {
    const result = deriveEventChronology(
      [
        {
          eventId: 'an-event',
          chronologyId: 'elsewhere',
          rule: 'epoch',
          value: 0,
          reference: 'GEN.5.1',
          dateType: 'point',
          assumptions: [],
        },
      ],
      'fixture',
      people,
    );
    expect(result.records).toEqual([]);
  });
});

describe('the anchored rules stay unknown while any figure is missing', () => {
  it('will not date Shem when the flood figures are not all read', () => {
    const noah = row({
      personId: 'noah',
      birthOffsetFromFather: { rule: 'epoch', value: 1000 },
      lifespan: { rule: 'explicit', value: 950, reference: 'GEN.9.29' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [{ name: 'ageAtFlood', value: null, reference: 'GEN.7.6' }],
    });
    const shem = row({
      personId: 'shem',
      father: 'noah',
      birthOffsetFromFather: { rule: 'shem-from-gen-11-10' },
      lifespan: {
        rule: 'sum-fathering-and-remainder',
        ageAtFathering: { value: 100, reference: 'GEN.11.10' },
        remainingYears: { value: 500, reference: 'GEN.11.11' },
      },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'yearsAfterFloodAtArphaxadBirth', value: 2, reference: 'GEN.11.10' },
      ],
    });
    expect(derive([noah, shem]).byId.get('shem')?.birthYear).toBeNull();
  });

  it('will not date Abraham when the departure age is not read', () => {
    const terah = row({
      personId: 'terah',
      birthOffsetFromFather: { rule: 'epoch', value: 1000 },
      lifespan: { rule: 'explicit', value: 205, reference: 'GEN.11.32' },
      deathRule: 'birth-plus-lifespan',
    });
    const abraham = row({
      personId: 'abraham',
      father: 'terah',
      birthOffsetFromFather: { rule: 'terah-lifespan-minus-departure-age' },
      lifespan: { rule: 'explicit', value: 175, reference: 'GEN.25.7' },
      deathRule: 'birth-plus-lifespan',
    });
    expect(derive([terah, abraham]).byId.get('abraham')?.birthYear).toBeNull();
  });

  it('will not date Abraham when Terah has no stated lifespan', () => {
    const terah = row({
      personId: 'terah',
      birthOffsetFromFather: { rule: 'epoch', value: 1000 },
      lifespan: { rule: 'unknown' },
      deathRule: 'unknown',
    });
    const abraham = row({
      personId: 'abraham',
      father: 'terah',
      birthOffsetFromFather: { rule: 'terah-lifespan-minus-departure-age' },
      lifespan: { rule: 'explicit', value: 175, reference: 'GEN.25.7' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'ageAtDepartureFromHaran', value: 75, reference: 'GEN.12.4' },
      ],
    });
    expect(derive([terah, abraham]).byId.get('abraham')?.birthYear).toBeNull();
  });

  it('will not date Sarah when her anchor is undated', () => {
    const isaac = row({ personId: 'isaac' });
    const sarah = row({
      personId: 'sarah',
      birthOffsetFromFather: { rule: 'derived-from-own-age-at-event' },
      dependsOn: ['isaac'],
      additionalFigures: [{ name: 'ageAtIsaacBirth', value: 90, reference: 'GEN.17.17' }],
    });
    expect(derive([isaac, sarah]).byId.get('sarah')?.birthYear).toBeNull();
  });

  it('will not date Joseph when his father is undated', () => {
    const jacob = row({ personId: 'jacob' });
    const joseph = row({
      personId: 'joseph',
      father: 'jacob',
      birthOffsetFromFather: { rule: 'joseph-from-egypt-years' },
      dependsOn: ['jacob'],
      additionalFigures: [
        { name: 'ageBeforePharaoh', value: 30, reference: 'GEN.41.46' },
        { name: 'yearsOfPlenty', value: 7, reference: 'GEN.41.53' },
        { name: 'yearsOfFamineAtJacobsArrival', value: 2, reference: 'GEN.45.6' },
      ],
    });
    expect(derive([jacob, joseph]).byId.get('joseph')?.birthYear).toBeNull();
  });
});

describe('deriveEventChronology: an anchor whose own birth has no chain', () => {
  it('opens the chain with a single step from the epoch', () => {
    // The epoch person's birth year is a convention, not a derivation, so
    // there is no chain to extend. The event's own derivation still has to
    // start at year zero or its running totals would not add up.
    const people = deriveChronology([epoch], 'fixture').records;
    const result = deriveEventChronology(
      [
        {
          eventId: 'an-event',
          chronologyId: 'fixture',
          rule: 'person-age',
          anchorPersonId: 'first',
          value: 40,
          reference: 'GEN.7.6',
          dateType: 'point',
          assumptions: [],
        },
      ],
      'fixture',
      people,
    );
    const record = result.records[0];
    expect(record?.startYear).toBe(40);
    expect(record?.derivation?.steps).toHaveLength(2);
    expect(record?.derivation?.steps[0]?.from).toBe('epoch');
    expect(DerivationSchema.safeParse(record?.derivation).success).toBe(true);
  });
});

/**
 * Each anchored rule needs several figures at once, and any one of them
 * missing has to leave the birth year null rather than produce a number from
 * the rest. Blanking them one at a time is the only way to know that every
 * operand of the guard is actually load-bearing.
 */
describe('every figure an anchored rule needs is load-bearing', () => {
  const noah = (ageAtFlood: number | null) =>
    row({
      personId: 'noah',
      birthOffsetFromFather: { rule: 'epoch', value: 1000 },
      lifespan: { rule: 'explicit', value: 950, reference: 'GEN.9.29' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'ageAtFlood', value: ageAtFlood, reference: 'GEN.7.6' },
      ],
    });

  const shem = (patch: Partial<ChronologyInputRecord> = {}) =>
    row({
      personId: 'shem',
      father: 'noah',
      birthOffsetFromFather: { rule: 'shem-from-gen-11-10' },
      lifespan: {
        rule: 'sum-fathering-and-remainder',
        ageAtFathering: { value: 100, reference: 'GEN.11.10' },
        remainingYears: { value: 500, reference: 'GEN.11.11' },
      },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'yearsAfterFloodAtArphaxadBirth', value: 2, reference: 'GEN.11.10' },
      ],
      ...patch,
    });

  it.each([
    ['no father named', [noah(600), shem({ father: null })]],
    ['the father absent from the chronology', [shem({ father: 'nobody' })]],
    ['the father undated', [row({ personId: 'noah' }), shem()]],
    ['the flood age unread', [noah(null), shem()]],
    [
      'the years after the flood unread',
      [
        noah(600),
        shem({
          additionalFigures: [
            {
              name: 'yearsAfterFloodAtArphaxadBirth',
              value: null,
              reference: 'GEN.11.10',
            },
          ],
        }),
      ],
    ],
    [
      'the fathering age unread',
      [
        noah(600),
        shem({
          lifespan: {
            rule: 'sum-fathering-and-remainder',
            remainingYears: { value: 500, reference: 'GEN.11.11' },
          },
        }),
      ],
    ],
  ])('leaves Shem undated with %s', (_label, rows) => {
    expect(
      derive(rows as ChronologyInputRecord[]).byId.get('shem')?.birthYear,
    ).toBeNull();
  });

  const jacob = (ageBeforePharaoh: number | null) =>
    row({
      personId: 'jacob',
      birthOffsetFromFather: { rule: 'epoch', value: 2000 },
      lifespan: { rule: 'explicit', value: 147, reference: 'GEN.47.28' },
      deathRule: 'birth-plus-lifespan',
      additionalFigures: [
        { name: 'ageBeforePharaoh', value: ageBeforePharaoh, reference: 'GEN.47.9' },
      ],
    });

  const joseph = (
    figures: Array<[string, number | null]>,
    patch: Partial<ChronologyInputRecord> = {},
  ) =>
    row({
      personId: 'joseph',
      father: 'jacob',
      birthOffsetFromFather: { rule: 'joseph-from-egypt-years' },
      lifespan: { rule: 'explicit', value: 110, reference: 'GEN.50.26' },
      deathRule: 'birth-plus-lifespan',
      dependsOn: ['jacob'],
      additionalFigures: figures.map(([name, value]) => ({
        name,
        value,
        reference: 'GEN.41.46',
      })),
      ...patch,
    });

  const full: Array<[string, number | null]> = [
    ['ageBeforePharaoh', 30],
    ['yearsOfPlenty', 7],
    ['yearsOfFamineAtJacobsArrival', 2],
  ];

  it.each([
    ['no father named', [jacob(130), joseph(full, { father: null })]],
    ["Jacob's age before Pharaoh unread", [jacob(null), joseph(full)]],
    [
      "Joseph's own age before Pharaoh unread",
      [jacob(130), joseph([['ageBeforePharaoh', null], ...full.slice(1)])],
    ],
    [
      'the years of plenty unread',
      [
        jacob(130),
        joseph([
          full[0] as [string, number],
          ['yearsOfPlenty', null],
          full[2] as [string, number],
        ]),
      ],
    ],
    [
      'the years of famine unread',
      [
        jacob(130),
        joseph([
          full[0] as [string, number],
          full[1] as [string, number],
          ['yearsOfFamineAtJacobsArrival', null],
        ]),
      ],
    ],
  ])('leaves Joseph undated with %s', (_label, rows) => {
    expect(
      derive(rows as ChronologyInputRecord[]).byId.get('joseph')?.birthYear,
    ).toBeNull();
  });

  it('leaves Sarah undated when her anchor is not named', () => {
    const isaac = row({
      personId: 'isaac',
      birthOffsetFromFather: { rule: 'epoch', value: 1100 },
      lifespan: { rule: 'explicit', value: 180, reference: 'GEN.35.28' },
      deathRule: 'birth-plus-lifespan',
    });
    const sarah = row({
      personId: 'sarah',
      birthOffsetFromFather: { rule: 'derived-from-own-age-at-event' },
      additionalFigures: [{ name: 'ageAtIsaacBirth', value: 90, reference: 'GEN.17.17' }],
    });
    expect(derive([isaac, sarah]).byId.get('sarah')?.birthYear).toBeNull();
  });

  it('leaves Sarah undated when her own age at the anchor is unread', () => {
    const isaac = row({
      personId: 'isaac',
      birthOffsetFromFather: { rule: 'epoch', value: 1100 },
      lifespan: { rule: 'explicit', value: 180, reference: 'GEN.35.28' },
      deathRule: 'birth-plus-lifespan',
    });
    const sarah = row({
      personId: 'sarah',
      birthOffsetFromFather: { rule: 'derived-from-own-age-at-event' },
      dependsOn: ['isaac'],
    });
    expect(derive([isaac, sarah]).byId.get('sarah')?.birthYear).toBeNull();
  });
});

describe('the defaults each figure falls back to', () => {
  it('honours a confidence stated on a lifespan instead of assuming EXPLICIT', () => {
    const approximate = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', value: 0 },
      lifespan: {
        rule: 'explicit',
        value: 40,
        reference: 'GEN.5.5',
        confidence: 'APPROXIMATE',
      },
      deathRule: 'birth-plus-lifespan',
    });
    expect(derive([approximate]).byId.get('first')?.lifespanConfidence).toBe(
      'APPROXIMATE',
    );
  });

  it('treats an epoch with no stated value as year zero', () => {
    const bare = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', sourceReferences: ['GEN.5.1'] },
    });
    expect(derive([bare]).byId.get('first')?.birthYear).toBe(0);
  });

  it('carries a calculation method through when one is given', () => {
    const described = row({
      personId: 'first',
      birthOffsetFromFather: {
        rule: 'epoch',
        value: 0,
        calculationMethod: 'the epoch, by definition',
        sourceReferences: ['GEN.5.1'],
      },
    });
    expect(derive([described]).byId.get('first')?.calculationMethod).toBe(
      'the epoch, by definition',
    );
  });

  it('carries a note through when one is given', () => {
    const noted = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', value: 0, sourceReferences: ['GEN.5.1'] },
      notes: 'Scripture states no ages for this person.',
    });
    expect(derive([noted]).byId.get('first')?.notes).toBe(
      'Scripture states no ages for this person.',
    );
  });
});

describe('the last fallbacks', () => {
  it('leaves an explicit lifespan unknown when its figure is unread', () => {
    const unread = row({
      personId: 'first',
      birthOffsetFromFather: { rule: 'epoch', value: 0 },
      lifespan: { rule: 'explicit', reference: 'GEN.5.5' },
      deathRule: 'birth-plus-lifespan',
    });
    const { byId, unread: pending } = derive([unread]);
    expect(byId.get('first')?.lifespan).toBeNull();
    expect(byId.get('first')?.deathYear).toBeNull();
    expect(pending.get('first')).toBe(1);
  });

  it('still derives a birth when the offset cites no reference', () => {
    const bare = row({
      personId: 'second',
      father: 'first',
      birthOffsetFromFather: { rule: 'father-age', value: 30 },
      deathRule: 'unknown',
    });
    const { byId } = derive([epoch, bare]);
    expect(byId.get('second')?.birthYear).toBe(30);
    expect(byId.get('second')?.derivation?.steps[0]?.reference).toBe('');
  });

  it('leaves Abraham undated when the record names no father at all', () => {
    const orphan = row({
      personId: 'abraham',
      birthOffsetFromFather: { rule: 'terah-lifespan-minus-departure-age' },
      additionalFigures: [
        { name: 'ageAtDepartureFromHaran', value: 75, reference: 'GEN.12.4' },
      ],
    });
    expect(derive([orphan]).byId.get('abraham')?.birthYear).toBeNull();
  });

  it('ignores a dependsOn pointing outside this chronology', () => {
    const anchored = row({ personId: 'a', dependsOn: ['not-here'] });
    expect(topologicalOrder([anchored], [])).toEqual(['a']);
  });
});

describe('deriveEventChronology: the last fallbacks', () => {
  function run(
    rows: EventChronologyInputRecord[],
    people: Parameters<typeof deriveEventChronology>[2],
  ) {
    return deriveEventChronology(rows, 'fixture', people);
  }

  const base: EventChronologyInputRecord = {
    eventId: 'an-event',
    chronologyId: 'fixture',
    rule: 'epoch',
    value: null,
    reference: 'GEN.5.1',
    dateType: 'point',
    assumptions: [],
  };

  it('treats an epoch event with no stated value as year zero', () => {
    const result = run([base], []);
    expect(result.records[0]?.startYear).toBe(0);
  });

  it('falls back to the event’s own reference when the anchor cites none', () => {
    const anchor = deriveChronology([epoch], 'fixture').records.map((r) => ({
      ...r,
      sourceReferences: [],
    }));
    const result = run(
      [{ ...base, rule: 'person-age', anchorPersonId: 'first', value: 40 }],
      anchor,
    );
    expect(result.records[0]?.derivation?.steps[0]?.reference).toBe('GEN.5.1');
  });
});

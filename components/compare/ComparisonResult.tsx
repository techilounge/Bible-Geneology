import Link from 'next/link';
import { ChronologyValue } from '@/components/chronology/ChronologyValue';
import { SourceList } from '@/components/chronology/SourceList';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import type { TimelineRow } from '@/lib/chronology/scale';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import { CONNECTION_IS_NOT_A_ROUTE, NOT_CONTACT } from '@/lib/config/copy';
import type { ChronologyResult, Person, ScriptureReference } from '@/lib/domain';
import type {
  Age,
  LifespanComparison,
  Overlap,
  RelationshipEdge,
} from '@/lib/chronology';

/**
 * The answer to "could these two have met?", and the limits of that answer.
 *
 * Requirement section 21, which is the rule this whole page exists to obey:
 * a lifetime overlap means two people were alive in the same years. It is
 * not evidence that they met, knew of each other, or that anything passed
 * between them. The sentence that says so lives in lib/config/copy.ts and
 * is rendered on every comparison, whatever the answer.
 */

export interface ComparisonProps {
  a: Person;
  b: Person;
  overlap: ChronologyResult<Overlap>;
  lifespans: ChronologyResult<LifespanComparison>;
  aAtBsBirth: ChronologyResult<Age>;
  bAtAsBirth: ChronologyResult<Age>;
  relationship: RelationshipEdge[] | null;
  /** Shortest chain of overlapping lifetimes, when the two do not overlap. */
  connection: string[] | null;
  nameOf: Record<string, string>;
  rows: readonly TimelineRow[];
  bounds: readonly [number, number];
  references: readonly ScriptureReference[];
}

export function ComparisonResult({
  a,
  b,
  overlap,
  lifespans,
  aAtBsBirth,
  bAtAsBirth,
  relationship,
  connection,
  nameOf,
  rows,
  bounds,
  references,
}: ComparisonProps) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold" data-testid="verdict">
          <Verdict a={a} b={b} overlap={overlap} />
        </h2>
        <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">
          {NOT_CONTACT}
        </p>
      </section>

      <TimelineChart
        rows={rows}
        events={[]}
        bounds={bounds}
        highlighted={new Set(rows.map((row) => row.personId))}
        describedAs={`The two lifetimes drawn on one axis, described in full below.`}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ages</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <Row label={`${a.canonicalName} when ${b.canonicalName} was born`}>
            <ChronologyValue
              result={aAtBsBirth}
              render={(age) => <AgeValue age={age} name={a.canonicalName} />}
            />
          </Row>
          <Row label={`${b.canonicalName} when ${a.canonicalName} was born`}>
            <ChronologyValue
              result={bAtAsBirth}
              render={(age) => <AgeValue age={age} name={b.canonicalName} />}
            />
          </Row>
          <Row label="Lifespans">
            <ChronologyValue
              result={lifespans}
              render={(value) => <Lifespans value={value} a={a} b={b} />}
            />
          </Row>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">How they are related</h2>
        {relationship === null ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            This dataset records no line of relationships connecting them. That is a
            statement about what has been entered, not about the family.
          </p>
        ) : relationship.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">The same person.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {relationship.map((edge) => (
              <li key={`${edge.from}-${edge.to}-${edge.type}`}>
                <span className="font-medium">{nameOf[edge.to] ?? edge.to}</span> is the{' '}
                {edge.type.replace(/_/g, ' ')} of{' '}
                <span className="font-medium">{nameOf[edge.from] ?? edge.from}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {connection === null ? null : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Lifetime connection</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            The shortest chain of overlapping lifetimes between them:
          </p>
          <p className="text-sm font-medium" data-testid="connection-chain">
            {connection.map((id) => nameOf[id] ?? id).join(' → ')}
          </p>
          <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
            {CONNECTION_IS_NOT_A_ROUTE}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Where these dates come from</h2>
        <SourceList references={references} label="Verses" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Every year on this page is calculated from the ages Scripture states. See{' '}
          <Link
            href={`/people/${a.slug}`}
            className="underline decoration-[var(--color-accent)] underline-offset-4"
          >
            {a.canonicalName}
          </Link>{' '}
          and{' '}
          <Link
            href={`/people/${b.slug}`}
            className="underline decoration-[var(--color-accent)] underline-offset-4"
          >
            {b.canonicalName}
          </Link>{' '}
          for the working behind each birth year.
        </p>
      </section>
    </div>
  );
}

function Verdict({
  a,
  b,
  overlap,
}: {
  a: Person;
  b: Person;
  overlap: ChronologyResult<Overlap>;
}) {
  if (overlap.status === 'unknown') {
    return (
      <>
        This chronology cannot say whether {a.canonicalName} and {b.canonicalName} were
        ever alive at the same time.
      </>
    );
  }
  if (overlap.status === 'disputed') {
    return (
      <>
        Readings disagree about whether {a.canonicalName} and {b.canonicalName} were alive
        at the same time.
      </>
    );
  }

  const value = overlap.value;

  if (value.overlaps) {
    return (
      <>
        Yes, both were alive at the same time: {value.years} years, from{' '}
        {value.overlapStart} to {value.overlapEnd} {EPOCH_LABEL}.
      </>
    );
  }

  if (value.sameYearBoundary) {
    return (
      <>
        One life ends in the very year the other begins. This chronology counts a lifetime
        up to but not including the year of death, so that is no overlap at all — and the
        text is not precise enough to say more.
      </>
    );
  }

  return (
    <>
      No. Their lifetimes are {value.gapYears} {value.gapYears === 1 ? 'year' : 'years'}{' '}
      apart, so this chronology places them alive at no common time.
    </>
  );
}

function AgeValue({ age, name }: { age: Age; name: string }) {
  return (
    <span>
      <span className="font-mono tabular-nums">{age.years}</span>
      {age.posthumous ? ` — ${name} had already died` : ''}
    </span>
  );
}

function Lifespans({ value, a, b }: { value: LifespanComparison; a: Person; b: Person }) {
  const longer = value.longerPersonId;
  return (
    <span>
      <span className="font-mono tabular-nums">{value.lifespans[a.id]}</span> and{' '}
      <span className="font-mono tabular-nums">{value.lifespans[b.id]}</span> years.{' '}
      {longer === null
        ? 'The same.'
        : `${longer === a.id ? a.canonicalName : b.canonicalName} by ${value.differenceYears}.`}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

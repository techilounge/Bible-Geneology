import type { PersonChronology, ScriptureReference } from '@/lib/domain';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SourceList } from './SourceList';

/**
 * Birth, death and lifespan, each with its own confidence.
 *
 * The three are labelled separately because they genuinely differ: a
 * Genesis 5 lifespan is stated outright while the birth year it pairs with
 * is arithmetic, and showing one badge for the row would overstate one of
 * them. Requirement section 5.
 */
function Row({
  label,
  value,
  confidence,
  note,
}: {
  label: string;
  value: string;
  confidence: PersonChronology['birthConfidence'];
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--color-border-subtle)] py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-28 shrink-0 text-sm text-[var(--color-text-muted)]">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-lg tabular-nums">{value}</span>
        <ConfidenceBadge level={confidence} />
        {note ? (
          <span className="text-sm text-[var(--color-text-muted)]">{note}</span>
        ) : null}
      </dd>
    </div>
  );
}

export function PersonDates({
  record,
  references,
}: {
  record: PersonChronology;
  references: readonly ScriptureReference[];
}) {
  const year = (value: number | null) =>
    value === null ? 'Not given' : `${value} ${EPOCH_LABEL}`;

  // Enoch. A lifespan and a birth year and no death, because Genesis 5:24
  // records none. The row says so rather than disappearing.
  const openEnded = record.birthYear !== null && record.deathYear === null;

  return (
    <div className="flex flex-col">
      <dl className="flex flex-col">
        <Row
          label="Born"
          value={year(record.birthYear)}
          confidence={record.birthConfidence}
        />
        <Row
          label="Died"
          value={year(record.deathYear)}
          confidence={record.deathConfidence}
          {...(openEnded ? { note: 'Scripture records no death for this person.' } : {})}
        />
        <Row
          label="Lifespan"
          value={record.lifespan === null ? 'Not given' : `${record.lifespan} years`}
          confidence={record.lifespanConfidence}
        />
      </dl>
      <div className="pt-3">
        <SourceList references={references} />
      </div>
    </div>
  );
}

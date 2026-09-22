import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChronologyValue } from '@/components/chronology/ChronologyValue';
import { PersonDates } from '@/components/chronology/PersonDates';
import { UndatedNotice } from '@/components/chronology/UndatedNotice';
import { WhyThisDate } from '@/components/chronology/WhyThisDate';
import { FavouriteButton } from '@/components/account/FavouriteButton';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import {
  getAgeAtPersonBirth,
  getEventsDuringLifetime,
  getLifetimeOverlap,
  lookup,
} from '@/lib/chronology';
import { childrenOf, parentsOf, siblingsOf, spousesOf } from '@/lib/graph/relationships';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import {
  getAssumptions,
  getCanonical,
  getDataset,
  getEvent,
  getNamesFor,
  getPersonBySlug,
  nameOf,
  resolveReferences,
} from '@/lib/services/dataset';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { User } from 'lucide-react';

export function generateStaticParams() {
  return getCanonical().people.map((person) => ({ slug: person.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = getPersonBySlug(slug);
  if (!person) return { title: 'Person not found' };

  const record = lookup(getDataset(), person.id);
  const dates =
    record?.birthYear !== null && record?.birthYear !== undefined
      ? `${record.birthYear}–${record.deathYear ?? '?'} ${EPOCH_LABEL}`
      : 'Dates not given in Scripture';

  return {
    title: person.canonicalName,
    description: `${person.canonicalName}. ${dates}. Every date shown with its source and its working.`,
  };
}

function PersonLink({ id }: { id: string }) {
  const person = getCanonical().people.find((p) => p.id === id);
  if (!person) return <span>{id}</span>;
  return (
    <Link
      href={`/people/${person.slug}`}
      className="rounded underline underline-offset-4 hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      {person.canonicalName}
    </Link>
  );
}

function RelationGroup({ label, ids }: { label: string; ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="w-24 shrink-0 text-sm text-[var(--color-text-muted)]">
        {label}
      </span>
      {ids.map((id, index) => (
        <span key={id}>
          <PersonLink id={id} />
          {index < ids.length - 1 ? ',' : ''}
        </span>
      ))}
    </div>
  );
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const person = getPersonBySlug(slug);
  if (!person) notFound();

  const dataset = getDataset();
  const canonical = getCanonical();
  const record = lookup(dataset, person.id);
  const names = getNamesFor(person.id);
  const relationships = canonical.relationships;

  const references = resolveReferences(record?.sourceReferences ?? []);
  const primary = resolveReferences(person.primaryScriptureReferences);
  const assumptions = getAssumptions(record?.derivation?.assumptions ?? []);

  const parents = parentsOf(relationships, person.id);
  const children = childrenOf(relationships, person.id);

  // Whose lifetimes overlapped this one. The wording is deliberate and is
  // enforced in copy review: an overlap is not evidence anyone met.
  const contemporaries =
    record?.birthYear !== null && record?.deathYear !== null && record !== null
      ? [...dataset.chronology.values()]
          .filter((other) => other.personId !== person.id)
          .map((other) => ({
            other,
            overlap: getLifetimeOverlap(dataset, person.id, other.personId),
          }))
          .filter((row) => row.overlap.status === 'known' && row.overlap.value.overlaps)
          .map((row) => ({
            personId: row.other.personId,
            years: row.overlap.status === 'known' ? row.overlap.value.years : 0,
          }))
          .sort((a, b) => b.years - a.years)
      : [];

  const events = getEventsDuringLifetime(dataset, person.id);
  const hasPortrait = existsSync(
    join(process.cwd(), 'public', 'assets', `${person.slug}.jpg`),
  );

  return (
    <PageShell>
      <Breadcrumbs
        items={[{ label: 'People', href: '/people' }, { label: person.canonicalName }]}
      />
      <PageHeader
        eyebrow={canonical.eras.find((e) => e.id === person.eraId)?.name}
        title={person.canonicalName}
        icon={<User className="size-4" />}
        lede={person.description ?? undefined}
      >
        {names.length > 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Also called{' '}
            {names.map((n, i) => (
              <span key={n.name}>
                <span className="font-medium">{n.name}</span>
                {n.notes ? (
                  <span className="text-[var(--color-text-muted)]"> ({n.notes})</span>
                ) : null}
                {i < names.length - 1 ? '; ' : ''}
              </span>
            ))}
          </p>
        ) : null}
        <FavouriteButton
          entityType="person"
          entityId={person.id}
          next={`/people/${person.slug}`}
          label={`Save ${person.canonicalName} to your account`}
        />
      </PageHeader>

      {hasPortrait ? (
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] shadow-xl max-w-xl">
          <img
            src={`/assets/${person.slug}.jpg`}
            alt={`Artistic portrait of ${person.canonicalName}`}
            className="w-full h-80 object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-base)] via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-accent)] uppercase bg-[var(--color-surface-base)]/80 backdrop-blur-md px-3 py-1 rounded-full border border-[var(--color-border-subtle)]">
              {person.gender === 'female' ? 'Matriarch Portrait' : 'Patriarch Portrait'}
            </span>
          </div>
        </div>
      ) : null}

      {record === null ? (
        <UndatedNotice name={person.canonicalName} />
      ) : record.birthYear === null &&
        record.deathYear === null &&
        record.lifespan === null ? (
        <UndatedNotice name={person.canonicalName} />
      ) : (
        <Card className="flex flex-col gap-4">
          <CardTitle>Dates</CardTitle>
          <PersonDates record={record} references={references} />
        </Card>
      )}

      {record?.derivation ? (
        <WhyThisDate
          derivation={record.derivation}
          references={resolveReferences(
            record.derivation.steps.map((step) => step.reference),
          )}
          assumptions={assumptions}
          calculationMethod={record.calculationMethod}
        />
      ) : null}

      <Card className="flex flex-col gap-3">
        <CardTitle>Family</CardTitle>
        <RelationGroup label="Parents" ids={parents} />
        <RelationGroup label="Spouses" ids={spousesOf(relationships, person.id)} />
        <RelationGroup label="Siblings" ids={siblingsOf(relationships, person.id)} />
        <RelationGroup label="Children" ids={children} />
        {parents.length === 0 &&
        children.length === 0 &&
        spousesOf(relationships, person.id).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No relationships are recorded for {person.canonicalName} in this dataset.
          </p>
        ) : null}
        {parents.length > 0 ? (
          <div className="flex flex-col gap-1 pt-2">
            {parents.map((parentId) => (
              <p key={parentId} className="text-sm text-[var(--color-text-secondary)]">
                {nameOf(parentId)} was{' '}
                <ChronologyValue
                  result={getAgeAtPersonBirth(dataset, parentId, person.id)}
                  render={(age) => <span className="font-medium">{age.years}</span>}
                  showConfidence={false}
                />{' '}
                when {person.canonicalName} was born.
              </p>
            ))}
          </div>
        ) : null}
      </Card>

      {contemporaries.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <CardTitle>Lifetimes that overlapped</CardTitle>
          <p className="text-sm text-[var(--color-text-muted)]">
            These people were alive at the same time as {person.canonicalName}. That is
            all it means: an overlap is not evidence they met or knew of each other.
          </p>
          <ul className="flex flex-col gap-1">
            {contemporaries.map((row) => (
              <li
                key={row.personId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border-subtle)] py-1 last:border-0"
              >
                <PersonLink id={row.personId} />
                <span className="font-mono text-sm tabular-nums text-[var(--color-text-muted)]">
                  {row.years} years
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {events.status === 'known' && events.value.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <CardTitle>Events during this lifetime</CardTitle>
          <ul className="flex flex-col gap-1">
            {events.value.map((entry) => (
              <li
                key={entry.eventId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border-subtle)] py-1 last:border-0"
              >
                <span>{getEvent(entry.eventId)?.name ?? entry.eventId}</span>
                <span className="font-mono text-sm tabular-nums text-[var(--color-text-muted)]">
                  {entry.startYear} {EPOCH_LABEL} &middot; aged {entry.ageAtEvent}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {primary.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>Where {person.canonicalName} appears</CardTitle>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--color-text-secondary)]">
            {primary.map((reference) => (
              <span key={reference.id}>{reference.displayLabel}</span>
            ))}
          </p>
        </Card>
      ) : null}
    </PageShell>
  );
}

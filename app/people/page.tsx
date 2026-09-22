import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import {
  PeopleDirectory,
  type DirectoryEntry,
} from '@/components/people/PeopleDirectory';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { lookup } from '@/lib/chronology';
import { getCanonical, getDataset } from '@/lib/services/dataset';

export const metadata: Metadata = {
  title: 'People',
  description:
    'Everyone in the dataset, with their dates where Scripture gives them and a ' +
    'plain statement where it does not.',
};

export default function PeoplePage() {
  const canonical = getCanonical();
  const dataset = getDataset();
  const eras = new Map(canonical.eras.map((era) => [era.id, era]));

  const entries: DirectoryEntry[] = [...canonical.people]
    .sort((a, b) => {
      const era =
        (eras.get(a.eraId ?? '')?.sortOrder ?? 0) -
        (eras.get(b.eraId ?? '')?.sortOrder ?? 0);
      if (era !== 0) return era;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    })
    .map((person) => {
      const record = lookup(dataset, person.id);
      return {
        id: person.id,
        slug: person.slug,
        name: person.canonicalName,
        aliases: canonical.personNames
          .filter((n) => n.personId === person.id)
          .map((n) => n.name),
        eraName: eras.get(person.eraId ?? '')?.name ?? null,
        birthYear: record?.birthYear ?? null,
        deathYear: record?.deathYear ?? null,
        birthConfidence: record?.birthConfidence ?? 'UNKNOWN',
        hasPortrait: existsSync(
          join(process.cwd(), 'public', 'assets', `${person.slug}.jpg`),
        ),
      };
    });

  const dated = entries.filter((entry) => entry.birthYear !== null).length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Directory"
        title="People"
        icon={<Users className="size-4" />}
        lede={`${entries.length} people, of whom ${dated} can be placed on a timeline. The rest appear here too: Scripture names them and gives no ages, and leaving them out would hide that.`}
      />
      <PeopleDirectory entries={entries} />
    </PageShell>
  );
}

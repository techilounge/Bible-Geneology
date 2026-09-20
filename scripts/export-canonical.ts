import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalPerson,
  canonicalRelationship,
  isVerified,
  mergeCanonical,
  relationshipKey,
  type CanonicalPerson,
  type CanonicalRelationship,
} from '@/lib/admin';
import { withClient } from './db';

/**
 * Carries VERIFIED rows out of the database and back into
 * `data/canonical`, where git is the system of record and a diff is how
 * a change gets reviewed.
 *
 * It reports by default and writes only when asked, because an export
 * that rewrites files as a side effect of looking at them is an export
 * nobody runs twice. It does not commit, branch, push or open a pull
 * request: it prints what to run, and a person decides.
 *
 * Only VERIFIED rows are exported, and nothing is ever removed — see
 * lib/admin/export.ts for both rules and their tests.
 */
const CANONICAL = join(process.cwd(), 'data', 'canonical');

function read<T>(name: string): T[] {
  return JSON.parse(readFileSync(join(CANONICAL, name), 'utf8')) as T[];
}

function write(name: string, records: unknown[]): void {
  writeFileSync(join(CANONICAL, name), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

/** Reference ids attached to each entity of a type, as a lookup. */
async function referencesFor(
  query: (sql: string) => Promise<Array<{ entity_id: string; reference_id: string }>>,
  entityType: string,
): Promise<Map<string, string[]>> {
  const rows = await query(
    `SELECT entity_id, reference_id FROM scripture_attachments
      WHERE entity_type = '${entityType}'`,
  );
  const byEntity = new Map<string, string[]>();
  for (const row of rows) {
    const existing = byEntity.get(row.entity_id);
    if (existing) existing.push(row.reference_id);
    else byEntity.set(row.entity_id, [row.reference_id]);
  }
  return byEntity;
}

async function main(): Promise<void> {
  const shouldWrite = process.argv.includes('--write');

  await withClient(async (client) => {
    const query = async (sql: string) =>
      (await client.query(sql)).rows as Array<{
        entity_id: string;
        reference_id: string;
      }>;

    const people = (await client.query('SELECT * FROM people')).rows as Array<
      Record<string, unknown>
    >;
    const relationships = (await client.query('SELECT * FROM relationships'))
      .rows as Array<Record<string, unknown>>;

    const personRefs = await referencesFor(query, 'person');
    const relationshipRefs = await referencesFor(query, 'relationship');

    const exportedPeople = people
      .filter(isVerified)
      .map((row) => canonicalPerson(row, personRefs.get(String(row.id)) ?? []));

    const exportedRelationships = relationships
      .filter(isVerified)
      .map((row) =>
        canonicalRelationship(row, relationshipRefs.get(String(row.id)) ?? []),
      );

    const peopleResult = mergeCanonical(
      read<CanonicalPerson>('people.json'),
      exportedPeople,
      (record) => record.id,
    );
    const relationshipResult = mergeCanonical(
      read<CanonicalRelationship>('relationships.json'),
      exportedRelationships,
      relationshipKey,
    );

    const report = [
      `people.json:        ${peopleResult.replaced.length} changed, ${peopleResult.added.length} added`,
      `relationships.json: ${relationshipResult.replaced.length} changed, ${relationshipResult.added.length} added`,
    ];
    console.log(
      `\n  Verified in the database: ${exportedPeople.length} people, ${exportedRelationships.length} relationships`,
    );
    for (const line of report) console.log(`  ${line}`);

    const changes =
      peopleResult.replaced.length +
      peopleResult.added.length +
      relationshipResult.replaced.length +
      relationshipResult.added.length;

    if (!shouldWrite) {
      console.log(
        changes === 0
          ? '\n  The files already say what the database says. Nothing to write.\n'
          : '\n  Nothing written. Run with --write to apply, then review the diff.\n',
      );
      return;
    }

    write('people.json', peopleResult.merged);
    write('relationships.json', relationshipResult.merged);
    console.log('\n  Written. Now review it the way any other change is reviewed:');
    console.log('    npm run validate');
    console.log('    git switch -c export/canonical-$(date +%Y-%m-%d)');
    console.log('    git add data/canonical && git commit');
    console.log('    git push -u origin HEAD   # then open the pull request\n');
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

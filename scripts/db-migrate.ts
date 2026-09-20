import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withClient } from './db';

/**
 * Applies every migration in supabase/migrations in filename order, inside a
 * transaction each, and records what it applied.
 *
 * Migrations are also written to be idempotent on their own (IF NOT EXISTS,
 * DROP POLICY IF EXISTS before CREATE POLICY), so re-running a migration by
 * hand against a database is safe. The ledger is what makes a normal run cheap;
 * the idempotency is what makes a mistake harmless.
 */
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function main() {
  const force = process.argv.includes('--force');

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (
        await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')
      ).rows.map((r) => r.filename),
    );

    let ran = 0;
    for (const file of files) {
      if (applied.has(file) && !force) {
        console.log(`  skip   ${file}`);
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file],
        );
        await client.query('COMMIT');
        console.log(`  apply  ${file}`);
        ran += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`\nMigration failed: ${file}\n`);
        throw error;
      }
    }

    console.log(`\n${ran} migration(s) applied, ${files.length - ran} already present.`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { withClient } from './db';

/**
 * Fails if any table in the public schema has row level security off, or if a
 * canonical table has acquired a write policy.
 *
 * docs/SECURITY.md section 4 says RLS is enabled in the migration that creates
 * each table and that canonical tables have no client write path. Both are
 * claims that decay silently, so they are checked rather than trusted.
 */

/** Tables that legitimately accept writes through a client, owner-scoped. */
const USER_WRITABLE = new Set([
  'favorites',
  'saved_comparisons',
  'quiz_attempts',
  'user_achievements',
  'learning_progress',
  'profiles',
]);

/** Bookkeeping, not part of the data model. */
const EXEMPT = new Set(['schema_migrations']);

async function main() {
  const problems: string[] = [];

  await withClient(async (client) => {
    const tables = await client.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity
         FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename`,
    );

    if (tables.rows.length === 0) {
      throw new Error('No tables found in the public schema; has db:migrate run?');
    }

    for (const { tablename, rowsecurity } of tables.rows) {
      if (EXEMPT.has(tablename)) continue;
      if (!rowsecurity) {
        problems.push(`${tablename}: row level security is DISABLED`);
      }
    }

    const policies = await client.query<{
      tablename: string;
      policyname: string;
      cmd: string;
    }>(
      `SELECT tablename, policyname, cmd
         FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname`,
    );

    for (const { tablename, policyname, cmd } of policies.rows) {
      const isWrite = cmd !== 'SELECT';
      if (isWrite && !USER_WRITABLE.has(tablename)) {
        problems.push(
          `${tablename}: unexpected ${cmd} policy "${policyname}" on a canonical table`,
        );
      }
    }

    for (const { tablename } of tables.rows) {
      if (EXEMPT.has(tablename)) continue;
      const has = policies.rows.some((p) => p.tablename === tablename);
      if (!has) {
        problems.push(
          `${tablename}: RLS is on but no policy exists, so it is unreadable`,
        );
      }
    }

    // The audit log must not be rewritable by anyone, including an admin.
    const auditWrite = policies.rows.filter(
      (p) => p.tablename === 'audit_logs' && p.cmd !== 'SELECT',
    );
    if (auditWrite.length > 0) {
      problems.push('audit_logs: has a write policy; the log must be append-only');
    }

    console.log(
      `Checked ${tables.rows.length} tables and ${policies.rows.length} policies.`,
    );
  });

  if (problems.length > 0) {
    console.error('\nRLS check failed:\n');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log('RLS check passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

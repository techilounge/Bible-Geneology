import { Client } from 'pg';

export function dbUrl(): string {
  return (
    process.env.DATABASE_URL ??
    'postgres://postgres@127.0.0.1:5432/bible_timeline_explorer'
  );
}

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: dbUrl() });
  await client.connect();
  return client;
}

/**
 * Runs a block as a given Supabase role with a given auth.uid(), inside a
 * transaction that is always rolled back.
 *
 * This is what makes the RLS suite meaningful: the policies under test are the
 * real ones, evaluated by Postgres, against a request that genuinely looks like
 * it came from that user.
 */
export async function asUser<T>(
  client: Client,
  role: 'anon' | 'authenticated' | 'service_role',
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query('SELECT set_config($1, $2, true)', [
      'request.jwt.claim.sub',
      userId ?? '',
    ]);
    return await fn();
  } finally {
    await client.query('ROLLBACK');
  }
}

/** Seeds the minimum rows the constraint and isolation tests need. */
export async function seedFixtures(client: Client) {
  await client.query(`
    INSERT INTO auth.users (id, email) VALUES
      ('11111111-1111-1111-1111-111111111111', 'alice@example.test'),
      ('22222222-2222-2222-2222-222222222222', 'bob@example.test')
    ON CONFLICT DO NOTHING;

    INSERT INTO profiles (id, display_name, role) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Alice', 'user'),
      ('22222222-2222-2222-2222-222222222222', 'Bob', 'user')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO chronologies (id, name, description, is_default) VALUES
      ('masoretic', 'Masoretic', 'Masoretic Text chronology', true)
    ON CONFLICT (id) DO NOTHING;

    -- A VERIFIED row now has to say why and against what, which is the
    -- Phase 14 rule. The fixtures obey it like any other writer.
    INSERT INTO people (id, canonical_name, slug, review_status, revision_notes, verification) VALUES
      ('adam', 'Adam', 'adam', 'VERIFIED', 'Seeded for the test suite',
       '{"method":"fixture","sources":["genesis"]}'::jsonb),
      ('seth', 'Seth', 'seth', 'VERIFIED', 'Seeded for the test suite',
       '{"method":"fixture","sources":["genesis"]}'::jsonb),
      ('enosh', 'Enosh', 'enosh', 'DRAFT', NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  `);
}

import { Client } from 'pg';

/**
 * Connection details for the database migrations and integration tests run
 * against. Defaults to a local Postgres; never reads production credentials
 * from anywhere but the environment.
 */
export function connectionString(): string {
  return (
    process.env.DATABASE_URL ??
    'postgres://postgres@localhost:5432/bible_timeline_explorer'
  );
}

export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

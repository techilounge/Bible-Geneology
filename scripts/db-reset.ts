import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectionString } from './db';

/**
 * Drops and recreates the local database, then applies the Supabase shim.
 *
 * Local development only. It refuses to run against a non-local host, so a
 * mistyped DATABASE_URL cannot drop a hosted database.
 */
async function main() {
  const url = new URL(connectionString());

  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`Refusing to reset a non-local database (host: ${url.hostname})`);
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Refusing to reset a database with an unexpected name: ${dbName}`);
  }

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  const shim = await readFile(
    join(process.cwd(), 'scripts', 'bootstrap-local-db.sql'),
    'utf8',
  );
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query(shim);
  } finally {
    await client.end();
  }

  console.log(`Reset ${dbName} and applied the local Supabase shim.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

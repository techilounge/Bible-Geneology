import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, connect, seedFixtures } from './helpers';

/**
 * The Phase 14 exit gate, in the database.
 *
 * Three claims: a non-admin cannot mutate a canonical table, marking a
 * record VERIFIED needs a reason and writes an audit row, and editing a
 * VERIFIED record needs a reason and source information.
 *
 * The first is checked from every client role there is, including
 * admin, because the architecture's claim is stronger than "admins
 * only": there is no client write path to a canonical table at all, in
 * any role. The admin CMS writes through the service role after checking
 * the caller, which is a different thing entirely.
 */
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

const CANONICAL = [
  {
    table: 'people',
    insert: `INSERT INTO people (id, canonical_name, slug) VALUES ('mallory', 'Mallory', 'mallory')`,
  },
  {
    table: 'relationships',
    insert: `INSERT INTO relationships (source_person_id, target_person_id, relationship_type, confidence, source_type) VALUES ('adam', 'seth', 'parent', 'EXPLICIT', 'SCRIPTURE_EXPLICIT')`,
  },
  {
    table: 'events',
    insert: `INSERT INTO events (id, name, slug) VALUES ('e-mallory', 'Mallory', 'e-mallory')`,
  },
  {
    table: 'scripture_references',
    insert: `INSERT INTO scripture_references (id, book, chapter) VALUES ('ref-mallory', 'Genesis', 1)`,
  },
  {
    table: 'sources',
    insert: `INSERT INTO sources (id, name, source_type) VALUES ('src-mallory', 'Mallory', 'SCRIPTURE_EXPLICIT')`,
  },
];

const VERIFIED_SOURCES = '{"method":"fixture","sources":["genesis"]}';

let db: Client;

/** Puts a row in a state, as the service role, without a transaction. */
async function resetEnosh(): Promise<void> {
  await db.query(
    `UPDATE people SET review_status = 'DRAFT', revision_notes = NULL, verification = NULL
      WHERE id = 'enosh'`,
  );
}

beforeAll(async () => {
  db = await connect();
  await seedFixtures(db);
  // Alice is an administrator for this file; Bob stays an ordinary reader.
  await db.query(`UPDATE profiles SET role = 'admin' WHERE id = $1`, [ALICE]);
  await db.query(`UPDATE profiles SET role = 'user' WHERE id = $1`, [BOB]);
  await resetEnosh();
});

afterAll(async () => {
  await db.query(`UPDATE profiles SET role = 'user' WHERE id = ANY($1::uuid[])`, [
    [ALICE, BOB],
  ]);
  await resetEnosh();
  await db.query(`DELETE FROM audit_logs WHERE entity_id IN ('enosh', 'mallory')`);
  await db.end();
});

describe('a canonical table refuses every client write', () => {
  for (const { table, insert } of CANONICAL) {
    for (const [label, role, uid] of [
      ['an anonymous visitor', 'anon', null],
      ['a signed-in reader', 'authenticated', BOB],
      ['an administrator', 'authenticated', ALICE],
    ] as const) {
      it(`${table}: refuses an insert from ${label}`, async () => {
        await expect(asUser(db, role, uid, async () => db.query(insert))).rejects.toThrow(
          /permission denied|violates row-level security/,
        );
      });

      it(`${table}: refuses an update from ${label}`, async () => {
        await expect(
          asUser(db, role, uid, async () =>
            db.query(`UPDATE ${table} SET review_status = 'VERIFIED'`),
          ),
        ).rejects.toThrow(/permission denied|violates row-level security|column/);
      });

      it(`${table}: refuses a delete from ${label}`, async () => {
        await expect(
          asUser(db, role, uid, async () => db.query(`DELETE FROM ${table}`)),
        ).rejects.toThrow(/permission denied|violates row-level security/);
      });
    }
  }
});

describe('marking a record VERIFIED', () => {
  it('refuses without a reason', async () => {
    await db.query('BEGIN');
    try {
      await expect(
        db.query(
          `UPDATE people SET review_status = 'VERIFIED', verification = $1::jsonb
            WHERE id = 'enosh'`,
          [VERIFIED_SOURCES],
        ),
      ).rejects.toThrow(/requires revision_notes/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('refuses a reason that is only whitespace', async () => {
    await db.query('BEGIN');
    try {
      await expect(
        db.query(
          `UPDATE people SET review_status = 'VERIFIED', revision_notes = '   ',
                             verification = $1::jsonb
            WHERE id = 'enosh'`,
          [VERIFIED_SOURCES],
        ),
      ).rejects.toThrow(/requires revision_notes/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('refuses without source information', async () => {
    await db.query('BEGIN');
    try {
      await expect(
        db.query(
          `UPDATE people SET review_status = 'VERIFIED', revision_notes = 'Checked'
            WHERE id = 'enosh'`,
        ),
      ).rejects.toThrow(/verification.sources/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('refuses a verification record that names no source', async () => {
    // One transaction each: a refused statement aborts the transaction it
    // is in, so a shared one would make every case after the first fail
    // for the wrong reason.
    for (const empty of ['{}', '{"sources":[]}', '{"sources":"genesis"}']) {
      await db.query('BEGIN');
      try {
        await expect(
          db.query(
            `UPDATE people SET review_status = 'VERIFIED', revision_notes = 'Checked',
                               verification = $1::jsonb
              WHERE id = 'enosh'`,
            [empty],
          ),
          empty,
        ).rejects.toThrow(/verification.sources/);
      } finally {
        await db.query('ROLLBACK');
      }
    }
  });

  it('refuses a signed-in reader who is not an administrator', async () => {
    // The write itself is refused at the privilege level, so the trigger
    // is exercised the way the CMS would reach it: as the service role
    // carrying a non-admin's identity, which is exactly the mistake the
    // trigger exists to catch.
    await expect(
      asUser(db, 'service_role', BOB, async () =>
        db.query(
          `UPDATE people SET review_status = 'VERIFIED', revision_notes = 'Checked',
                             verification = $1::jsonb
            WHERE id = 'enosh'`,
          [VERIFIED_SOURCES],
        ),
      ),
    ).rejects.toThrow(/Only an administrator/);
  });

  it('accepts a reason with sources, and writes an audit row saying so', async () => {
    await db.query(
      `UPDATE people SET review_status = 'VERIFIED',
                         revision_notes = 'Checked against Genesis 5:6',
                         verification = $1::jsonb
        WHERE id = 'enosh'`,
      [VERIFIED_SOURCES],
    );

    const audit = await db.query(
      `SELECT action, entity_type, entity_id, reason, before, after
         FROM audit_logs
        WHERE entity_type = 'people' AND entity_id = 'enosh'
        ORDER BY id DESC LIMIT 1`,
    );
    expect(audit.rowCount).toBe(1);
    const row = audit.rows[0];
    expect(row?.action).toBe('update');
    expect(row?.reason).toBe('Checked against Genesis 5:6');
    expect(row?.before?.review_status).toBe('DRAFT');
    expect(row?.after?.review_status).toBe('VERIFIED');

    await resetEnosh();
  });
});

describe('editing a record that is already VERIFIED', () => {
  it('refuses without a reason', async () => {
    await db.query('BEGIN');
    try {
      await expect(
        db.query(`UPDATE people SET canonical_name = 'Adam the first' WHERE id = 'adam'`),
      ).rejects.toThrow(/requires revision_notes/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('refuses without source information', async () => {
    await db.query('BEGIN');
    try {
      await expect(
        db.query(
          `UPDATE people SET canonical_name = 'Adam the first',
                             revision_notes = 'A better name',
                             verification = NULL
            WHERE id = 'adam'`,
        ),
      ).rejects.toThrow(/verification.sources/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('accepts a reason with sources', async () => {
    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE people SET canonical_name = 'Adam the first',
                           revision_notes = 'Genesis 5:1 spells it this way',
                           verification = $1::jsonb
          WHERE id = 'adam'`,
        [VERIFIED_SOURCES],
      );
      const row = await db.query(`SELECT canonical_name FROM people WHERE id = 'adam'`);
      expect(row.rows[0]?.canonical_name).toBe('Adam the first');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});

describe('the audit log', () => {
  it('records a change nothing in the application asked it to record', async () => {
    // Written straight to the table, the way a script or a migration
    // would. The trail has to exist anyway, which is why it is a trigger
    // and not a line in a server action.
    await db.query(
      `UPDATE people SET description = 'A description with no CMS involved',
                         revision_notes = 'Direct write'
        WHERE id = 'enosh'`,
    );
    const audit = await db.query(
      `SELECT reason FROM audit_logs
        WHERE entity_type = 'people' AND entity_id = 'enosh'
        ORDER BY id DESC LIMIT 1`,
    );
    expect(audit.rows[0]?.reason).toBe('Direct write');
    await db.query(`UPDATE people SET description = NULL WHERE id = 'enosh'`);
    await resetEnosh();
  });

  it('records nothing for a write that changed nothing', async () => {
    const before = await db.query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_id = 'enosh'`,
    );
    await db.query(
      `UPDATE people SET canonical_name = canonical_name WHERE id = 'enosh'`,
    );
    const after = await db.query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_id = 'enosh'`,
    );
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });

  it('is readable by an administrator and by nobody else', async () => {
    const asAdmin = await asUser(
      db,
      'authenticated',
      ALICE,
      async () => (await db.query('SELECT id FROM audit_logs LIMIT 1')).rowCount,
    );
    expect(asAdmin).not.toBeNull();

    const asReader = await asUser(
      db,
      'authenticated',
      BOB,
      async () => (await db.query('SELECT id FROM audit_logs')).rows,
    );
    expect(asReader).toEqual([]);

    const asVisitor = await asUser(
      db,
      'anon',
      null,
      async () => (await db.query('SELECT id FROM audit_logs')).rows,
    );
    expect(asVisitor).toEqual([]);
  });

  it('cannot be rewritten, even by an administrator', async () => {
    for (const statement of [
      `UPDATE audit_logs SET reason = 'something else'`,
      `DELETE FROM audit_logs`,
      `INSERT INTO audit_logs (action, entity_type, entity_id) VALUES ('forged', 'people', 'adam')`,
    ]) {
      await expect(
        asUser(db, 'authenticated', ALICE, async () => db.query(statement)),
        statement,
      ).rejects.toThrow(/permission denied/);
    }
  });
});

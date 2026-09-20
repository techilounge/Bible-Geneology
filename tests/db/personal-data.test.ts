import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, connect, seedFixtures } from './helpers';

/**
 * The Phase 13 exit gate: one user cannot read or write another's rows.
 *
 * Every personal table, every verb, asserted against the real policies in a
 * real Postgres. The Phase 1 suite proved the pattern on `favorites`; this
 * proves it on each table that now holds something, because a policy set
 * applied by a function is still applied one table at a time.
 *
 * The tables are covered by a table-driven pass so that adding a personal
 * table without isolating it fails here rather than in production.
 */
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

interface PersonalTable {
  name: string;
  /** A row for the given owner, as columns and values. */
  row: (owner: string) => { columns: string[]; values: unknown[] };
  /** Something that identifies the row in a SELECT. */
  marker: string;
}

const TABLES: PersonalTable[] = [
  {
    name: 'favorites',
    marker: 'entity_id',
    row: (owner) => ({
      columns: ['user_id', 'entity_type', 'entity_id'],
      values: [owner, 'person', `person-${owner.slice(0, 4)}`],
    }),
  },
  {
    name: 'saved_comparisons',
    marker: 'person_a_id',
    row: (owner) => ({
      columns: ['user_id', 'person_a_id', 'person_b_id', 'chronology_id'],
      values: [owner, 'adam', 'seth', 'masoretic'],
    }),
  },
  {
    name: 'quiz_attempts',
    marker: 'question_id',
    row: (owner) => ({
      columns: ['user_id', 'question_id', 'mode', 'correct'],
      values: [owner, `q-${owner.slice(0, 4)}`, 'who-lived-longer', true],
    }),
  },
  {
    name: 'user_achievements',
    marker: 'achievement_id',
    row: (owner) => ({
      columns: ['user_id', 'achievement_id'],
      values: [owner, `badge-${owner.slice(0, 4)}`],
    }),
  },
  {
    name: 'learning_progress',
    marker: 'step_id',
    row: (owner) => ({
      columns: ['user_id', 'journey_slug', 'step_id'],
      values: [owner, 'adam-to-noah', `step-${owner.slice(0, 4)}`],
    }),
  },
];

let db: Client;

function insert(table: PersonalTable, owner: string): [string, unknown[]] {
  const { columns, values } = table.row(owner);
  const placeholders = columns.map((_column, index) => `$${index + 1}`).join(', ');
  return [
    `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  ];
}

beforeAll(async () => {
  db = await connect();
  await seedFixtures(db);
  // Seeded as the service role, which is how the application's own writes
  // would never happen: these rows exist so the policies have something to
  // refuse access to.
  // user_achievements references the achievements table, which is
  // reference data rather than anything a user owns.
  await db.query(`
    INSERT INTO achievements (id, name, description) VALUES
      ('badge-1111', 'Alice badge', 'Seeded for the isolation suite'),
      ('badge-2222', 'Bob badge', 'Seeded for the isolation suite')
    ON CONFLICT (id) DO NOTHING
  `);

  for (const table of TABLES) {
    for (const owner of [ALICE, BOB]) {
      const [sql, values] = insert(table, owner);
      await db.query(`${sql} ON CONFLICT DO NOTHING`, values);
    }
  }
});

afterAll(async () => {
  // The seeds above are the only writes in this file that are not rolled
  // back, and the suite shares one database, so they are cleared here.
  // Leaving them behind would make another file's assertions depend on
  // whether this one ran first.
  for (const table of TABLES) {
    await db.query(`DELETE FROM ${table.name} WHERE user_id = ANY($1::uuid[])`, [
      [ALICE, BOB],
    ]);
  }
  await db.query(`DELETE FROM achievements WHERE id IN ('badge-1111','badge-2222')`);
  await db.end();
});

describe.each(TABLES.map((table) => [table.name, table] as const))(
  '%s',
  (_name, table) => {
    it('shows a user their own rows and nobody else’s', async () => {
      const rows = await asUser(
        db,
        'authenticated',
        ALICE,
        async () =>
          (await db.query(`SELECT user_id, ${table.marker} FROM ${table.name}`)).rows,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.user_id === ALICE)).toBe(true);
    });

    it('shows an anonymous visitor nothing at all', async () => {
      const rows = await asUser(
        db,
        'anon',
        null,
        async () => (await db.query(`SELECT * FROM ${table.name}`)).rows,
      );
      expect(rows).toHaveLength(0);
    });

    it('refuses an insert owned by somebody else', async () => {
      const [sql, values] = insert(table, BOB);
      await expect(
        asUser(db, 'authenticated', ALICE, async () =>
          db.query(sql.replace('INSERT INTO', 'INSERT INTO'), values),
        ),
      ).rejects.toThrow();
    });

    it("refuses to delete another user's row", async () => {
      const deleted = await asUser(
        db,
        'authenticated',
        ALICE,
        async () =>
          (await db.query(`DELETE FROM ${table.name} WHERE user_id = $1`, [BOB]))
            .rowCount,
      );
      expect(deleted).toBe(0);
    });

    it("refuses to reassign another user's row to itself", async () => {
      const updated = await asUser(
        db,
        'authenticated',
        ALICE,
        async () =>
          (
            await db.query(`UPDATE ${table.name} SET user_id = $1 WHERE user_id = $2`, [
              ALICE,
              BOB,
            ])
          ).rowCount,
      );
      expect(updated).toBe(0);
    });

    it('refuses to hand its own row to somebody else', async () => {
      // The WITH CHECK half of the policy: a user may update their own row,
      // but not into one they would no longer own.
      await expect(
        asUser(db, 'authenticated', ALICE, async () =>
          db.query(`UPDATE ${table.name} SET user_id = $1 WHERE user_id = $2`, [
            BOB,
            ALICE,
          ]),
        ),
      ).rejects.toThrow();
    });

    it('lets a user delete their own row', async () => {
      const deleted = await asUser(
        db,
        'authenticated',
        ALICE,
        async () =>
          (await db.query(`DELETE FROM ${table.name} WHERE user_id = $1`, [ALICE]))
            .rowCount,
      );
      expect(deleted).toBeGreaterThan(0);
    });
  },
);

describe('an account brings a profile with it', () => {
  it('creates one when the account is created, and only one', async () => {
    const id = '33333333-3333-3333-3333-333333333333';
    await db.query('BEGIN');
    try {
      await db.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, 'carol@example.test', '{"full_name":"Carol"}'::jsonb)`,
        [id],
      );
      const profile = await db.query(
        'SELECT display_name, role FROM profiles WHERE id = $1',
        [id],
      );
      expect(profile.rowCount).toBe(1);
      expect(profile.rows[0]?.display_name).toBe('Carol');
      // Never anything but a plain user, whatever the provider said.
      expect(profile.rows[0]?.role).toBe('user');
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('creates one even when the provider gives no name', async () => {
    const id = '44444444-4444-4444-4444-444444444444';
    await db.query('BEGIN');
    try {
      await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'd@example.test')`, [
        id,
      ]);
      const profile = await db.query('SELECT display_name FROM profiles WHERE id = $1', [
        id,
      ]);
      expect(profile.rowCount).toBe(1);
      expect(profile.rows[0]?.display_name).toBeNull();
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('still refuses a client that tries to insert a profile itself', async () => {
    await expect(
      asUser(db, 'authenticated', ALICE, async () =>
        db.query(`INSERT INTO profiles (id, display_name) VALUES ($1, 'Mallory')`, [
          '55555555-5555-5555-5555-555555555555',
        ]),
      ),
    ).rejects.toThrow();
  });
});

describe('a verification that was not performed by a person', () => {
  it('accepts a label in place of a reviewer', async () => {
    await db.query('BEGIN');
    try {
      await db.query(`
        INSERT INTO person_chronology (
          person_id, chronology_id, birth_year, death_year, lifespan,
          birth_confidence, death_confidence, lifespan_confidence,
          birth_source_type, death_source_type, lifespan_source_type,
          review_status, verified_by_label, verified_at, supplied_by, supplied_at,
          verification, revision_notes
        ) VALUES (
          'adam', 'masoretic', 0, 930, 930,
          'DERIVED', 'DERIVED', 'EXPLICIT',
          'SCRIPTURE_DERIVED', 'SCRIPTURE_DERIVED', 'SCRIPTURE_EXPLICIT',
          'VERIFIED', 'source-check:web-bible+kjv-1769', now(), 'Kelv', current_date,
          '{"method":"automated-source-check","sources":["web-bible","kjv-1769"]}'::jsonb,
          'Checked against two public-domain translations'
        )
      `);
      const row = await db.query(
        `SELECT verified_by, verified_by_label, supplied_by FROM person_chronology
         WHERE person_id = 'adam' AND chronology_id = 'masoretic'`,
      );
      expect(row.rows[0]?.verified_by).toBeNull();
      expect(row.rows[0]?.verified_by_label).toBe('source-check:web-bible+kjv-1769');
      expect(row.rows[0]?.supplied_by).toBe('Kelv');
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('still refuses a VERIFIED record with no verifier at all', async () => {
    await db.query('BEGIN');
    try {
      await expect(
        db.query(`
          INSERT INTO person_chronology (
            person_id, chronology_id, birth_year, death_year, lifespan,
            birth_confidence, death_confidence, lifespan_confidence,
            birth_source_type, death_source_type, lifespan_source_type,
            review_status, revision_notes, verification
          ) VALUES (
            'seth', 'masoretic', 130, 1042, 912,
            'DERIVED', 'DERIVED', 'EXPLICIT',
            'SCRIPTURE_DERIVED', 'SCRIPTURE_DERIVED', 'SCRIPTURE_EXPLICIT',
            'VERIFIED', 'A reason, so the rule under test is the reviewer one',
            '{"method":"fixture","sources":["genesis"]}'::jsonb
          )
        `),
      ).rejects.toThrow(/verified_requires_reviewer/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('refuses a blank label, which says nothing about what checked it', async () => {
    await db.query('BEGIN');
    try {
      // The row has to exist first. An UPDATE that matches nothing never
      // reaches the constraint, so without this the assertion would pass
      // while proving nothing. It is left at DRAFT because editing a
      // VERIFIED record trips the revision-notes trigger first, and this
      // test is about the label, not about that rule.
      const inserted = await db.query(`
        INSERT INTO person_chronology (
          person_id, chronology_id, birth_year, death_year, lifespan,
          birth_confidence, death_confidence, lifespan_confidence,
          birth_source_type, death_source_type, lifespan_source_type,
          review_status
        ) VALUES (
          'adam', 'masoretic', 0, 930, 930,
          'DERIVED', 'DERIVED', 'EXPLICIT',
          'SCRIPTURE_DERIVED', 'SCRIPTURE_DERIVED', 'SCRIPTURE_EXPLICIT',
          'DRAFT'
        )
      `);
      expect(inserted.rowCount).toBe(1);

      await expect(
        db.query(
          `UPDATE person_chronology SET verified_by_label = '   ' WHERE person_id = 'adam'`,
        ),
      ).rejects.toThrow(/verified_by_label_is_not_blank/);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});

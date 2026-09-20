import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, connect, seedFixtures } from './helpers';

/**
 * RLS isolation, tested against the real policies rather than asserted in a
 * document. Phase 13's gate repeats this with real Supabase sessions; doing it
 * now means the policies are known good before any user data exists.
 */
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

let db: Client;

beforeAll(async () => {
  db = await connect();
  await seedFixtures(db);
  await db.query(
    `
    INSERT INTO favorites (user_id, entity_type, entity_id)
    VALUES ($1, 'person', 'adam'), ($2, 'person', 'seth')
    ON CONFLICT DO NOTHING
  `,
    [ALICE, BOB],
  );
});

afterAll(async () => {
  await db.end();
});

describe('canonical tables', () => {
  it('let an anonymous visitor read VERIFIED people', async () => {
    const rows = await asUser(
      db,
      'anon',
      null,
      async () => (await db.query('SELECT id FROM people ORDER BY id')).rows,
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('adam');
  });

  it('hide DRAFT records from an anonymous visitor', async () => {
    // Requirement section 8: only VERIFIED records are visible by default.
    const rows = await asUser(
      db,
      'anon',
      null,
      async () => (await db.query(`SELECT id FROM people WHERE id = 'enosh'`)).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('refuse a write from an authenticated non-staff user', async () => {
    await expect(
      asUser(db, 'authenticated', ALICE, async () =>
        db.query(
          `INSERT INTO people (id, canonical_name, slug) VALUES ('noah','Noah','noah')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('refuse a write even from a staff user, because no write policy exists', async () => {
    await db.query(`UPDATE profiles SET role = 'editor' WHERE id = $1`, [ALICE]);
    try {
      await expect(
        asUser(db, 'authenticated', ALICE, async () =>
          db.query(`UPDATE people SET canonical_name = 'Changed' WHERE id = 'adam'`),
        ),
      ).rejects.toThrow();
    } finally {
      await db.query(`UPDATE profiles SET role = 'user' WHERE id = $1`, [ALICE]);
    }
  });

  it('let a staff user read DRAFT records', async () => {
    await db.query(`UPDATE profiles SET role = 'editor' WHERE id = $1`, [ALICE]);
    try {
      const rows = await asUser(
        db,
        'authenticated',
        ALICE,
        async () => (await db.query(`SELECT id FROM people WHERE id = 'enosh'`)).rows,
      );
      expect(rows).toHaveLength(1);
    } finally {
      await db.query(`UPDATE profiles SET role = 'user' WHERE id = $1`, [ALICE]);
    }
  });
});

describe('user data isolation', () => {
  it('shows a user only their own favorites', async () => {
    const rows = await asUser(
      db,
      'authenticated',
      ALICE,
      async () => (await db.query('SELECT entity_id FROM favorites')).rows,
    );
    expect(rows.map((r) => r.entity_id)).toEqual(['adam']);
  });

  it("does not let a user delete another user's favorites", async () => {
    const deleted = await asUser(
      db,
      'authenticated',
      ALICE,
      async () =>
        (await db.query(`DELETE FROM favorites WHERE user_id = $1 RETURNING id`, [BOB]))
          .rowCount,
    );
    expect(deleted).toBe(0);
  });

  it('does not let a user insert a row owned by someone else', async () => {
    await expect(
      asUser(db, 'authenticated', ALICE, async () =>
        db.query(
          `INSERT INTO favorites (user_id, entity_type, entity_id) VALUES ($1,'person','enosh')`,
          [BOB],
        ),
      ),
    ).rejects.toThrow();
  });

  it('shows an anonymous visitor no favorites at all', async () => {
    const rows = await asUser(
      db,
      'anon',
      null,
      async () => (await db.query('SELECT entity_id FROM favorites')).rows,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('role escalation', () => {
  it('does not let a user promote themselves', async () => {
    await expect(
      asUser(db, 'authenticated', ALICE, async () =>
        db.query(`UPDATE profiles SET role = 'admin' WHERE id = $1`, [ALICE]),
      ),
    ).rejects.toThrow(/administrator/i);
  });

  it('lets a user change their own display name', async () => {
    const rows = await asUser(
      db,
      'authenticated',
      ALICE,
      async () =>
        (
          await db.query(
            `UPDATE profiles SET display_name = 'Alice A' WHERE id = $1 RETURNING display_name`,
            [ALICE],
          )
        ).rows,
    );
    expect(rows[0]?.display_name).toBe('Alice A');
  });
});

describe('audit log', () => {
  it('is unreadable by a non-admin', async () => {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
       VALUES ($1, 'test', 'person', 'adam')`,
      [ALICE],
    );
    const rows = await asUser(
      db,
      'authenticated',
      ALICE,
      async () => (await db.query('SELECT id FROM audit_logs')).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('is readable by an admin', async () => {
    // A policy without a matching GRANT is dead code: the verb is refused
    // before the policy is ever consulted. Asserting the positive case is what
    // catches that.
    await db.query(`UPDATE profiles SET role = 'admin' WHERE id = $1`, [ALICE]);
    try {
      const rows = await asUser(
        db,
        'authenticated',
        ALICE,
        async () => (await db.query('SELECT id FROM audit_logs')).rows,
      );
      expect(rows.length).toBeGreaterThan(0);
    } finally {
      await db.query(`UPDATE profiles SET role = 'user' WHERE id = $1`, [ALICE]);
    }
  });

  it('cannot be updated or deleted by anyone, admin included', async () => {
    // Refused at the privilege level: no write grant is issued to any client
    // role, and no write policy exists either.
    await db.query(`UPDATE profiles SET role = 'admin' WHERE id = $1`, [ALICE]);
    try {
      await expect(
        asUser(db, 'authenticated', ALICE, async () =>
          db.query(`UPDATE audit_logs SET action = 'tampered'`),
        ),
      ).rejects.toThrow(/permission denied/i);

      await expect(
        asUser(db, 'authenticated', ALICE, async () =>
          db.query('DELETE FROM audit_logs'),
        ),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await db.query(`UPDATE profiles SET role = 'user' WHERE id = $1`, [ALICE]);
    }
  });
});

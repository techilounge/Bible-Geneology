import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, seedFixtures } from './helpers';

/**
 * The constraints in docs/DATA_MODEL.md are load-bearing claims about what the
 * database will refuse. Asserting them here means they are verified before any
 * data exists, which is the point of doing Phase 1 before Phase 2.
 */
let db: Client;

beforeAll(async () => {
  db = await connect();
  await seedFixtures(db);
});

afterAll(async () => {
  await db.end();
});

async function expectRejected(sql: string, params: unknown[] = []) {
  await db.query('BEGIN');
  try {
    await expect(db.query(sql, params)).rejects.toThrow();
  } finally {
    await db.query('ROLLBACK');
  }
}

async function expectAccepted(sql: string, params: unknown[] = []) {
  await db.query('BEGIN');
  try {
    await expect(db.query(sql, params)).resolves.toBeDefined();
  } finally {
    await db.query('ROLLBACK');
  }
}

const chronologyColumns = `
  person_id, chronology_id, birth_year, death_year, lifespan,
  birth_confidence, death_confidence, lifespan_confidence,
  birth_source_type, death_source_type, lifespan_source_type
`;

describe('person_chronology constraints', () => {
  it('rejects a death year before a birth year', async () => {
    await expectRejected(`
      INSERT INTO person_chronology (${chronologyColumns}) VALUES
        ('adam','masoretic', 100, 50, 0,
         'DERIVED','DERIVED','EXPLICIT',
         'SCRIPTURE_DERIVED','SCRIPTURE_DERIVED','SCRIPTURE_EXPLICIT')
    `);
  });

  it('rejects a real year stored under UNKNOWN confidence', async () => {
    await expectRejected(`
      INSERT INTO person_chronology (${chronologyColumns}) VALUES
        ('adam','masoretic', 0, 930, 930,
         'UNKNOWN','DERIVED','EXPLICIT',
         'UNKNOWN','SCRIPTURE_DERIVED','SCRIPTURE_EXPLICIT')
    `);
  });

  it('rejects a null year that claims to be known', async () => {
    await expectRejected(`
      INSERT INTO person_chronology (${chronologyColumns}) VALUES
        ('adam','masoretic', NULL, 930, 930,
         'DERIVED','DERIVED','EXPLICIT',
         'SCRIPTURE_DERIVED','SCRIPTURE_DERIVED','SCRIPTURE_EXPLICIT')
    `);
  });

  it('accepts a wholly unknown record', async () => {
    await expectAccepted(`
      INSERT INTO person_chronology (${chronologyColumns}) VALUES
        ('seth','masoretic', NULL, NULL, NULL,
         'UNKNOWN','UNKNOWN','UNKNOWN',
         'UNKNOWN','UNKNOWN','UNKNOWN')
    `);
  });

  it('rejects VERIFIED without a reviewer', async () => {
    await expectRejected(`
      INSERT INTO person_chronology (${chronologyColumns}, review_status) VALUES
        ('adam','masoretic', 0, 930, 930,
         'DERIVED','DERIVED','EXPLICIT',
         'SCRIPTURE_DERIVED','SCRIPTURE_DERIVED','SCRIPTURE_EXPLICIT',
         'VERIFIED')
    `);
  });
});

describe('relationship constraints', () => {
  it('rejects a person related to themselves', async () => {
    await expectRejected(`
      INSERT INTO relationships
        (source_person_id, target_person_id, relationship_type, confidence, source_type)
      VALUES ('adam','adam','parent','EXPLICIT','SCRIPTURE_EXPLICIT')
    `);
  });

  it('rejects a parent edge that would create an ancestry cycle', async () => {
    await db.query('BEGIN');
    try {
      await db.query(`
        INSERT INTO relationships
          (source_person_id, target_person_id, relationship_type, confidence, source_type)
        VALUES ('adam','seth','parent','EXPLICIT','SCRIPTURE_EXPLICIT')
      `);
      await expect(
        db.query(`
          INSERT INTO relationships
            (source_person_id, target_person_id, relationship_type, confidence, source_type)
          VALUES ('seth','adam','parent','EXPLICIT','SCRIPTURE_EXPLICIT')
        `),
      ).rejects.toThrow(/cycle/i);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('rejects a child edge that merely inverts an existing parent edge', async () => {
    await db.query('BEGIN');
    try {
      await db.query(`
        INSERT INTO relationships
          (source_person_id, target_person_id, relationship_type, confidence, source_type)
        VALUES ('adam','seth','parent','EXPLICIT','SCRIPTURE_EXPLICIT')
      `);
      await expect(
        db.query(`
          INSERT INTO relationships
            (source_person_id, target_person_id, relationship_type, confidence, source_type)
          VALUES ('seth','adam','child','EXPLICIT','SCRIPTURE_EXPLICIT')
        `),
      ).rejects.toThrow(/parent edge/i);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});

describe('structural constraints', () => {
  it('allows only one default chronology', async () => {
    await expectRejected(`
      INSERT INTO chronologies (id, name, description, is_default)
      VALUES ('septuagint','Septuagint','LXX chronology', true)
    `);
  });

  it('rejects an identifier that is not slug-safe', async () => {
    await expectRejected(`
      INSERT INTO people (id, canonical_name, slug) VALUES ('Methuselah','M','methuselah-x')
    `);
  });

  it('rejects an out-of-order verse range', async () => {
    await expectRejected(`
      INSERT INTO scripture_references
        (id, book, chapter, verse_start, verse_end, canonical_key, display_label)
      VALUES ('GEN.5.27-21','GEN',5,27,21,'GEN.5.27-21','Genesis 5:27-21')
    `);
  });
});

-- 0008 — Provenance: what backs each value.

-- Polymorphic attachment rather than an array column on each table, so a
-- reference can hang off a person, a chronology value, a relationship or an
-- event through one mechanism, and can be indexed.
CREATE TABLE IF NOT EXISTS scripture_attachments (
  id           bigserial PRIMARY KEY,
  reference_id text NOT NULL REFERENCES scripture_references(id) ON DELETE CASCADE,
  entity_type  text NOT NULL
    CHECK (entity_type IN ('person','person_chronology','relationship','event','event_chronology','source_claim')),
  entity_id    text NOT NULL,
  role         text,
  UNIQUE (reference_id, entity_type, entity_id, role)
);

CREATE INDEX IF NOT EXISTS scripture_attachments_entity
  ON scripture_attachments (entity_type, entity_id);

-- Disagreement is representable rather than resolved at seed time. The
-- Masoretic text and the Septuagint giving different ages for the same person
-- is two rows here, not a conflict someone has to settle before seeding.
CREATE TABLE IF NOT EXISTS source_claims (
  id            bigserial PRIMARY KEY,
  source_id     text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  field         text NOT NULL,
  claimed_value text,
  confidence    confidence_level NOT NULL,
  notes         text
);

CREATE INDEX IF NOT EXISTS source_claims_entity
  ON source_claims (entity_type, entity_id, field);

SELECT public.apply_canonical_rls('scripture_attachments', false);
SELECT public.apply_canonical_rls('source_claims', false);

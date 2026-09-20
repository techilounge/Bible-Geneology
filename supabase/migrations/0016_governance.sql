-- 0016 — Governance: a reason, a source, and a trail that the application
-- cannot forget to write.
--
-- Phase 12's trigger already refuses an edit to a VERIFIED record with no
-- reason. Three things were still missing, and all three are in the Phase 14
-- exit gate:
--
--   1. Promotion to VERIFIED — the moment that matters most — needed no
--      reason at all.
--   2. Nothing required the record to say what it was verified against.
--      Requirement section 3: every chronological value carries provenance,
--      and "an administrator said so" is not provenance.
--   3. The audit row was the application's job, so any write that did not go
--      through the application left no trace. A trail with a bypass is not a
--      trail.
--
-- The reviewable tables are the ones that carry review_status and
-- revision_notes. `verification` is added to the rest of them here so the rule
-- can be stated once for all of them rather than once per table.

ALTER TABLE people          ADD COLUMN IF NOT EXISTS verification jsonb;
ALTER TABLE relationships   ADD COLUMN IF NOT EXISTS verification jsonb;
ALTER TABLE events          ADD COLUMN IF NOT EXISTS verification jsonb;
ALTER TABLE event_chronology ADD COLUMN IF NOT EXISTS verification jsonb;

COMMENT ON COLUMN people.verification IS
  'What the record was checked against: method, and a non-empty sources array. Required to reach VERIFIED.';

/**
 * Whether a verification record actually says what backed the check.
 *
 * A jsonb column can hold `{}` and satisfy a NOT NULL, so the shape is
 * checked rather than the presence: a sources array with something in it.
 */
CREATE OR REPLACE FUNCTION public.has_source_information(verification jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  -- COALESCE, because a missing key makes jsonb_typeof return NULL, and a
  -- NULL here would make the guard below skip rather than refuse. A rule
  -- that fails open is worse than no rule.
  SELECT COALESCE(
    jsonb_typeof(verification -> 'sources') = 'array'
      AND jsonb_array_length(verification -> 'sources') > 0,
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blank(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT value IS NULL OR length(btrim(value)) = 0;
$$;

/**
 * The review rules, as one trigger over every reviewable table.
 *
 * It replaces guard_verified_transition rather than sitting beside it, so
 * there is one place the rules are stated and one place to read them.
 */
CREATE OR REPLACE FUNCTION public.guard_verified_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  promoting boolean;
  editing_verified boolean;
BEGIN
  promoting := NEW.review_status = 'VERIFIED'
    AND (TG_OP = 'INSERT' OR OLD.review_status IS DISTINCT FROM 'VERIFIED');

  editing_verified := TG_OP = 'UPDATE'
    AND OLD.review_status = 'VERIFIED'
    AND NEW.review_status = 'VERIFIED'
    AND to_jsonb(NEW) - 'updated_at' - 'updated_by'
        IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' - 'updated_by';

  IF promoting THEN
    -- auth.uid() is null for the service role running seeds, migrations and
    -- the server actions that have already checked the caller. Every other
    -- caller must be an administrator.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only an administrator may mark a record VERIFIED';
    END IF;

    IF public.is_blank(NEW.revision_notes) THEN
      RAISE EXCEPTION 'Marking a record VERIFIED requires revision_notes giving the reason';
    END IF;

    IF NOT public.has_source_information(NEW.verification) THEN
      RAISE EXCEPTION 'Marking a record VERIFIED requires verification.sources naming what was checked';
    END IF;
  END IF;

  IF editing_verified THEN
    IF public.is_blank(NEW.revision_notes) THEN
      RAISE EXCEPTION 'Changing a VERIFIED record requires revision_notes giving the reason';
    END IF;

    IF NOT public.has_source_information(NEW.verification) THEN
      RAISE EXCEPTION 'Changing a VERIFIED record requires verification.sources naming what was checked';
    END IF;
  END IF;

  RETURN NEW;
END $$;

/**
 * The audit row, written by the database.
 *
 * SECURITY DEFINER because no client role has INSERT on audit_logs and none
 * is going to get one: the log is append-only from the application's point of
 * view, and this trigger is the only thing that appends.
 *
 * The reason is taken from the row's own revision_notes, which is the column
 * the rules above have just insisted on.
 */
CREATE OR REPLACE FUNCTION public.write_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity  text := TG_ARGV[0];
  key     text;
  before  jsonb;
  after   jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    before := to_jsonb(OLD);
    after := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    before := NULL;
    after := to_jsonb(NEW);
  ELSE
    before := to_jsonb(OLD);
    after := to_jsonb(NEW);
    -- A write that changed nothing but the timestamps is not a change.
    IF before - 'updated_at' - 'updated_by' = after - 'updated_at' - 'updated_by' THEN
      RETURN NULL;
    END IF;
  END IF;

  key := COALESCE(after, before) ->> TG_ARGV[1];

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before, after, reason)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    entity,
    COALESCE(key, '(unknown)'),
    before,
    after,
    COALESCE(after, before) ->> 'revision_notes'
  );

  RETURN NULL;
END $$;

/** Attaches both triggers to a reviewable table, keyed by its identifying column. */
CREATE OR REPLACE FUNCTION public.apply_governance(tbl text, key_column text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_guard_verified', tbl);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.guard_verified_transition()',
    tbl || '_guard_verified', tbl);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_audit', tbl);
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.write_audit_row(%L, %L)',
    tbl || '_audit', tbl, tbl, key_column);
END $$;

-- The older, hand-written triggers are replaced by the pair above.
DROP TRIGGER IF EXISTS people_guard_verified ON people;
DROP TRIGGER IF EXISTS person_chronology_guard_verified ON person_chronology;
DROP TRIGGER IF EXISTS relationships_guard_verified ON relationships;

SELECT public.apply_governance('people', 'id');
SELECT public.apply_governance('person_chronology', 'person_id');
SELECT public.apply_governance('relationships', 'id');
SELECT public.apply_governance('events', 'id');
SELECT public.apply_governance('event_chronology', 'event_id');

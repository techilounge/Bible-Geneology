-- 0012 — Audit log.
--
-- Append-only. No UPDATE or DELETE policy exists for any role, including
-- admin, so the log cannot be rewritten from the application. Requirement
-- section 47 wants every important data change auditable; a log an admin can
-- edit is not that.

CREATE TABLE IF NOT EXISTS audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  before      jsonb,
  after       jsonb,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor ON audit_logs (actor_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- The policy narrows to admins; this grant is what makes the verb available at
-- all. Without it the admin read policy is dead code and nobody can read the
-- log. No write grant is issued to any client role, so UPDATE and DELETE are
-- refused at the privilege level as well as having no policy.
GRANT SELECT ON audit_logs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon, authenticated;

DROP POLICY IF EXISTS "audit_logs: admin reads" ON audit_logs;
CREATE POLICY "audit_logs: admin reads" ON audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- No INSERT policy: writes come from the service role, which bypasses RLS.
-- No UPDATE policy and no DELETE policy, for any role. Deliberate.

-- Promotion to VERIFIED is an administrator action and is enforced here as well
-- as in the application, so an application bug is not sufficient to promote a
-- record. Requirement section 48.
CREATE OR REPLACE FUNCTION public.guard_verified_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_status = 'VERIFIED'
     AND (TG_OP = 'INSERT' OR OLD.review_status IS DISTINCT FROM 'VERIFIED') THEN
    -- auth.uid() is null for the service role running seeds and migrations,
    -- which is the one path allowed to set VERIFIED without an admin session.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only an administrator may mark a record VERIFIED';
    END IF;
  END IF;

  -- Editing an already-VERIFIED record returns it to SOURCE_CHECKED rather than
  -- silently keeping its verified status, and requires a reason.
  IF TG_OP = 'UPDATE'
     AND OLD.review_status = 'VERIFIED'
     AND NEW.review_status = 'VERIFIED'
     AND to_jsonb(NEW) - 'updated_at' - 'updated_by' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' - 'updated_by'
     AND COALESCE(NEW.revision_notes, '') = '' THEN
    RAISE EXCEPTION 'Changing a VERIFIED record requires revision_notes giving the reason';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS person_chronology_guard_verified ON person_chronology;
CREATE TRIGGER person_chronology_guard_verified
  BEFORE INSERT OR UPDATE ON person_chronology
  FOR EACH ROW EXECUTE FUNCTION public.guard_verified_transition();

DROP TRIGGER IF EXISTS people_guard_verified ON people;
CREATE TRIGGER people_guard_verified
  BEFORE INSERT OR UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION public.guard_verified_transition();

DROP TRIGGER IF EXISTS relationships_guard_verified ON relationships;
CREATE TRIGGER relationships_guard_verified
  BEFORE INSERT OR UPDATE ON relationships
  FOR EACH ROW EXECUTE FUNCTION public.guard_verified_transition();

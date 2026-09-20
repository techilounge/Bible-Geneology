-- 0003 — The canonical-table RLS pattern, applied by one function.
--
-- Every canonical table gets the same shape: the public reads it, staff read
-- drafts too, and NOBODY writes through a client. Canonical writes happen only
-- through the service role, in seed scripts and in Phase 14 server actions that
-- check the caller's role first. There is no write policy to exploit because
-- there is no client write path at all. See docs/SECURITY.md section 4.
--
-- Expressing it once as a function rather than twelve times by hand means a
-- table cannot be given a subtly different policy set by accident.

CREATE OR REPLACE FUNCTION public.apply_canonical_rls(tbl text, review_gated boolean)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

  -- A policy permits a row; a GRANT permits the verb. Both are needed, and the
  -- hosted platform's default grants are not something to depend on: granting
  -- explicitly here is what makes these migrations behave the same locally and
  -- on Supabase. Read only, and no write grant at all, which is the belt to the
  -- "no write policy" braces below.
  EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', tbl);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', tbl);

  -- Force RLS for the table owner too, so a mistakenly-owner-authenticated
  -- connection does not bypass the policies.
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ': public read', tbl);
  IF review_gated THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (review_status = ''VERIFIED'')',
      tbl || ': public read', tbl);
  ELSE
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      tbl || ': public read', tbl);
  END IF;

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ': staff read all', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_staff())',
    tbl || ': staff read all', tbl);

  -- No INSERT, UPDATE or DELETE policy is created. This is deliberate.
END $$;

-- Standard audit columns, so no canonical table can be created without them.
CREATE OR REPLACE FUNCTION public.add_audit_columns(tbl text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I
    ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS created_by     uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by     uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS revision_notes text', tbl);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_touch_updated_at', tbl);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
    tbl || '_touch_updated_at', tbl);
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

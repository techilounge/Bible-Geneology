-- 0002 — User profiles.
--
-- Comes first among the tables because canonical-table policies check the
-- caller's role against this table. Authorization reads the database, never a
-- claim supplied by a client. See docs/SECURITY.md section 4.

CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role         app_role NOT NULL DEFAULT 'user',
  preferences  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON profiles TO authenticated;
REVOKE INSERT, DELETE ON profiles FROM anon, authenticated;

-- Helper used by every canonical-table policy. SECURITY DEFINER so that reading
-- the caller's own role does not itself require a policy, which would recurse.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.role FROM profiles p WHERE p.id = auth.uid()), 'user'::app_role);
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.current_app_role() IN ('editor', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.current_app_role() = 'admin';
$$;

DROP POLICY IF EXISTS "profiles: owner reads own" ON profiles;
CREATE POLICY "profiles: owner reads own" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: staff read all" ON profiles;
CREATE POLICY "profiles: staff read all" ON profiles
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "profiles: owner updates own" ON profiles;
CREATE POLICY "profiles: owner updates own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- A user may change their display name and preferences but never their own role.
-- The application not sending the column is not sufficient protection.
CREATE OR REPLACE FUNCTION public.forbid_self_role_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- auth.uid() is null for the service role, which runs seeds and the
  -- Phase 14 server actions that have already checked the caller. Every other
  -- caller must be an administrator. Same carve-out as guard_verified_transition.
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change a profile role';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_forbid_self_role_change ON profiles;
CREATE TRIGGER profiles_forbid_self_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.forbid_self_role_change();

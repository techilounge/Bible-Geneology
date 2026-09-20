-- 0014 — What an account adds.
--
-- Requirement section 46: core exploration needs no account. Nothing here is
-- required to read the site; these tables hold only what a person chooses to
-- keep. Each one is owner-scoped by the same apply_owner_rls the Phase 1
-- tables use, so no table can be given a subtly different policy set.

-- The quiz modes the progress rules tally by. Stored on the attempt because
-- deriving it from the question id would make the id a format rather than an
-- identifier.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS played_on date NOT NULL DEFAULT current_date;

COMMENT ON COLUMN quiz_attempts.played_on IS
  'The calendar day the streak rules count in. Separate from created_at, which is an instant.';

CREATE TABLE IF NOT EXISTS learning_progress (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_slug text NOT NULL,
  step_id      text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, journey_slug, step_id)
);

CREATE INDEX IF NOT EXISTS learning_progress_by_journey
  ON learning_progress (user_id, journey_slug);

SELECT public.apply_owner_rls('learning_progress');

-- A profile row per account, created with the account.
--
-- profiles has no INSERT grant for anyone, deliberately: a client that could
-- insert a profile could insert one for somebody else. So the row is created
-- by a SECURITY DEFINER trigger on auth.users, which is the only path that
-- should ever create one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 0010 — User-owned data. Never part of the canonical dataset, never validated
-- by validate:data, and isolated per user by RLS.

CREATE TABLE IF NOT EXISTS favorites (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('person','event','discovery','comparison')),
  entity_id   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS saved_comparisons (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_a_id   text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id   text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  chronology_id text NOT NULL REFERENCES chronologies(id),
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comparison_needs_two_people CHECK (person_a_id <> person_b_id),
  UNIQUE (user_id, person_a_id, person_b_id, chronology_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer      jsonb,
  correct     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS favorites_by_user ON favorites (user_id);
CREATE INDEX IF NOT EXISTS saved_comparisons_by_user ON saved_comparisons (user_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_by_user ON quiz_attempts (user_id, created_at DESC);

-- Owner-only, all four verbs. Applied by a function so no table gets a subtly
-- different policy set.
CREATE OR REPLACE FUNCTION public.apply_owner_rls(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);

  -- The verbs, which the policies below then scope to the owner's own rows.
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);

  -- A bigserial primary key needs its sequence granted too, or the INSERT
  -- grant is useless. Tables with a composite key (user_achievements) have no
  -- id column and no sequence, which is why the column is checked first.
  DECLARE seq text;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'id'
    ) THEN
      SELECT pg_get_serial_sequence('public.' || tbl, 'id') INTO seq;
      IF seq IS NOT NULL THEN
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', seq);
      END IF;
    END IF;
  END;

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ': owner reads own', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)',
                 tbl || ': owner reads own', tbl);

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ': owner inserts own', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)',
                 tbl || ': owner inserts own', tbl);

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ': owner updates own', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
                 tbl || ': owner updates own', tbl);

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || ': owner deletes own', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)',
                 tbl || ': owner deletes own', tbl);
END $$;

SELECT public.apply_owner_rls('favorites');
SELECT public.apply_owner_rls('saved_comparisons');
SELECT public.apply_owner_rls('quiz_attempts');
SELECT public.apply_owner_rls('user_achievements');

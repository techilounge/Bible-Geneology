-- Local-only shim for what Supabase provides and a bare Postgres does not.
--
-- This file is NEVER run against the hosted Supabase project, where the auth
-- schema and these roles already exist. It lives in scripts/ rather than
-- supabase/migrations/ precisely so it cannot be applied there by accident.
--
-- Its purpose is to let the real migrations run unchanged locally, so what is
-- verified here is what ships.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN NOINHERIT;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  -- Supabase puts whatever the identity provider returned here; the profile
  -- trigger in 0014 reads a display name out of it. Shimmed so the trigger
  -- runs locally exactly as it will on the hosted project.
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Supabase derives this from the request JWT. Locally, tests set the setting
-- directly with set_config('request.jwt.claim.sub', ...), which is how the RLS
-- isolation suite impersonates two different users against real policies.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

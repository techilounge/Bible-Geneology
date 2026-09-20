-- 0001 — Enumerated types.
--
-- source_type and confidence_level are deliberately separate axes. Source type
-- says what kind of thing backs a claim; confidence says how firm the value is.
-- Requirement section 6 forbids combining them.

DO $$ BEGIN
  CREATE TYPE confidence_level AS ENUM (
    'EXPLICIT', 'DERIVED', 'APPROXIMATE', 'DISPUTED', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM (
    'SCRIPTURE_EXPLICIT', 'SCRIPTURE_DERIVED', 'TEXTUAL_TRADITION',
    'HISTORICAL_SOURCE', 'SCHOLARLY_ESTIMATE', 'APPROXIMATE',
    'DISPUTED', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM (
    'DRAFT', 'SOURCE_CHECKED', 'VERIFIED', 'DISPUTED', 'DEPRECATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE relationship_type AS ENUM (
    'parent', 'child', 'spouse', 'sibling', 'ancestor', 'descendant',
    'successor', 'predecessor', 'teacher', 'disciple', 'relative',
    'tribe', 'associatedWith'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gender AS ENUM ('male', 'female', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE date_type AS ENUM ('point', 'range', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('user', 'editor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

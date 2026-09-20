-- 0005 — Person identity. No dates here, ever.
--
-- "Methuselah was the son of Enoch" is true in every textual tradition.
-- "Methuselah was born in 687 AM" is true only under a chronology. Putting a
-- birth year on this table would make the second look like the first.

CREATE TABLE IF NOT EXISTS people (
  id             text PRIMARY KEY,          -- 'methuselah': stable, URL-safe
  canonical_name text NOT NULL,
  slug           text NOT NULL UNIQUE,
  gender         gender NOT NULL DEFAULT 'unknown',
  description    text,
  era_id         text REFERENCES eras(id),
  sort_order     integer,
  review_status  review_status NOT NULL DEFAULT 'DRAFT',
  CONSTRAINT people_id_is_slug_safe CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

SELECT public.add_audit_columns('people');

-- Abram/Abraham, Sarai/Sarah, Jacob/Israel. Also what search resolves against.
CREATE TABLE IF NOT EXISTS person_names (
  id        bigserial PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name      text NOT NULL,
  name_type text NOT NULL
    CHECK (name_type IN ('canonical','alternate','transliteration','hebrew','greek','renamed_to')),
  language  text,
  notes     text,
  UNIQUE (person_id, name, name_type)
);

CREATE INDEX IF NOT EXISTS people_name_search
  ON people USING gin (to_tsvector('english', canonical_name));
CREATE INDEX IF NOT EXISTS person_names_search
  ON person_names USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS person_names_person ON person_names (person_id);

SELECT public.apply_canonical_rls('people', true);
SELECT public.apply_canonical_rls('person_names', false);

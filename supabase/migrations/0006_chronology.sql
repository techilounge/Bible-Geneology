-- 0006 — Chronologies and the per-chronology dates. The heart of the model.

CREATE TABLE IF NOT EXISTS chronologies (
  id          text PRIMARY KEY,             -- 'masoretic', 'masoretic-gen11-26'
  name        text NOT NULL,
  description text NOT NULL,
  epoch_label text NOT NULL DEFAULT 'AM',
  is_default  boolean NOT NULL DEFAULT false,
  source_id   text REFERENCES sources(id),
  notes       text
);

-- Exactly one default chronology, enforced rather than assumed.
CREATE UNIQUE INDEX IF NOT EXISTS chronologies_single_default
  ON chronologies ((is_default)) WHERE is_default;

CREATE TABLE IF NOT EXISTS person_chronology (
  person_id            text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  chronology_id        text NOT NULL REFERENCES chronologies(id),

  birth_year           integer,
  death_year           integer,
  lifespan             integer,

  birth_confidence     confidence_level NOT NULL,
  death_confidence     confidence_level NOT NULL,
  lifespan_confidence  confidence_level NOT NULL,

  birth_source_type    source_type NOT NULL,
  death_source_type    source_type NOT NULL,
  lifespan_source_type source_type NOT NULL,

  calculation_method   text,
  derivation           jsonb,
  notes                text,

  review_status        review_status NOT NULL DEFAULT 'DRAFT',
  verified_by          uuid REFERENCES auth.users(id),
  verified_at          timestamptz,

  PRIMARY KEY (person_id, chronology_id),

  CONSTRAINT death_after_birth
    CHECK (birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year),
  CONSTRAINT lifespan_non_negative
    CHECK (lifespan IS NULL OR lifespan >= 0),

  -- The schema-level expression of "unknown stays unknown" (requirement
  -- section 7). It makes a guessed number under an UNKNOWN label impossible,
  -- and a real number the UI would have to treat as unknown equally impossible.
  -- Most of the women in requirement section 43 are legitimately all-UNKNOWN
  -- rows, and this constraint makes that a coherent state rather than missing
  -- data.
  CONSTRAINT unknown_means_null CHECK (
    (birth_confidence = 'UNKNOWN')    = (birth_year IS NULL) AND
    (death_confidence = 'UNKNOWN')    = (death_year IS NULL) AND
    (lifespan_confidence = 'UNKNOWN') = (lifespan IS NULL)
  ),

  CONSTRAINT verified_requires_reviewer CHECK (
    review_status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)
  )
);

SELECT public.add_audit_columns('person_chronology');

-- "Who was alive in year N" is the hottest read path in the product.
CREATE INDEX IF NOT EXISTS person_chronology_alive
  ON person_chronology (chronology_id, birth_year, death_year);
CREATE INDEX IF NOT EXISTS person_chronology_by_death
  ON person_chronology (chronology_id, death_year);
CREATE INDEX IF NOT EXISTS person_chronology_review
  ON person_chronology (chronology_id, review_status);

SELECT public.apply_canonical_rls('chronologies', false);
SELECT public.apply_canonical_rls('person_chronology', true);

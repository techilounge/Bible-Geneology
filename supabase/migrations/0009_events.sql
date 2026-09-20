-- 0009 — Events, split from their dates for the same reason people are.

CREATE TABLE IF NOT EXISTS events (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  description   text,
  event_type    text,
  review_status review_status NOT NULL DEFAULT 'DRAFT',
  CONSTRAINT events_id_is_slug_safe CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

SELECT public.add_audit_columns('events');

CREATE TABLE IF NOT EXISTS event_chronology (
  event_id      text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  chronology_id text NOT NULL REFERENCES chronologies(id),
  start_year    integer,
  end_year      integer,
  date_type     date_type NOT NULL,
  confidence    confidence_level NOT NULL,
  source_type   source_type NOT NULL,
  derivation    jsonb,
  notes         text,
  review_status review_status NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (event_id, chronology_id),
  CONSTRAINT event_range_ordered
    CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  CONSTRAINT event_unknown_means_null
    CHECK ((confidence = 'UNKNOWN') = (start_year IS NULL))
);

SELECT public.add_audit_columns('event_chronology');

CREATE TABLE IF NOT EXISTS event_people (
  event_id  text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'participant',
  PRIMARY KEY (event_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS event_chronology_by_year
  ON event_chronology (chronology_id, start_year);
CREATE INDEX IF NOT EXISTS event_people_by_person ON event_people (person_id);

SELECT public.apply_canonical_rls('events', true);
SELECT public.apply_canonical_rls('event_chronology', true);
SELECT public.apply_canonical_rls('event_people', false);

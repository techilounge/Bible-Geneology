-- 0004 — Reference data: eras, sources, scripture references.

CREATE TABLE IF NOT EXISTS eras (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  source_type source_type NOT NULL,
  citation    text,
  url         text,
  license     text,
  notes       text
);

-- No verse text column, by design. Requirement section 16 is a licensing
-- constraint, and the cleanest way to honour it is to have nowhere to put
-- copyrighted text. Verse text, when shown, is fetched at runtime from a
-- licensed API or a public-domain translation and cached separately.
CREATE TABLE IF NOT EXISTS scripture_references (
  id            text PRIMARY KEY,           -- 'GEN.5.21' or 'GEN.5.21-27'
  book          text NOT NULL,              -- OSIS-style, e.g. 'GEN', 'ACT'
  chapter       integer NOT NULL,
  verse_start   integer,
  verse_end     integer,
  canonical_key text NOT NULL UNIQUE,
  display_label text NOT NULL,              -- 'Genesis 5:21'
  CONSTRAINT verse_range_ordered
    CHECK (verse_end IS NULL OR verse_start IS NULL OR verse_end >= verse_start),
  CONSTRAINT chapter_positive CHECK (chapter > 0),
  CONSTRAINT verse_start_positive CHECK (verse_start IS NULL OR verse_start > 0)
);

SELECT public.apply_canonical_rls('eras', false);
SELECT public.apply_canonical_rls('sources', false);
SELECT public.apply_canonical_rls('scripture_references', false);

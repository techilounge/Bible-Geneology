# DATA_MODEL.md

**Project:** Bible Timeline Explorer
**Phase:** 0 — proposed schema for Phase 1 implementation
**Date:** 2026-09-20

---

## 1. The separation that everything else follows from

A person's identity and a person's dates are different kinds of claim.

"Methuselah was the son of Enoch" is a statement about the person, true in every
textual tradition. "Methuselah was born in 687 AM" is a statement about the person
_under a chronology_, and it changes when the chronology changes. Storing a birth year
on the person row would make the second kind of claim look like the first.

So:

- `people` — identity, stable across chronologies. **No dates, ever.**
- `person_chronology` — one row per (person, chronology). Dates live here.
- `relationships` — separate rows, directional, with their own provenance.
- `scripture_references` — normalized, translation-independent.
- `sources` and `source_claims` — what backs each value.

Every derived number carries the provenance needed to explain itself (§17).

---

## 2. Enumerated types

```sql
CREATE TYPE confidence_level AS ENUM (
  'EXPLICIT', 'DERIVED', 'APPROXIMATE', 'DISPUTED', 'UNKNOWN'
);

CREATE TYPE source_type AS ENUM (
  'SCRIPTURE_EXPLICIT', 'SCRIPTURE_DERIVED', 'TEXTUAL_TRADITION',
  'HISTORICAL_SOURCE', 'SCHOLARLY_ESTIMATE', 'APPROXIMATE',
  'DISPUTED', 'UNKNOWN'
);

CREATE TYPE review_status AS ENUM (
  'DRAFT', 'SOURCE_CHECKED', 'VERIFIED', 'DISPUTED', 'DEPRECATED'
);

CREATE TYPE relationship_type AS ENUM (
  'parent', 'child', 'spouse', 'sibling', 'ancestor', 'descendant',
  'successor', 'predecessor', 'teacher', 'disciple', 'relative',
  'tribe', 'associatedWith'
);

CREATE TYPE gender AS ENUM ('male', 'female', 'unknown');

CREATE TYPE date_type AS ENUM ('point', 'range', 'unknown');
```

`confidence_level` and `source_type` are deliberately separate. Source type says
_what kind of thing_ backs a claim; confidence says _how firm the value is_. A
SCHOLARLY_ESTIMATE source can back an APPROXIMATE value, and a SCRIPTURE_EXPLICIT
source backs an EXPLICIT one, but the axes are independent and §6 forbids merging them.

---

## 3. Core tables

### `people`

```sql
CREATE TABLE people (
  id              text PRIMARY KEY,          -- 'methuselah', stable, URL-safe
  canonical_name  text NOT NULL,
  slug            text NOT NULL UNIQUE,
  gender          gender NOT NULL DEFAULT 'unknown',
  description     text,
  era_id          text REFERENCES eras(id),
  sort_order      integer,
  review_status   review_status NOT NULL DEFAULT 'DRAFT',
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id),
  revision_notes  text
);
```

Text primary keys rather than UUIDs, because these identifiers appear in URLs, in the
canonical JSON, in test assertions, and in git diffs. `people.id = 'methuselah'` makes
a pull request reviewable by a person who knows Genesis but not databases. Identifiers
are assigned once and never reused.

There is no `birth_year` column here and there never will be.

### `person_names`

```sql
CREATE TABLE person_names (
  id            bigserial PRIMARY KEY,
  person_id     text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name          text NOT NULL,
  name_type     text NOT NULL,   -- 'canonical' | 'alternate' | 'transliteration'
                                 -- | 'hebrew' | 'greek' | 'renamed_to'
  language      text,
  notes         text,
  UNIQUE (person_id, name, name_type)
);
```

Needed for Abram/Abraham, Sarai/Sarah, Jacob/Israel, and for search (§41) to find a
person under any name they are known by.

### `chronologies`

```sql
CREATE TABLE chronologies (
  id            text PRIMARY KEY,     -- 'masoretic', 'septuagint', 'samaritan'
  name          text NOT NULL,
  description   text NOT NULL,
  epoch_label   text NOT NULL DEFAULT 'AM',
  is_default    boolean NOT NULL DEFAULT false,
  source_id     text REFERENCES sources(id),
  notes         text
);
```

MVP seeds `masoretic` only, with `is_default = true`. The table exists from Phase 1 so
that no code path ever assumes a single chronology.

### `person_chronology`

The heart of the model.

```sql
CREATE TABLE person_chronology (
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
  derivation           jsonb,     -- ordered steps, see §5
  notes                text,

  review_status        review_status NOT NULL DEFAULT 'DRAFT',
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES auth.users(id),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id),
  revision_notes       text,

  PRIMARY KEY (person_id, chronology_id),

  CONSTRAINT death_after_birth
    CHECK (birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year),
  CONSTRAINT lifespan_non_negative
    CHECK (lifespan IS NULL OR lifespan >= 0),
  CONSTRAINT unknown_means_null
    CHECK (
      (birth_confidence = 'UNKNOWN') = (birth_year IS NULL) AND
      (death_confidence = 'UNKNOWN') = (death_year IS NULL) AND
      (lifespan_confidence = 'UNKNOWN') = (lifespan IS NULL)
    )
);
```

The `unknown_means_null` constraint is the schema-level expression of §7's rule that
unknown values stay unknown. It makes it impossible to store a guessed number under an
UNKNOWN label, or a real number the UI would then have to treat as unknown. Most of the
women in §43 will have `birth_confidence = 'UNKNOWN'` and a null year, and the database
will enforce that this is a coherent state rather than missing data.

Note that lifespan is stored rather than always computed. For several people Scripture
states the lifespan explicitly while the years are derived, and for Sarah the lifespan
is explicit while her birth year is derived from Abraham's. Storing all three with
independent confidence lets validation cross-check them (§21) instead of assuming.

### `relationships`

```sql
CREATE TABLE relationships (
  id                 bigserial PRIMARY KEY,
  source_person_id   text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  target_person_id   text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type  relationship_type NOT NULL,
  confidence         confidence_level NOT NULL,
  source_type        source_type NOT NULL,
  notes              text,
  review_status      review_status NOT NULL DEFAULT 'DRAFT',
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES auth.users(id),
  revision_notes     text,

  CONSTRAINT no_self_relationship CHECK (source_person_id <> target_person_id),
  UNIQUE (source_person_id, target_person_id, relationship_type)
);
```

**Stored vs. computed (§14).** Only these types are stored: `parent`, `spouse`,
`sibling` where Scripture names it directly, `tribe`, `teacher`, `disciple`,
`successor`, `predecessor`, `associatedWith`. Everything transitive — `ancestor`,
`descendant`, and sibling-by-shared-parent — is computed from the parent edges by the
engine. The enum keeps the transitive members so a future record can be stored when a
text asserts a relationship whose intermediate generations are not given, but no seed
may use them without a note explaining why it is not derivable.

`child` is stored as the inverse of `parent` and never duplicated: the canonical
direction is `parent`, meaning _source is the parent of target_. A validator enforces
that no `child` row exists whose `parent` inverse is also present.

### `scripture_references`

```sql
CREATE TABLE scripture_references (
  id             text PRIMARY KEY,     -- 'GEN.5.21' or 'GEN.5.21-27'
  book           text NOT NULL,        -- 'GEN', OSIS-style
  chapter        integer NOT NULL,
  verse_start    integer,
  verse_end      integer,
  canonical_key  text NOT NULL UNIQUE,
  display_label  text NOT NULL,        -- 'Genesis 5:21'
  CONSTRAINT verse_range_ordered
    CHECK (verse_end IS NULL OR verse_start IS NULL OR verse_end >= verse_start)
);
```

No verse text column. §16 is a licensing requirement, and the cleanest way to honour it
is for the schema to have nowhere to put copyrighted text. Verse text, when displayed,
is fetched at runtime from a licensed API or a public-domain translation and cached
separately from canonical data.

Attachment is polymorphic through a join table rather than an array column, so a
reference can be attached to a person, a chronology value, a relationship, or an event
with the same mechanism and can be indexed:

```sql
CREATE TABLE scripture_attachments (
  id            bigserial PRIMARY KEY,
  reference_id  text NOT NULL REFERENCES scripture_references(id),
  entity_type   text NOT NULL,   -- 'person' | 'person_chronology'
                                 -- | 'relationship' | 'event' | 'source_claim'
  entity_id     text NOT NULL,
  role          text,            -- 'birth' | 'death' | 'lifespan' | 'primary' | ...
  UNIQUE (reference_id, entity_type, entity_id, role)
);
```

### `sources` and `source_claims`

```sql
CREATE TABLE sources (
  id           text PRIMARY KEY,   -- 'masoretic-text', 'gen-5-explicit'
  name         text NOT NULL,
  source_type  source_type NOT NULL,
  citation     text,
  url          text,
  license      text,
  notes        text
);

CREATE TABLE source_claims (
  id            bigserial PRIMARY KEY,
  source_id     text NOT NULL REFERENCES sources(id),
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  field         text NOT NULL,      -- 'birth_year', 'lifespan', ...
  claimed_value text,
  confidence    confidence_level NOT NULL,
  notes         text
);
```

`source_claims` is what makes disagreement representable. When the Masoretic text and
the Septuagint give different ages for Kenan, that is two claim rows on the same field,
not a conflict to resolve at seed time.

### `events` and `event_chronology`

Same split as people, for the same reason.

```sql
CREATE TABLE events (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  description   text,
  event_type    text,
  review_status review_status NOT NULL DEFAULT 'DRAFT',
  -- audit columns as above
);

CREATE TABLE event_chronology (
  event_id        text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  chronology_id   text NOT NULL REFERENCES chronologies(id),
  start_year      integer,
  end_year        integer,
  date_type       date_type NOT NULL,
  confidence      confidence_level NOT NULL,
  source_type     source_type NOT NULL,
  derivation      jsonb,
  notes           text,
  review_status   review_status NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (event_id, chronology_id),
  CONSTRAINT event_range_ordered
    CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
);

CREATE TABLE event_people (
  event_id           text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id          text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role               text,
  PRIMARY KEY (event_id, person_id, role)
);
```

---

## 4. Application tables

These hold user data. They are never part of the canonical dataset and never
validated by `validate:data`.

| Table                                   | Key columns                                                                                             | Notes                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `profiles`                              | `id` → `auth.users`, `display_name`, `role`, `preferences jsonb`                                        | `role` is `'user' \| 'editor' \| 'admin'`. Authorization reads this, never a client claim. |
| `favorites`                             | `user_id`, `entity_type`, `entity_id`                                                                   | RLS: owner only.                                                                           |
| `saved_comparisons`                     | `user_id`, `person_a_id`, `person_b_id`, `chronology_id`                                                | RLS: owner only.                                                                           |
| `discoveries`                           | `id`, `discovery_type`, `payload jsonb`, `chronology_id`, `generated_at`                                | Machine-generated by the engine. Regenerated, never edited.                                |
| `quiz_questions`                        | `id`, `mode`, `template`, `parameters jsonb`, `review_status`                                           | Templates, not answers. Answers come from the engine (§12 exit gate).                      |
| `quiz_attempts`                         | `user_id`, `question_id`, `answer`, `correct`, `created_at`                                             | RLS: owner only.                                                                           |
| `learning_paths`, `learning_path_steps` | ordered steps referencing people, events, discoveries                                                   | Content, publicly readable.                                                                |
| `achievements`, `user_achievements`     | badge definitions and grants                                                                            | Grants written server-side only.                                                           |
| `audit_logs`                            | `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `created_at` | Append-only. No update or delete policy exists for any role.                               |

---

## 5. The derivation record

This is what makes "Why this date?" (§17) possible without the UI re-deriving anything.

```jsonc
{
  "personId": "methuselah",
  "chronologyId": "masoretic",
  "field": "birthYear",
  "result": 687,
  "unit": "AM",
  "method": "genesis-5-begetting-chain",
  "steps": [
    {
      "from": "adam",
      "to": "seth",
      "years": 130,
      "reference": "GEN.5.3",
      "runningTotal": 130,
    },
    {
      "from": "seth",
      "to": "enosh",
      "years": 105,
      "reference": "GEN.5.6",
      "runningTotal": 235,
    },
    {
      "from": "enosh",
      "to": "kenan",
      "years": 90,
      "reference": "GEN.5.9",
      "runningTotal": 325,
    },
    {
      "from": "kenan",
      "to": "mahalalel",
      "years": 70,
      "reference": "GEN.5.12",
      "runningTotal": 395,
    },
    {
      "from": "mahalalel",
      "to": "jared",
      "years": 65,
      "reference": "GEN.5.15",
      "runningTotal": 460,
    },
    {
      "from": "jared",
      "to": "enoch",
      "years": 162,
      "reference": "GEN.5.18",
      "runningTotal": 622,
    },
    {
      "from": "enoch",
      "to": "methuselah",
      "years": 65,
      "reference": "GEN.5.21",
      "runningTotal": 687,
    },
  ],
  "assumptions": ["adam-created-at-year-zero", "begetting-age-is-named-son"],
  "confidence": "DERIVED",
}
```

Two things to notice. The numbers above are the derivation _shape_; each one is
verified against the text in Phase 2 before it is seeded, per `DATA_SOURCING.md` §7.
And `assumptions` is a list of identifiers, not prose — each maps to an entry in
`data/canonical/assumptions.json` with its own explanation, so the UI can show a reader
exactly which interpretive choices a date depends on.

A validator recomputes every derivation from its steps and fails if `runningTotal` does
not match `result`. A stored derivation that disagrees with its own arithmetic is a
build failure.

---

## 6. Indexes

```sql
CREATE INDEX ON person_chronology (chronology_id, birth_year);
CREATE INDEX ON person_chronology (chronology_id, death_year);
CREATE INDEX ON person_chronology (chronology_id, review_status);
CREATE INDEX ON relationships (source_person_id, relationship_type);
CREATE INDEX ON relationships (target_person_id, relationship_type);
CREATE INDEX ON event_chronology (chronology_id, start_year);
CREATE INDEX ON scripture_attachments (entity_type, entity_id);
CREATE INDEX ON people USING gin (to_tsvector('english', canonical_name));
CREATE INDEX ON person_names USING gin (to_tsvector('english', name));
CREATE INDEX ON audit_logs (entity_type, entity_id, created_at DESC);
```

The "who was alive in year N" query is a range scan over
`(chronology_id, birth_year, death_year)` and is the hottest read path in the product.

---

## 7. TypeScript types

Types are derived from Zod schemas, not written twice:

```ts
export const PersonChronologySchema = z
  .object({
    personId: z.string(),
    chronologyId: z.string(),
    birthYear: z.number().int().nullable(),
    deathYear: z.number().int().nullable(),
    lifespan: z.number().int().nonnegative().nullable(),
    birthConfidence: ConfidenceLevelSchema,
    deathConfidence: ConfidenceLevelSchema,
    lifespanConfidence: ConfidenceLevelSchema,
    sourceReferences: z.array(z.string()).min(1),
    derivation: DerivationSchema.nullable(),
    reviewStatus: ReviewStatusSchema,
  })
  .refine(
    (v) => (v.birthConfidence === 'UNKNOWN') === (v.birthYear === null),
    'UNKNOWN confidence requires a null year',
  );

export type PersonChronology = z.infer<typeof PersonChronologySchema>;
```

`sourceReferences` is `.min(1)`, so a chronology record without provenance cannot
parse. That is §5 expressed where it gets enforced.

The engine's public types use a discriminated union for results that may be
undeterminable, which is how §57's "never show NaN" is made structural:

```ts
export type ChronologyResult<T> =
  | { status: 'known'; value: T; confidence: ConfidenceLevel; derivation?: Derivation }
  | { status: 'unknown'; reason: 'no-data' | 'unknown-in-chronology' | 'not-applicable' }
  | { status: 'disputed'; alternatives: Array<{ value: T; sourceId: string }> };
```

A component cannot render this without handling all three cases. There is no code path
that produces `NaN`, because there is no code path that returns a bare number.

---

## 8. Open questions for Phase 1

1. Should `eras` be a table or a derived grouping? Leaning table, since §42 wants era
   as a filter and eras have their own date ranges per chronology.
2. Do tribe affiliations need their own table rather than a `relationship_type`? The
   twelve tribes carry territory and lineage data that a relationship row cannot hold.
   Deferred until the dataset reaches Jacob's sons.
3. Whether `discoveries` should be a table at all, given they are fully regenerable.
   Proposal: keep the table for stable share URLs, treat rows as a cache with a
   `generated_at` and a regeneration job.

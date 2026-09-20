-- 0007 — Relationships as independent records.
--
-- Stored: parent, spouse, sibling where a text names it, tribe, teacher,
-- disciple, successor, predecessor, associatedWith.
-- Computed by the engine from parent edges: ancestor, descendant, and
-- sibling-by-shared-parent. The transitive members stay in the enum so a future
-- record can be stored when a text asserts a relationship whose intermediate
-- generations are not given, but a seed may not use them without a note.

CREATE TABLE IF NOT EXISTS relationships (
  id                bigserial PRIMARY KEY,
  source_person_id  text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  target_person_id  text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  confidence        confidence_level NOT NULL,
  source_type       source_type NOT NULL,
  notes             text,
  review_status     review_status NOT NULL DEFAULT 'DRAFT',

  CONSTRAINT no_self_relationship CHECK (source_person_id <> target_person_id),
  UNIQUE (source_person_id, target_person_id, relationship_type)
);

SELECT public.add_audit_columns('relationships');

-- The canonical direction for descent is `parent`, meaning source is the parent
-- of target. A `child` row that is merely the inverse of an existing `parent`
-- row is a duplicate fact and is rejected here rather than left for the
-- validator to notice.
CREATE OR REPLACE FUNCTION public.forbid_redundant_child_edge()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.relationship_type = 'child' AND EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.source_person_id = NEW.target_person_id
      AND r.target_person_id = NEW.source_person_id
      AND r.relationship_type = 'parent'
  ) THEN
    RAISE EXCEPTION
      'A child edge duplicates an existing parent edge; store descent as parent only';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS relationships_forbid_redundant_child ON relationships;
CREATE TRIGGER relationships_forbid_redundant_child
  BEFORE INSERT OR UPDATE ON relationships
  FOR EACH ROW EXECUTE FUNCTION public.forbid_redundant_child_edge();

-- A person cannot be their own ancestor. Checked here as well as in the
-- dataset validator, because a cycle makes ancestor-path queries non-terminating
-- and the database is the last place it can be stopped.
CREATE OR REPLACE FUNCTION public.forbid_parent_cycle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cycle_found boolean;
BEGIN
  IF NEW.relationship_type <> 'parent' THEN
    RETURN NEW;
  END IF;

  WITH RECURSIVE ancestors(person_id, depth) AS (
    SELECT NEW.source_person_id, 0
    UNION ALL
    SELECT r.source_person_id, a.depth + 1
    FROM relationships r
    JOIN ancestors a ON r.target_person_id = a.person_id
    WHERE r.relationship_type = 'parent' AND a.depth < 200
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE person_id = NEW.target_person_id)
  INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'Parent edge % -> % would create an ancestry cycle',
      NEW.source_person_id, NEW.target_person_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS relationships_forbid_parent_cycle ON relationships;
CREATE TRIGGER relationships_forbid_parent_cycle
  BEFORE INSERT OR UPDATE ON relationships
  FOR EACH ROW EXECUTE FUNCTION public.forbid_parent_cycle();

CREATE INDEX IF NOT EXISTS relationships_by_source
  ON relationships (source_person_id, relationship_type);
CREATE INDEX IF NOT EXISTS relationships_by_target
  ON relationships (target_person_id, relationship_type);

SELECT public.apply_canonical_rls('relationships', true);

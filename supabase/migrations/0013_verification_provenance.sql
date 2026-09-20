-- 0013 — Provenance for a verification that was not performed by a person.
--
-- Carried since Phase 2. `verified_by` is a uuid referencing auth.users,
-- which assumes a human reviewer typed the number in and signed it off. The
-- Phase 2 verification pass is not a person: it is
-- scripts/verify-source.ts reading two public-domain translations, and it
-- records itself as `source-check:web-bible+kjv-1769`.
--
-- Recording a tool as if it were a user would be a lie in the audit trail,
-- and recording nothing would lose the one fact that matters — what actually
-- checked the figure. So the table gains a label alongside the uuid, and the
-- constraint accepts either.
--
-- The same reasoning applies to who supplied a reading in the first place.
-- Supplying a number and verifying it are different acts by different
-- parties, and Kelv's instruction on 2026-09-20 was explicit that the person
-- who supplied a figure must not be recorded as having verified it.

ALTER TABLE person_chronology
  ADD COLUMN IF NOT EXISTS verified_by_label text,
  ADD COLUMN IF NOT EXISTS supplied_by       text,
  ADD COLUMN IF NOT EXISTS supplied_at       date,
  ADD COLUMN IF NOT EXISTS verification      jsonb;

COMMENT ON COLUMN person_chronology.verified_by_label IS
  'What verified this record when it was not a person: a tool and its sources, as in source-check:web-bible+kjv-1769.';
COMMENT ON COLUMN person_chronology.supplied_by IS
  'Who supplied the reading. Never doubles as the verifier; see docs/PHASE_2_VERIFICATION_REPORT.md.';
COMMENT ON COLUMN person_chronology.verification IS
  'How the check was carried out: method, tool, sources, figures checked, and whether a derivation was rerun.';

ALTER TABLE person_chronology DROP CONSTRAINT IF EXISTS verified_requires_reviewer;
ALTER TABLE person_chronology ADD CONSTRAINT verified_requires_reviewer CHECK (
  review_status <> 'VERIFIED'
  OR ((verified_by IS NOT NULL OR verified_by_label IS NOT NULL) AND verified_at IS NOT NULL)
);

-- A label is only meaningful when it says what did the checking, so an empty
-- string is not a label.
ALTER TABLE person_chronology DROP CONSTRAINT IF EXISTS verified_by_label_is_not_blank;
ALTER TABLE person_chronology ADD CONSTRAINT verified_by_label_is_not_blank CHECK (
  verified_by_label IS NULL OR length(btrim(verified_by_label)) > 0
);

-- 0018 — The index the progress read actually needs.
--
-- quiz_attempts already had (user_id, created_at DESC), which is the
-- right index for "what did this person do recently". Phase 13 reads it
-- a different way: every attempt for one person, ordered by the
-- calendar day the streak rules count in, which is played_on and not
-- created_at. A person who has played for a year has a few hundred rows
-- and the difference is unnoticeable; a person who has played for five
-- does not, and the index costs nothing to add now.

CREATE INDEX IF NOT EXISTS quiz_attempts_by_day
  ON quiz_attempts (user_id, played_on);

-- The mode tallies in lib/progress read every attempt anyway, so there
-- is no index on mode: it would be written on every attempt and read by
-- nothing.

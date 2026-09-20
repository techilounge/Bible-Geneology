-- 0015 — An attempt records a question that was generated, not stored.
--
-- 0011 gave quiz_attempts a foreign key to quiz_questions, on the assumption
-- that a question is a row somebody wrote. Phase 12 built the opposite: a
-- question is generated from the dataset by `lib/quiz`, its answer is checked
-- against the chronology engine before it is shown, and nothing is stored,
-- because a stored question is an answer key that can fall out of step with
-- the data it came from.
--
-- The question is still perfectly identifiable, and reproducible: the mode
-- and the seed regenerate it exactly, byte for byte, which the Phase 12
-- golden suite asserts over eight hundred of them. So the attempt records
-- the mode and the seed, and the foreign key goes.
--
-- quiz_questions stays. Phase 14 may want hand-authored questions under
-- review, and those would legitimately be rows.

ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_question_fk;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS seed text;

COMMENT ON COLUMN quiz_attempts.question_id IS
  'The generated question''s id, of the form <mode>-<seed>. Not a foreign key: the question is reproduced from the mode and the seed rather than stored.';
COMMENT ON COLUMN quiz_attempts.seed IS
  'The seed the question was generated from. With the mode it regenerates the question exactly.';

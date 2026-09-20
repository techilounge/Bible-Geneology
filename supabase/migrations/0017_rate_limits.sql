-- 0017 — Where a rate limit is counted.
--
-- The sign-in link is the one endpoint that does something expensive on
-- behalf of somebody who has not signed in: it sends an email to an
-- address they typed. Counting that in process memory is a speed bump
-- on one machine and nothing at all on two, so the count lives here.
--
-- No client ever reads or writes this table. It is written by the
-- server action through the service role, so it gets RLS with no policy
-- at all: the strictest state there is, and the same shape the canonical
-- tables use.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     text PRIMARY KEY,
  tokens     double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rows are worthless once they have refilled to full, and a limiter that
-- grows for ever is a limiter that becomes a disk problem. Anything
-- untouched for a day is collectable.
CREATE INDEX IF NOT EXISTS rate_limits_updated_at ON rate_limits (updated_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- No policy, for any role or verb. Deliberate: see above.

CREATE OR REPLACE FUNCTION public.sweep_rate_limits()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM rate_limits WHERE updated_at < now() - interval '1 day';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;

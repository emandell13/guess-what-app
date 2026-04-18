-- Adds impression tracking to the candidate pool so serving, retirement, and
-- (future) promotion ranking can all be based on fair exposure, not raw pick
-- count.
--
-- Why:
--   Previously getCandidatesForVoter sorted by pick_count ASC, which actively
--   favored brand-new 0-pick candidates over established 1-2-pick ones — so
--   older candidates stagnated and age-based retirement was unfair ("14 days
--   old with 0 picks" doesn't mean the same thing for two candidates that got
--   very different exposure). Tracking impressions fixes the entire chain:
--   serve the least-shown first, retire when a candidate has actually been
--   tested (impressions >= N) without being picked.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS impression_count integer NOT NULL DEFAULT 0;

-- Small helper so the backend can increment counts for a batch of questions
-- in one round-trip — the Supabase JS client doesn't express `col = col + 1`
-- directly. Called from questionPickService.getCandidatesForVoter after the
-- 3 candidates for a session are chosen.
CREATE OR REPLACE FUNCTION increment_impression_counts(question_ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE questions
  SET impression_count = impression_count + 1
  WHERE id = ANY(question_ids);
$$;

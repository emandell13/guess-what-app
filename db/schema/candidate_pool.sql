-- Adds a candidate-pool model on top of the existing questions table so players
-- can vote on which questions get played next.
--
-- New shape:
--   questions.status: 'candidate' | 'scheduled' | 'completed'
--     - candidate: in the pool, no active_date assigned, awaiting picks
--     - scheduled: promoted to a date (active_date is set), voting/play open
--     - completed: voting tallied (voting_complete=true)
--
--   question_picks: one row per (question, voter) where voter picked this
--   question as their favorite of the 3 shown. Drives candidate ranking and
--   the "don't show a question I've already picked" rule.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS status text;

-- Backfill existing rows. voting_complete + active_date drive the mapping:
--   voting_complete = true                  -> completed (already played)
--   active_date < today                     -> completed (slipped past, treat as done)
--   active_date >= today                    -> scheduled (today or future, dated)
--   no active_date                          -> candidate (shouldn't exist pre-migration)
UPDATE questions
SET status = CASE
  WHEN voting_complete = true THEN 'completed'
  WHEN active_date IS NULL THEN 'candidate'
  WHEN active_date < CURRENT_DATE THEN 'completed'
  ELSE 'scheduled'
END
WHERE status IS NULL;

ALTER TABLE questions
  ALTER COLUMN status SET DEFAULT 'candidate',
  ALTER COLUMN status SET NOT NULL;

-- Allow active_date to be NULL going forward — candidates have no date until
-- they're promoted by the daily cron.
ALTER TABLE questions
  ALTER COLUMN active_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_status
  ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_status_active_date
  ON questions(status, active_date);

-- One pick per voter per question. Visitor_id is always present for both anon
-- and signed-in users (see backend/services/visitorService.ensureVisitorExists),
-- so we key uniqueness on (question_id, visitor_id) and also store user_id
-- alongside for analytics.
CREATE TABLE IF NOT EXISTS question_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_picks_visitor_unique UNIQUE (question_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_question_picks_question
  ON question_picks(question_id);
CREATE INDEX IF NOT EXISTS idx_question_picks_visitor
  ON question_picks(visitor_id);
CREATE INDEX IF NOT EXISTS idx_question_picks_user
  ON question_picks(user_id);

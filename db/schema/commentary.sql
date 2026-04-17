-- Adds host-commentary columns to the questions table.
-- Run this once in the Supabase SQL editor before deploying the #6 host-commentary work.
--
-- quip_target_rank: which of the top-5 answers the pre-written barb targets
--   (Claude picks whichever one has the best comedy potential). NULL means
--   the content engine didn't think any answer was worth a quip for this day.
-- quip_text: the Claude-generated line itself, shown in the host bubble
--   when that specific rank is correctly revealed.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS quip_target_rank integer,
  ADD COLUMN IF NOT EXISTS quip_text text;

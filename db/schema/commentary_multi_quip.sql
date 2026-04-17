-- Switches the single-quip columns (quip_target_rank + quip_text) to a JSONB
-- array column so Claude can write 2-3 quips per question, each tied to a
-- different top-5 rank. Multiple host moments per game instead of one.
--
-- Shape of quips: [{ "targetRank": 3, "text": "..." }, { "targetRank": 5, "text": "..." }]
-- or null/empty-array when no ranks have good comedy material.
--
-- Run this once in the Supabase SQL editor, after db/schema/commentary.sql.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS quips jsonb;

-- Drop the old single-quip columns — their 11 backfilled rows are being
-- regenerated with the new multi-quip Sonnet pipeline.
ALTER TABLE questions
  DROP COLUMN IF EXISTS quip_target_rank,
  DROP COLUMN IF EXISTS quip_text;

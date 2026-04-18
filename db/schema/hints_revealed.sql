-- Adds a per-play counter of how many hints the player revealed.
-- Run this once in the Supabase SQL editor.
--
-- hints_revealed: incremented each time the client POSTs to
--   /guesses/hint-revealed. Used by the admin analytics view to
--   surface how much scaffolding a question needed to land.

ALTER TABLE game_progress
  ADD COLUMN IF NOT EXISTS hints_revealed integer NOT NULL DEFAULT 0;

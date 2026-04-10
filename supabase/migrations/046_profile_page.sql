-- Migration 046: User profile pages (PTSPH-196)
--
-- Each user can compose a personal page (block editor output).
-- Stored as JSONB; null = no page yet.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_page JSONB DEFAULT NULL;

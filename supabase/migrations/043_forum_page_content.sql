-- Migration 043: Forum page content & collaborator schema (PTSPH-192)
--
-- Adds updated_by to forum_posts for page content authorship tracking.
-- content JSONB and updated_at are already present from migration 040.

ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

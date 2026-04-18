-- Migration 047: Onboarding tour completion flag (PTSPH-197)
--
-- Tracks whether a user has completed the onboarding tour.
-- Set to true after they dismiss or finish the tour.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

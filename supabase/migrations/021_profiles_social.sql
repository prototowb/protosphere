-- Migration 021: Profiles Social Fields
-- Adds remaining rich profile fields not covered by 020.
-- (020 handles pronouns/website/location/display_banner_url)
-- This migration is a no-op placeholder — all profile fields are in 020.
-- Reserved for future social graph features (follows, friends, etc.)

-- Ensure the setup_complete flag exists on community_settings for the setup wizard
ALTER TABLE community_settings
  ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT false;

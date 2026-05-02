-- Migration 051: Add api_key column to integrations
-- Supabase Edge Functions require an apikey header (the project's publishable key)
-- for gateway access. This stores the external project's publishable key so
-- Protosphere can pass it when calling the integration endpoint.

ALTER TABLE integrations
  ADD COLUMN api_key TEXT NOT NULL DEFAULT '';

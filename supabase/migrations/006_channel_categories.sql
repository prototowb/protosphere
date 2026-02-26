-- 006_channel_categories.sql
-- Adds channel_categories table and category_id FK on channels.
-- This table was implemented in local.ts and supabase-backend.ts but had no migration.

-- =============================================================================
-- channel_categories
-- =============================================================================
CREATE TABLE channel_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL
                CONSTRAINT category_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, name)
);

CREATE INDEX idx_channel_categories_server ON channel_categories (server_id, position);

-- Add category_id FK to channels
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL;

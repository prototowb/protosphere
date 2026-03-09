-- Migration 022: index to support cursor-based message pagination
-- Enables efficient "fetch last N messages before timestamp" queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_channel_created_idx
  ON messages (channel_id, created_at DESC);

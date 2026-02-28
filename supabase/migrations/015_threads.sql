-- 015_threads.sql
-- Threads are lightweight channels spawned from a parent message.
-- A thread IS a channel with parent_message_id set.

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS parent_message_id UUID
    REFERENCES messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_channel_id UUID
    REFERENCES channels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_channels_parent_message
  ON channels (parent_message_id)
  WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channels_parent_channel
  ON channels (parent_channel_id)
  WHERE parent_channel_id IS NOT NULL;

-- RLS: threads inherit visibility from their parent channel's server.
-- Existing channel RLS policies (members can see channels in their servers)
-- cover threads automatically since they share server_id.

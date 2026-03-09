-- Migration 027: Add reply_to_id to direct_messages
--
-- The messages table has reply_to_id (migration 001) but direct_messages
-- was created without it. The code sends reply_to_id on DM inserts,
-- causing PGRST204 ("column not found in schema cache").

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES direct_messages(id) ON DELETE SET NULL;

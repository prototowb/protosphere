-- 010_space_visibility.sql
-- Adds visibility, space_type, and sort_order columns to the servers (spaces) table.

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'public'
    CONSTRAINT valid_visibility CHECK (visibility IN ('public', 'private', 'restricted')),
  ADD COLUMN IF NOT EXISTS space_type  TEXT NOT NULL DEFAULT 'general'
    CONSTRAINT valid_space_type CHECK (space_type IN ('general', 'announcement', 'archive')),
  ADD COLUMN IF NOT EXISTS sort_order  INT NOT NULL DEFAULT 0;

-- public    : visible to all logged-in users; anyone can join via invite
-- private   : only visible to current members; joining by invite only
-- restricted: visible to all; joining requires approval or specific role

-- Update RLS policies to enforce private space visibility:
-- Members of a server can always see it.
-- Non-members can see public and restricted spaces (but not private).
DROP POLICY IF EXISTS "servers_select" ON servers;

CREATE POLICY "servers_select" ON servers
  FOR SELECT USING (
    -- Always visible to members
    EXISTS (
      SELECT 1 FROM members
      WHERE members.server_id = servers.id
        AND members.user_id = auth.uid()
    )
    OR
    -- Public and restricted visible to all authenticated users
    (visibility IN ('public', 'restricted') AND auth.uid() IS NOT NULL)
  );

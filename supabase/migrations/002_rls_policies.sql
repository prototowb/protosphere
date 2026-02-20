-- 002_rls_policies.sql
-- Row Level Security policies for protocode-chat
-- Run after 001_initial_schema.sql

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_read_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Helper: check if user is a member of a server with minimum role
-- =============================================================================
CREATE OR REPLACE FUNCTION is_server_member(p_server_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members WHERE server_id = p_server_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_member_role(p_server_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM members WHERE server_id = p_server_id AND user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_role_or_above(p_server_id UUID, p_user_id UUID, p_min_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE server_id = p_server_id
      AND user_id = p_user_id
      AND CASE p_min_role
        WHEN 'member' THEN role IN ('member', 'moderator', 'admin', 'owner')
        WHEN 'moderator' THEN role IN ('moderator', 'admin', 'owner')
        WHEN 'admin' THEN role IN ('admin', 'owner')
        WHEN 'owner' THEN role = 'owner'
        ELSE false
      END
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- profiles: anyone reads, own profile writable
-- =============================================================================
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- servers: members read, owner update/delete, anyone insert (becomes owner)
-- =============================================================================
CREATE POLICY "servers_select" ON servers
  FOR SELECT USING (
    is_public OR is_server_member(id, auth.uid())
  );

CREATE POLICY "servers_insert" ON servers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "servers_update" ON servers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = servers.id AND s.owner_id = auth.uid())
  );

CREATE POLICY "servers_delete" ON servers
  FOR DELETE USING (owner_id = auth.uid());

-- =============================================================================
-- channels: server members read, admin+ CRUD
-- =============================================================================
CREATE POLICY "channels_select" ON channels
  FOR SELECT USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "channels_insert" ON channels
  FOR INSERT WITH CHECK (has_role_or_above(server_id, auth.uid(), 'admin'));

CREATE POLICY "channels_update" ON channels
  FOR UPDATE USING (has_role_or_above(server_id, auth.uid(), 'admin'));

CREATE POLICY "channels_delete" ON channels
  FOR DELETE USING (has_role_or_above(server_id, auth.uid(), 'admin'));

-- =============================================================================
-- messages: server members read, non-banned members insert, author update,
--           author or mod+ delete
-- =============================================================================
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = messages.channel_id
        AND is_server_member(c.server_id, auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_id
        AND is_server_member(c.server_id, auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM channels c
      JOIN bans b ON b.server_id = c.server_id AND b.user_id = auth.uid()
      WHERE c.id = channel_id
    )
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = messages.channel_id
        AND has_role_or_above(c.server_id, auth.uid(), 'moderator')
    )
  );

-- =============================================================================
-- members: join via invite or public, leave voluntarily, admin+ manage
-- =============================================================================
CREATE POLICY "members_select" ON members
  FOR SELECT USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "members_insert" ON members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update" ON members
  FOR UPDATE USING (
    has_role_or_above(server_id, auth.uid(), 'admin')
    AND user_id != auth.uid()
  );

CREATE POLICY "members_delete" ON members
  FOR DELETE USING (
    auth.uid() = user_id
    OR has_role_or_above(server_id, auth.uid(), 'admin')
  );

-- =============================================================================
-- reactions: members add/remove own
-- =============================================================================
CREATE POLICY "reactions_select" ON reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE m.id = reactions.message_id
        AND is_server_member(c.server_id, auth.uid())
    )
  );

CREATE POLICY "reactions_insert" ON reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE m.id = message_id
        AND is_server_member(c.server_id, auth.uid())
    )
  );

CREATE POLICY "reactions_delete" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- channel_read_state: own read state only
-- =============================================================================
CREATE POLICY "channel_read_state_select" ON channel_read_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "channel_read_state_insert" ON channel_read_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "channel_read_state_update" ON channel_read_state
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- direct_message_groups: members only
-- =============================================================================
CREATE POLICY "dm_groups_select" ON direct_message_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM direct_message_members
      WHERE dm_group_id = direct_message_groups.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "dm_groups_insert" ON direct_message_groups
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- direct_message_members: group members read, own insert
-- =============================================================================
CREATE POLICY "dm_members_select" ON direct_message_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM direct_message_members existing
      WHERE existing.dm_group_id = direct_message_members.dm_group_id
        AND existing.user_id = auth.uid()
    )
  );

CREATE POLICY "dm_members_insert" ON direct_message_members
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- direct_messages: group members read/write
-- =============================================================================
CREATE POLICY "dm_messages_select" ON direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM direct_message_members
      WHERE dm_group_id = direct_messages.dm_group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "dm_messages_insert" ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM direct_message_members
      WHERE dm_group_id = direct_messages.dm_group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "dm_messages_update" ON direct_messages
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "dm_messages_delete" ON direct_messages
  FOR DELETE USING (auth.uid() = author_id);

-- =============================================================================
-- bans: members read, mod+ insert, admin+ delete
-- =============================================================================
CREATE POLICY "bans_select" ON bans
  FOR SELECT USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "bans_insert" ON bans
  FOR INSERT WITH CHECK (
    has_role_or_above(server_id, auth.uid(), 'moderator')
    AND auth.uid() = banned_by
  );

CREATE POLICY "bans_delete" ON bans
  FOR DELETE USING (has_role_or_above(server_id, auth.uid(), 'admin'));

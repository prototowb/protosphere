-- 005_fix_dm_members_rls.sql
-- Fix infinite recursion in dm_members_select policy by using a security definer function

CREATE OR REPLACE FUNCTION is_dm_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM direct_message_members
    WHERE dm_group_id = p_group_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "dm_members_select" ON direct_message_members;

CREATE POLICY "dm_members_select" ON direct_message_members
  FOR SELECT USING (is_dm_member(dm_group_id, auth.uid()));

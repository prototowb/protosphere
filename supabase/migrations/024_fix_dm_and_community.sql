-- Migration 024: Fix DM group RLS + community_settings singleton
--
-- Fix 1 (DM group 42501):
--   INSERT into direct_message_groups triggers RETURNING * which fails the
--   dm_groups_select policy because the user isn't in direct_message_members yet.
--   Solution: trigger that auto-adds auth.uid() as a member AFTER each group
--   INSERT, before RETURNING is evaluated.
--
-- Fix 2 (PGRST116 on community.get):
--   community_settings has no uniqueness constraint beyond the UUID PK, so
--   ON CONFLICT DO NOTHING in earlier migrations was a no-op. If a second row
--   exists, community.get() (.single()) fails with PGRST116.
--   Solution: partial unique index enforcing at most one row in the table.

-- ── Fix 1: DM group creator auto-join ─────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_join_dm_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO direct_message_members (dm_group_id, user_id)
  VALUES (NEW.id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dm_group_created ON direct_message_groups;

CREATE TRIGGER on_dm_group_created
  AFTER INSERT ON direct_message_groups
  FOR EACH ROW
  EXECUTE FUNCTION auto_join_dm_creator();

-- ── Fix 2: community_settings singleton constraint ─────────────────────────
-- A unique index on a constant expression allows only one row in the table.

CREATE UNIQUE INDEX IF NOT EXISTS community_settings_singleton_idx
  ON community_settings ((true));

-- If a duplicate row already exists, delete it (keep the most recent one).
DELETE FROM community_settings
WHERE id NOT IN (
  SELECT id FROM community_settings ORDER BY created_at DESC LIMIT 1
);

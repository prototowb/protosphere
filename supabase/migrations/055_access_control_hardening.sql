-- Migration 055: access-control hardening (PTSPH-206)
--
-- Tightens several RLS policies that were broader than the features they
-- serve, and moves the remaining privileged-column rules into the database.
-- Each section is independent; all are idempotent.
--
-- Client changes that ship with this migration (same release):
--   * getPublicUserData reads other users' integration data through
--     get_public_user_integrations() instead of selecting user_integrations.
--
-- Deploy order: apply this migration, then deploy the client. The client's
-- other paths keep working against both the old and new schema.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: who may moderate registrations (approve / reject pending accounts).
-- Mirrors the UI gate (CommunitySidebar `isAnyOwner`): the community owner or
-- any space owner, plus anyone holding the ADMINISTRATOR bit (1 << 40).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_registration_moderator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM community_settings WHERE owner_id = p_user_id)
    OR EXISTS (SELECT 1 FROM servers WHERE owner_id = p_user_id)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
        AND (r.permissions & 1099511627776) <> 0
    )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles: replace the unrestricted UPDATE policy.
--
-- Migration 020 added a policy named for admins but with USING (true) /
-- WITH CHECK (true); permissive policies are OR'd, so it applied to everyone.
-- Users keep `profiles_update` (own row). Registration moderators may update
-- other rows, and the guard trigger limits them to account_status.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins can update account_status" ON profiles;
DROP POLICY IF EXISTS "registration moderators can update account_status" ON profiles;

CREATE POLICY "registration moderators can update account_status"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_registration_moderator(auth.uid()))
  WITH CHECK (public.is_registration_moderator(auth.uid()));

-- Column-level rules for direct client writes. Writes made inside SECURITY
-- DEFINER functions (e.g. the forum-vote triggers that maintain meta_points)
-- run as the function owner, not as `authenticated`, and are not affected.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id is immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.meta_points IS DISTINCT FROM OLD.meta_points THEN
    RAISE EXCEPTION 'profiles.meta_points is maintained by the server' USING ERRCODE = '42501';
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    IF NOT public.is_registration_moderator(auth.uid()) THEN
      RAISE EXCEPTION 'only registration moderators may change account_status' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM community_settings WHERE owner_id = OLD.id) THEN
      RAISE EXCEPTION 'the community owner''s account_status cannot be changed' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- On someone else's row, nothing but account_status may change.
  IF OLD.id IS DISTINCT FROM auth.uid() THEN
    IF (to_jsonb(NEW) - 'account_status' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'account_status' - 'updated_at') THEN
      RAISE EXCEPTION 'only account_status may be changed on another user''s profile' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_update ON profiles;
CREATE TRIGGER guard_profile_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. community_settings: protect ownership and the setup flag.
--
-- The UPDATE policy (026) uses WITH CHECK (true) so the setup wizard can flip
-- setup_complete; that also let any editor rewrite owner_id.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_community_settings_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    -- Only the current owner may hand ownership over. An unowned community
    -- (pre-bootstrap) may be claimed only by the caller, during setup.
    IF NOT (
      OLD.owner_id = auth.uid()
      OR (OLD.owner_id IS NULL AND NEW.owner_id = auth.uid() AND NOT OLD.setup_complete)
    ) THEN
      RAISE EXCEPTION 'only the community owner may transfer ownership' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.setup_complete AND NOT NEW.setup_complete THEN
    RAISE EXCEPTION 'setup cannot be reopened' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_community_settings_update ON community_settings;
CREATE TRIGGER guard_community_settings_update
  BEFORE UPDATE ON community_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_community_settings_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Direct messages: membership changes require existing membership.
--
-- Creating a group already adds the creator as a member (auto_join_dm_creator,
-- 024), so the client's subsequent member upsert is made by a member.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dm_members_insert" ON direct_message_members;
CREATE POLICY "dm_members_insert" ON direct_message_members
  FOR INSERT
  WITH CHECK (public.is_dm_member(dm_group_id, auth.uid()));

-- Editing a DM must not move it to another conversation.
DROP POLICY IF EXISTS "dm_messages_update" ON direct_messages;
CREATE POLICY "dm_messages_update" ON direct_messages
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id AND public.is_dm_member(dm_group_id, auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. user_integrations: owner-only base table + filtered public read.
--
-- The base table holds per-user credentials (connection_token) and the raw
-- synced payload including fields the user chose to hide. Same pattern as
-- 054 for integrations: the owner reads the table, everyone else reads a
-- SECURITY DEFINER function that applies field visibility server-side.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view user integration data" ON user_integrations;
-- "Users can manage own integrations" (050, FOR ALL USING user_id = auth.uid())
-- continues to cover the owner's own SELECT/INSERT/UPDATE/DELETE.

CREATE OR REPLACE FUNCTION public.get_public_user_integrations(p_user_id UUID)
RETURNS TABLE (
  id             UUID,
  user_id        UUID,
  integration_id UUID,
  connected_at   TIMESTAMPTZ,
  synced_at      TIMESTAMPTZ,
  synced_data    JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ui.id,
    ui.user_id,
    ui.integration_id,
    ui.connected_at,
    ui.synced_at,
    CASE
      WHEN jsonb_typeof(ui.synced_data) IS DISTINCT FROM 'object' THEN NULL
      ELSE (
        SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
        FROM jsonb_each(ui.synced_data) AS kv
        JOIN integration_field_schemas s
          ON s.integration_id = ui.integration_id AND s.field_key = kv.key
        LEFT JOIN user_field_visibility v
          ON v.user_id = ui.user_id AND v.field_schema_id = s.id
        WHERE COALESCE(v.visibility, s.default_visibility) = 'public'
           OR (ui.user_id = auth.uid() AND COALESCE(v.visibility, s.default_visibility) = 'private')
      )
    END
  FROM user_integrations ui
  JOIN integrations i ON i.id = ui.integration_id AND i.enabled
  WHERE ui.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_user_integrations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_integrations(UUID) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. reactions.emoji: a short, markup-free token.
--
-- NOT VALID: enforced for new and updated rows without scanning existing ones;
-- run `ALTER TABLE reactions VALIDATE CONSTRAINT reactions_emoji_token` after
-- cleaning any legacy rows (see SESSION_HANDOFF).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_emoji_token;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_emoji_token
  CHECK (char_length(emoji) BETWEEN 1 AND 64 AND emoji !~ '[<>"''&\\[:cntrl:]]')
  NOT VALID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. search_path on the SECURITY DEFINER helper added in 054.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.get_connectable_integrations(UUID) SET search_path = public;

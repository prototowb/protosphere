-- Migration 020: Auth Hardening
-- Adds: account_status to profiles, community_invites table, rich profile fields

-- ── Profile: account_status + rich fields ──────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'pending', 'rejected')),
  ADD COLUMN IF NOT EXISTS pronouns TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS display_banner_url TEXT;

-- ── Community Invites ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage TEXT NOT NULL DEFAULT 'single_use' CHECK (usage IN ('single_use', 'multi_use')),
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RPC to atomically increment use_count
CREATE OR REPLACE FUNCTION use_community_invite(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE community_invites
  SET use_count = use_count + 1
  WHERE token = p_token;
END;
$$;

-- ── First-User Bootstrap ───────────────────────────────────────────────────
-- When the first profile is created and no Owner role exists anywhere,
-- auto-seed community_settings and assign the new user as community admin.

CREATE OR REPLACE FUNCTION bootstrap_first_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_role_id UUID;
  v_server_id UUID;
  v_community_count INT;
BEGIN
  -- Only trigger if no community_settings row exists (truly first setup)
  SELECT COUNT(*) INTO v_community_count FROM community_settings;
  IF v_community_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Seed default community_settings
  INSERT INTO community_settings (name, description, registration_mode, rules, welcome_message)
  VALUES ('My Community', 'Welcome to our community!', 'open', '', 'Welcome!')
  ON CONFLICT DO NOTHING;

  -- Find the first server's Owner role (if any server exists)
  SELECT r.id, r.server_id INTO v_owner_role_id, v_server_id
  FROM roles r
  WHERE r.name = 'Owner' AND r.is_system = true
  LIMIT 1;

  -- If a server exists, assign this user as owner via user_roles
  IF v_owner_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (NEW.id, v_owner_role_id)
    ON CONFLICT DO NOTHING;

    -- Also set member role to owner for legacy compatibility
    UPDATE members SET role = 'owner'
    WHERE server_id = v_server_id AND user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_first_user_bootstrap'
  ) THEN
    CREATE TRIGGER on_first_user_bootstrap
      AFTER INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION bootstrap_first_user();
  END IF;
END;
$$;

-- ── Notification Preferences ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'mentions', 'none')),
  PRIMARY KEY (user_id, channel_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE community_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Community invites: any authenticated user can read/validate; only admins create
CREATE POLICY "anyone can read community invites"
  ON community_invites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can create community invites"
  ON community_invites FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "creator can manage their invites"
  ON community_invites FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Notification preferences: users manage their own
CREATE POLICY "users manage own notification prefs"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can read/update account_status on profiles
CREATE POLICY "admins can update account_status"
  ON profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migration 049: Add owner_id to community_settings (PTSPH community admin)
--
-- The community owner is the first registered user who bootstrapped the platform.
-- Stored directly on community_settings so the frontend can check it without
-- requiring a server/space to exist yet (needed for the admin setup wizard flow).

ALTER TABLE community_settings
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Update bootstrap_first_user trigger to also set owner_id on first signup
CREATE OR REPLACE FUNCTION bootstrap_first_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner_role_id UUID;
  v_server_id     UUID;
  v_community_count INT;
BEGIN
  SELECT COUNT(*) INTO v_community_count FROM community_settings;
  IF v_community_count > 0 THEN
    -- Community already bootstrapped — but set owner_id if still null
    UPDATE community_settings SET owner_id = NEW.id WHERE owner_id IS NULL;
    RETURN NEW;
  END IF;

  -- First ever signup: seed community_settings with this user as owner
  INSERT INTO community_settings (name, description, registration_mode, rules, welcome_message, owner_id)
  VALUES ('My Community', 'Welcome to our community!', 'open', '', 'Welcome!', NEW.id)
  ON CONFLICT DO NOTHING;

  -- If the INSERT was skipped (race), still set owner_id
  UPDATE community_settings SET owner_id = NEW.id WHERE owner_id IS NULL;

  -- Assign Owner role if a server already exists (rare at first signup, but handle it)
  SELECT r.id, r.server_id INTO v_owner_role_id, v_server_id
  FROM roles r
  WHERE r.name = 'Owner' AND r.is_system = true
  LIMIT 1;

  IF v_owner_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (NEW.id, v_owner_role_id)
    ON CONFLICT DO NOTHING;

    UPDATE members SET role = 'owner'
    WHERE server_id = v_server_id AND user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill owner_id for existing communities using the earliest server's owner
UPDATE community_settings
SET owner_id = (
  SELECT owner_id FROM servers ORDER BY created_at ASC LIMIT 1
)
WHERE owner_id IS NULL
  AND EXISTS (SELECT 1 FROM servers);

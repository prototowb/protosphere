-- 009_community_settings.sql
-- Single-row community identity table for the platform-wide settings.

CREATE TABLE community_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL DEFAULT 'My Community'
                      CONSTRAINT community_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  description       TEXT NOT NULL DEFAULT ''
                      CONSTRAINT community_desc_length CHECK (char_length(description) <= 2000),
  logo_url          TEXT,
  banner_url        TEXT,
  registration_mode TEXT NOT NULL DEFAULT 'open'
                      CONSTRAINT valid_registration CHECK (registration_mode IN ('open', 'approval', 'invite_only', 'closed')),
  rules             TEXT NOT NULL DEFAULT ''
                      CONSTRAINT rules_length CHECK (char_length(rules) <= 10000),
  welcome_message   TEXT NOT NULL DEFAULT ''
                      CONSTRAINT welcome_length CHECK (char_length(welcome_message) <= 2000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure exactly one community settings row always exists
INSERT INTO community_settings (name) VALUES ('My Community') ON CONFLICT DO NOTHING;

-- RLS: any authenticated user can read; only admins (MANAGE_SPACE) can update
ALTER TABLE community_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_settings_select" ON community_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "community_settings_update" ON community_settings
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND (
          (r.permissions & 1099511627776) <> 0  -- ADMINISTRATOR
          OR (r.permissions & 1) <> 0            -- MANAGE_SPACE
        )
    )
  );

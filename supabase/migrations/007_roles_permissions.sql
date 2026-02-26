-- 007_roles_permissions.sql
-- Flexible role and permission system replacing the hardcoded owner/admin/moderator/member hierarchy.
-- Permission values are stored as BIGINT matching the bitfield in src/lib/permissions.ts.

-- =============================================================================
-- roles
-- =============================================================================
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL
                CONSTRAINT role_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
  color       TEXT,                     -- hex colour, e.g. '#5865F2'
  icon        TEXT,                     -- emoji or icon identifier
  position    INT NOT NULL DEFAULT 0,   -- lower value = higher priority in the hierarchy
  permissions BIGINT NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,  -- auto-assigned to new members on join
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- managed by system; cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, name)
);

CREATE INDEX idx_roles_server ON roles (server_id, position);

-- =============================================================================
-- user_roles  (many-to-many: profiles ↔ roles)
-- =============================================================================
CREATE TABLE user_roles (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_role ON user_roles (role_id);

-- =============================================================================
-- channel_role_overrides  (per-channel permission tweaks)
-- =============================================================================
CREATE TABLE channel_role_overrides (
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  allow       BIGINT NOT NULL DEFAULT 0,
  deny        BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, role_id)
);

-- =============================================================================
-- Data migration: seed system roles from existing members.role values
-- Permission bit values match src/lib/permissions.ts:
--   ADMINISTRATOR  = 1 << 40 = 1099511627776
--   ADMIN preset   = 13140690703  (all non-admin bits OR'd together)
--   MODERATOR preset = 4563714056 (view_audit + view_channel + messaging subset + kick + mute)
--   MEMBER preset  = 4297523200   (view_channel + send + attach + embed + reactions + change_nick)
-- =============================================================================
DO $$
DECLARE
  srv            RECORD;
  owner_role_id  UUID;
  admin_role_id  UUID;
  mod_role_id    UUID;
  member_role_id UUID;
  -- Permission presets (decimal representations of the bigint bitfields)
  perm_admin     BIGINT := 1 | 2 | 4 | 8 | 256 | 512 | 1024 | 65536 | 131072 | 262144 | 524288 | 1048576 | 2097152 | 16777216 | 33554432 | 67108864 | 134217728 | 4294967296 | 8589934592;
  perm_mod       BIGINT := 8 | 256 | 65536 | 131072 | 262144 | 1048576 | 2097152 | 16777216 | 67108864 | 4294967296;
  perm_member    BIGINT := 256 | 65536 | 131072 | 262144 | 2097152 | 4294967296;
BEGIN
  FOR srv IN SELECT id FROM servers LOOP
    -- Insert system roles for this server (skip if already seeded)
    INSERT INTO roles (server_id, name, color, position, permissions, is_default, is_system)
    VALUES
      (srv.id, 'Owner',     '#f97316', 0,  1099511627776, false, true),
      (srv.id, 'Admin',     '#3b82f6', 10, perm_admin,    false, true),
      (srv.id, 'Moderator', '#a855f7', 20, perm_mod,      false, true),
      (srv.id, 'Member',    NULL,      30, perm_member,   true,  true)
    ON CONFLICT (server_id, name) DO NOTHING;

    SELECT id INTO owner_role_id  FROM roles WHERE server_id = srv.id AND name = 'Owner';
    SELECT id INTO admin_role_id  FROM roles WHERE server_id = srv.id AND name = 'Admin';
    SELECT id INTO mod_role_id    FROM roles WHERE server_id = srv.id AND name = 'Moderator';
    SELECT id INTO member_role_id FROM roles WHERE server_id = srv.id AND name = 'Member';

    -- Populate user_roles from the existing members.role column
    INSERT INTO user_roles (user_id, role_id)
    SELECT
      m.user_id,
      CASE m.role
        WHEN 'owner'     THEN owner_role_id
        WHEN 'admin'     THEN admin_role_id
        WHEN 'moderator' THEN mod_role_id
        ELSE                  member_role_id
      END
    FROM members m
    WHERE m.server_id = srv.id
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

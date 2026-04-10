-- Migration 048: Fix roles RLS bootstrapping + seed missing system roles
--
-- Problem: roles_insert/update/delete policies only check user_has_permission(),
-- which requires a role already assigned via user_roles. This creates a
-- chicken-and-egg problem: when a new server is created, the owner can't
-- seed the initial system roles because they have no roles yet.
--
-- Fix: Also allow the server owner (servers.owner_id = auth.uid()) to manage
-- roles for their own server, bypassing the permission check.
--
-- Also seeds system roles for any existing servers that somehow have none.

-- =============================================================================
-- Drop and recreate role policies with owner bypass
-- =============================================================================

DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
DROP POLICY IF EXISTS "roles_delete" ON roles;

-- Server owners OR users with MANAGE_ROLES can insert roles
CREATE POLICY "roles_insert" ON roles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM servers WHERE id = server_id AND owner_id = auth.uid())
    OR user_has_permission(server_id, auth.uid(), 2)
  );

-- Server owners OR users with MANAGE_ROLES can update non-system roles
-- Owners can also update system roles (to change color/position)
CREATE POLICY "roles_update" ON roles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM servers WHERE id = server_id AND owner_id = auth.uid())
    OR (user_has_permission(server_id, auth.uid(), 2) AND is_system = false)
  );

-- Server owners OR users with MANAGE_ROLES can delete non-system roles
CREATE POLICY "roles_delete" ON roles
  FOR DELETE USING (
    (
      EXISTS (SELECT 1 FROM servers WHERE id = server_id AND owner_id = auth.uid())
      OR user_has_permission(server_id, auth.uid(), 2)
    )
    AND is_system = false
  );

-- Also allow owners to manage user_roles (needed for assigning Owner role during seeding)
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = user_roles.role_id
        AND (
          EXISTS (SELECT 1 FROM servers WHERE id = r.server_id AND owner_id = auth.uid())
          OR user_has_permission(r.server_id, auth.uid(), 2)
        )
    )
  );

CREATE POLICY "user_roles_delete" ON user_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = user_roles.role_id
        AND (
          EXISTS (SELECT 1 FROM servers WHERE id = r.server_id AND owner_id = auth.uid())
          OR user_has_permission(r.server_id, auth.uid(), 2)
        )
    )
  );

-- =============================================================================
-- Seed system roles for any servers that are missing them
-- =============================================================================
DO $$
DECLARE
  srv            RECORD;
  owner_role_id  UUID;
  -- Permission presets (decimal representations of the bigint bitfields)
  perm_admin     BIGINT := 1 | 2 | 4 | 8 | 256 | 512 | 1024 | 65536 | 131072 | 262144 | 524288 | 1048576 | 2097152 | 16777216 | 33554432 | 67108864 | 134217728 | 4294967296 | 8589934592;
  perm_mod       BIGINT := 8 | 256 | 65536 | 131072 | 262144 | 1048576 | 2097152 | 16777216 | 67108864 | 4294967296;
  perm_member    BIGINT := 256 | 65536 | 131072 | 262144 | 2097152 | 4294967296;
  perm_owner     BIGINT := 1099511627776;  -- ADMINISTRATOR (1 << 40)
BEGIN
  FOR srv IN SELECT id, owner_id FROM servers LOOP

    -- Insert system roles if they don't exist
    INSERT INTO roles (server_id, name, color, position, permissions, is_default, is_system)
    VALUES
      (srv.id, 'Owner',     '#f97316', 0,  perm_owner,  false, true),
      (srv.id, 'Admin',     '#3b82f6', 10, perm_admin,  false, true),
      (srv.id, 'Moderator', '#a855f7', 20, perm_mod,    false, true),
      (srv.id, 'Member',    NULL,      30, perm_member, true,  true)
    ON CONFLICT (server_id, name) DO NOTHING;

    -- Assign Owner role to the server owner if not yet assigned
    SELECT id INTO owner_role_id FROM roles
    WHERE server_id = srv.id AND name = 'Owner';

    IF owner_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
      VALUES (srv.owner_id, owner_role_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Assign Member role to all members who have no custom role assigned yet
    INSERT INTO user_roles (user_id, role_id)
    SELECT m.user_id,
           (SELECT id FROM roles WHERE server_id = srv.id AND name = 'Member')
    FROM members m
    WHERE m.server_id = srv.id
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = m.user_id AND r.server_id = srv.id
      )
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;

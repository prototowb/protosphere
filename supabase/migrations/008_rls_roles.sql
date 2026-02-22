-- 008_rls_roles.sql
-- Row Level Security policies for the roles, user_roles, and channel_role_overrides tables.
-- Also adds a user_has_permission() helper function for policy reuse.

-- =============================================================================
-- Helper: check if a user has a specific permission bit in a server
-- =============================================================================
CREATE OR REPLACE FUNCTION user_has_permission(
  p_server_id   UUID,
  p_user_id     UUID,
  p_permission  BIGINT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND r.server_id = p_server_id
      AND (
        -- ADMINISTRATOR bit (1 << 40 = 1099511627776) bypasses all checks
        (r.permissions & 1099511627776) <> 0
        OR
        (r.permissions & p_permission) <> 0
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- Enable RLS on new tables
-- =============================================================================
ALTER TABLE roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_role_overrides ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- roles policies
-- =============================================================================

-- All members of a server can read its roles
CREATE POLICY "roles_select" ON roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.server_id = roles.server_id
        AND members.user_id = auth.uid()
    )
  );

-- Only users with MANAGE_ROLES (bit 2) can insert/update/delete non-system roles
CREATE POLICY "roles_insert" ON roles
  FOR INSERT WITH CHECK (
    user_has_permission(server_id, auth.uid(), 2)
  );

CREATE POLICY "roles_update" ON roles
  FOR UPDATE USING (
    user_has_permission(server_id, auth.uid(), 2)
    AND is_system = false
  );

CREATE POLICY "roles_delete" ON roles
  FOR DELETE USING (
    user_has_permission(server_id, auth.uid(), 2)
    AND is_system = false
  );

-- =============================================================================
-- user_roles policies
-- =============================================================================

-- Members can read user_roles for their server
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN members m ON m.server_id = r.server_id AND m.user_id = auth.uid()
      WHERE r.id = user_roles.role_id
    )
  );

-- Only users with MANAGE_ROLES can assign/remove roles
CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = user_roles.role_id
        AND user_has_permission(r.server_id, auth.uid(), 2)
    )
  );

CREATE POLICY "user_roles_delete" ON user_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = user_roles.role_id
        AND user_has_permission(r.server_id, auth.uid(), 2)
    )
  );

-- =============================================================================
-- channel_role_overrides policies
-- =============================================================================

-- Members can read overrides for channels in their servers
CREATE POLICY "channel_overrides_select" ON channel_role_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN members m ON m.server_id = c.server_id AND m.user_id = auth.uid()
      WHERE c.id = channel_role_overrides.channel_id
    )
  );

-- Only users with MANAGE_CHANNELS (bit 512) can manage overrides
CREATE POLICY "channel_overrides_insert" ON channel_role_overrides
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_role_overrides.channel_id
        AND user_has_permission(c.server_id, auth.uid(), 512)
    )
  );

CREATE POLICY "channel_overrides_update" ON channel_role_overrides
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_role_overrides.channel_id
        AND user_has_permission(c.server_id, auth.uid(), 512)
    )
  );

CREATE POLICY "channel_overrides_delete" ON channel_role_overrides
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_role_overrides.channel_id
        AND user_has_permission(c.server_id, auth.uid(), 512)
    )
  );

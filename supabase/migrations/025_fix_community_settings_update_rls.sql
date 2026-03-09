-- Migration 025: Fix community_settings UPDATE policy for setup wizard
--
-- Root cause: bootstrap_first_user() only assigns an Owner role if a server
-- already exists. On a fresh deployment the first user has NO roles, so the
-- community_settings_update policy (which requires MANAGE_SPACE / ADMINISTRATOR)
-- rejects the PATCH issued by the setup wizard, returning 406 Not Acceptable.
--
-- Fix: allow any authenticated user to update community_settings while
-- setup_complete = false (the wizard window). Once the wizard sets it to true,
-- the existing role-based guard takes over.

DROP POLICY IF EXISTS "community_settings_update" ON community_settings;

CREATE POLICY "community_settings_update" ON community_settings
  FOR UPDATE TO authenticated USING (
    -- During initial setup wizard, any authenticated user may complete setup
    NOT setup_complete
    OR
    -- After setup, require MANAGE_SPACE (bit 1) or ADMINISTRATOR (bit 1<<40)
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

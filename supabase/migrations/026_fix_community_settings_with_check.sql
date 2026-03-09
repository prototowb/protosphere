-- Migration 026: Fix community_settings UPDATE policy WITH CHECK
--
-- Migration 025 fixed the USING clause but not WITH CHECK.
-- When WITH CHECK is omitted it defaults to the USING expression.
-- The wizard sets setup_complete = true, so after the update the
-- WITH CHECK re-evaluates NOT setup_complete → false, raising 42501 → 403.
--
-- Fix: keep USING as the gate (who can initiate the update),
-- and set WITH CHECK (true) so any resulting value is allowed.

DROP POLICY IF EXISTS "community_settings_update" ON community_settings;

CREATE POLICY "community_settings_update" ON community_settings
  FOR UPDATE TO authenticated
  USING (
    -- During setup wizard any authenticated user may update
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
  )
  WITH CHECK (true);

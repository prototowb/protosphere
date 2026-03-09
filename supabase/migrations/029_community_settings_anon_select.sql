-- Migration 029: Allow anon role to read community_settings
--
-- The landing page loads community name/branding for unauthenticated visitors.
-- The previous SELECT policy was TO authenticated only, so anon users got
-- 0 rows → PGRST116 → 406 Not Acceptable.

DROP POLICY IF EXISTS "community_settings_select" ON community_settings;

CREATE POLICY "community_settings_select" ON community_settings
  FOR SELECT TO anon, authenticated USING (true);

-- 014_rls_moderation.sql
-- Tightens RLS on moderation tables using the existing user_has_permission() function.
-- Replaces the open policies added in 011–013 with permission-gated ones.

-- ── Audit Log ─────────────────────────────────────────────────────────────────
-- Members who can VIEW_AUDIT_LOG (bit 3 = value 8) may read the log for a server.
-- Only service-role (backend) should insert — frontend inserts are handled by calling
-- the backend namespace which validates on the server side.

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (
    server_id IS NULL  -- community-level entries visible to any authenticated user
    OR user_has_permission(server_id, auth.uid(), 8)  -- VIEW_AUDIT_LOG
  );

-- Insertions come from the backend (service-role) or the actor themselves
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- ── Reports ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reports_insert" ON reports;
DROP POLICY IF EXISTS "reports_select_own" ON reports;
DROP POLICY IF EXISTS "reports_select_mod" ON reports;
DROP POLICY IF EXISTS "reports_update" ON reports;

-- Anyone can file a report
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Reporters can see their own reports
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Moderators (MANAGE_MESSAGES = bit 20 = 1048576) can see all reports in their server
CREATE POLICY "reports_select_mod" ON reports
  FOR SELECT USING (
    server_id IS NULL
    OR user_has_permission(server_id, auth.uid(), 1048576)
  );

-- Moderators can update report status/resolution
CREATE POLICY "reports_update" ON reports
  FOR UPDATE USING (
    server_id IS NULL
    OR user_has_permission(server_id, auth.uid(), 1048576)
  );

-- ── Mutes ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mutes_select" ON mutes;
DROP POLICY IF EXISTS "mutes_insert" ON mutes;
DROP POLICY IF EXISTS "mutes_delete" ON mutes;

-- Server members can see who is muted (helps UI show muted state)
CREATE POLICY "mutes_select" ON mutes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.server_id = mutes.server_id
        AND members.user_id = auth.uid()
    )
  );

-- MUTE_MEMBERS = bit 26 = 67108864
CREATE POLICY "mutes_insert" ON mutes
  FOR INSERT WITH CHECK (
    user_has_permission(server_id, auth.uid(), 67108864)
  );

CREATE POLICY "mutes_delete" ON mutes
  FOR DELETE USING (
    user_has_permission(server_id, auth.uid(), 67108864)
  );

-- ── Auto-moderation Rules ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "automod_rules_select" ON automod_rules;
DROP POLICY IF EXISTS "automod_rules_insert" ON automod_rules;
DROP POLICY IF EXISTS "automod_rules_update" ON automod_rules;
DROP POLICY IF EXISTS "automod_rules_delete" ON automod_rules;

-- MANAGE_MESSAGES (bit 20 = 1048576) can view automod rules
CREATE POLICY "automod_rules_select" ON automod_rules
  FOR SELECT USING (
    user_has_permission(server_id, auth.uid(), 1048576)
  );

CREATE POLICY "automod_rules_insert" ON automod_rules
  FOR INSERT WITH CHECK (
    user_has_permission(server_id, auth.uid(), 1048576)
  );

CREATE POLICY "automod_rules_update" ON automod_rules
  FOR UPDATE USING (
    user_has_permission(server_id, auth.uid(), 1048576)
  );

CREATE POLICY "automod_rules_delete" ON automod_rules
  FOR DELETE USING (
    user_has_permission(server_id, auth.uid(), 1048576)
  );

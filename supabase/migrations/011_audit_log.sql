-- 011_audit_log.sql - Audit logging for moderation actions

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID REFERENCES servers(id) ON DELETE SET NULL,
  actor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_server_id ON audit_log(server_id);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone can view audit log, but only if they have VIEW_AUDIT_LOG permission
-- (will be enforced by RLS function in 014_rls_moderation.sql)
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (true);

-- Only authenticated users can insert (will validate via RLS function)
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

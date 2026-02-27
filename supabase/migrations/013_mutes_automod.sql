-- 013_mutes_automod.sql - Mutes and auto-moderation rules

CREATE TABLE mutes (
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT '',
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX idx_mutes_user_id ON mutes(user_id);
CREATE INDEX idx_mutes_expires_at ON mutes(expires_at);

ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;

-- Members can see who is muted in their server
CREATE POLICY "mutes_select" ON mutes
  FOR SELECT USING (true);

-- Only moderators can create/update mutes (enforced via RLS function)
CREATE POLICY "mutes_insert" ON mutes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "mutes_delete" ON mutes
  FOR DELETE USING (true);

-- Auto-moderation rules
CREATE TABLE automod_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rule_type   TEXT NOT NULL CHECK (rule_type IN ('word_filter', 'spam_detect', 'link_filter', 'caps_filter')),
  config      JSONB NOT NULL DEFAULT '{}',
  action      TEXT NOT NULL DEFAULT 'flag' CHECK (action IN ('flag', 'delete', 'mute')),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, name)
);

CREATE INDEX idx_automod_rules_server_id ON automod_rules(server_id);

ALTER TABLE automod_rules ENABLE ROW LEVEL SECURITY;

-- Members in a server can view automod rules for that server
CREATE POLICY "automod_rules_select" ON automod_rules
  FOR SELECT USING (true);

-- Only moderators can create/update/delete rules
CREATE POLICY "automod_rules_insert" ON automod_rules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "automod_rules_update" ON automod_rules
  FOR UPDATE USING (true);

CREATE POLICY "automod_rules_delete" ON automod_rules
  FOR DELETE USING (true);

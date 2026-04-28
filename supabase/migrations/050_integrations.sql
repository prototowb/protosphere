-- Migration 050: Generic integrations framework
-- Allows admins to register external apps, users to link accounts,
-- and space admins to mandate integration fields per space.

-- ── Admin-registered integrations ───────────────────────────────

CREATE TABLE integrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT NOT NULL DEFAULT '',
  icon_url            TEXT,
  api_base_url        TEXT NOT NULL,
  auth_mode           TEXT NOT NULL CHECK (auth_mode IN ('same_domain_cookie', 'oauth_redirect', 'token_exchange')),
  data_endpoint       TEXT NOT NULL DEFAULT '',
  default_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Field schema: what fields an integration exposes ────────────

CREATE TABLE integration_field_schemas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id     UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  field_key          TEXT NOT NULL,
  label              TEXT NOT NULL,
  field_type         TEXT NOT NULL CHECK (field_type IN ('number', 'text', 'badge', 'list', 'activity_feed', 'progress_bar')),
  default_visibility TEXT NOT NULL DEFAULT 'public' CHECK (default_visibility IN ('public', 'private', 'hidden')),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id, field_key)
);

-- ── User-connected integrations with cached data ────────────────

CREATE TABLE user_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id    UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  external_user_id  TEXT,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_data       JSONB,
  synced_at         TIMESTAMPTZ,
  connection_token  TEXT,
  UNIQUE (user_id, integration_id)
);

-- ── Per-field visibility overrides by users ─────────────────────

CREATE TABLE user_field_visibility (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  field_schema_id UUID NOT NULL REFERENCES integration_field_schemas(id) ON DELETE CASCADE,
  visibility      TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'hidden')),
  PRIMARY KEY (user_id, field_schema_id)
);

-- ── Space-level field requirements ──────────────────────────────

CREATE TABLE space_integration_requirements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id      UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  field_key      TEXT NOT NULL,
  required       BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, integration_id, field_key)
);

-- ── Indexes ─────────────────────────────────────────────────────

CREATE INDEX idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_integration ON user_integrations(integration_id);
CREATE INDEX idx_user_field_visibility_user ON user_field_visibility(user_id);
CREATE INDEX idx_space_integration_reqs_server ON space_integration_requirements(server_id);
CREATE INDEX idx_integration_field_schemas_integration ON integration_field_schemas(integration_id);

-- ── Row-Level Security ──────────────────────────────────────────

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_field_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_integration_requirements ENABLE ROW LEVEL SECURITY;

-- Integrations: anyone can read enabled, community owner/admin manages all
CREATE POLICY "Anyone can view enabled integrations"
  ON integrations FOR SELECT USING (enabled = true);

CREATE POLICY "Community owner can manage integrations"
  ON integrations FOR ALL USING (
    EXISTS (SELECT 1 FROM community_settings WHERE owner_id = auth.uid())
  );

-- Field schemas: anyone can read, community owner manages
CREATE POLICY "Anyone can view field schemas"
  ON integration_field_schemas FOR SELECT USING (true);

CREATE POLICY "Community owner can manage field schemas"
  ON integration_field_schemas FOR ALL USING (
    EXISTS (SELECT 1 FROM community_settings WHERE owner_id = auth.uid())
  );

-- User integrations: user owns their own rows, anyone can read for profile display
CREATE POLICY "Users manage own integrations"
  ON user_integrations FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Anyone can view user integration data"
  ON user_integrations FOR SELECT USING (true);

-- User field visibility: user owns, anyone can read (needed for profile display)
CREATE POLICY "Users manage own visibility"
  ON user_field_visibility FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Anyone can read visibility settings"
  ON user_field_visibility FOR SELECT USING (true);

-- Space requirements: space owner or community owner manages, anyone reads
CREATE POLICY "Anyone can view space requirements"
  ON space_integration_requirements FOR SELECT USING (true);

CREATE POLICY "Space or community owner can manage requirements"
  ON space_integration_requirements FOR ALL USING (
    EXISTS (
      SELECT 1 FROM servers s WHERE s.id = server_id AND s.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM community_settings WHERE owner_id = auth.uid()
    )
  );

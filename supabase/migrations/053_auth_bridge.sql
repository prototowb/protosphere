-- Migration 053: Auth bridge
-- Adds signing_key for HMAC-SHA256 JWT verification, renames oauth_redirect → auth_bridge,
-- and indexes user_integrations for fast bridge login lookups.

-- 1. Add signing_key column (nullable — only needed for auth_bridge integrations)
ALTER TABLE integrations ADD COLUMN signing_key TEXT;

-- 2. Rename auth_mode enum value: drop old CHECK, add new one
ALTER TABLE integrations DROP CONSTRAINT integrations_auth_mode_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_auth_mode_check
  CHECK (auth_mode IN ('same_domain_cookie', 'auth_bridge', 'token_exchange'));

-- 3. Migrate any existing oauth_redirect rows
UPDATE integrations SET auth_mode = 'auth_bridge' WHERE auth_mode = 'oauth_redirect';

-- 4. Partial index for bridge login: look up user by (integration_id, external_user_id)
CREATE INDEX idx_user_integrations_bridge_lookup
  ON user_integrations(integration_id, external_user_id)
  WHERE external_user_id IS NOT NULL;

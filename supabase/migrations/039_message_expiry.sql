-- Migration 039: Message expiry / retention
--
-- Adds expires_at to messages and direct_messages.
-- New messages default to 3 days (channel messages) or 6 months (DMs).
-- Existing rows get NULL (never expire) to avoid retroactive deletion.
--
-- cleanup_expired_messages() is called nightly by a GitHub Actions workflow
-- (see .github/workflows/cleanup.yml). It runs as SECURITY DEFINER with
-- row_security = off so it can delete across all rows regardless of RLS.
-- The function is GRANTED to service_role only — never to anon/authenticated.

-- ── messages ─────────────────────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '3 days';

-- Existing rows should not expire retroactively
UPDATE messages SET expires_at = NULL WHERE expires_at IS NOT NULL;

-- Set default only for future inserts
ALTER TABLE messages
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '3 days';

-- Index to make the nightly DELETE fast
CREATE INDEX IF NOT EXISTS idx_messages_expires_at
  ON messages (expires_at)
  WHERE expires_at IS NOT NULL;

-- ── direct_messages ───────────────────────────────────────────────────────────

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 months';

UPDATE direct_messages SET expires_at = NULL WHERE expires_at IS NOT NULL;

ALTER TABLE direct_messages
  ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '6 months';

CREATE INDEX IF NOT EXISTS idx_direct_messages_expires_at
  ON direct_messages (expires_at)
  WHERE expires_at IS NOT NULL;

-- ── cleanup function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_messages_deleted  INT;
  v_dm_deleted        INT;
BEGIN
  DELETE FROM messages
  WHERE expires_at IS NOT NULL AND expires_at <= NOW();
  GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;

  DELETE FROM direct_messages
  WHERE expires_at IS NOT NULL AND expires_at <= NOW();
  GET DIAGNOSTICS v_dm_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'messages_deleted', v_messages_deleted,
    'dm_messages_deleted', v_dm_deleted,
    'ran_at', NOW()
  );
END;
$$;

-- Only service_role may call this — revoke from public and authenticated
REVOKE ALL ON FUNCTION cleanup_expired_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO service_role;

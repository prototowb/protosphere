-- Migration 054: Lock down secret columns on integrations
--
-- Migration 050's "Anyone can view enabled integrations" policy is row-level
-- only (`USING (enabled = true)`), so every column was client-readable,
-- including signing_key (migration 053, HMAC secret for verifying inbound
-- auth-bridge JWTs) and api_key. In practice this meant any authenticated
-- client could read signing_key directly via
-- `supabase.from('integrations').select('*')` — exactly the query
-- syncData's join already performs. protocode-learn's signing_key has been
-- non-null (and therefore exposed) since it was generated via the admin UI,
-- even though auth_bridge was never activated for it.
--
-- Fix: drop the broad SELECT policy so the base table is owner-managed only
-- (the existing "Community owner can manage integrations" ALL policy
-- already covers admin reads/writes). Member-facing reads of enabled
-- integrations go through a SECURITY DEFINER function that only returns
-- non-secret columns — same pattern used elsewhere in this project for
-- controlled RLS bypass (see handle_new_user's `SET row_security = off`).

DROP POLICY "Anyone can view enabled integrations" ON integrations;

CREATE OR REPLACE FUNCTION public.get_connectable_integrations(p_id UUID DEFAULT NULL)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  slug                TEXT,
  description         TEXT,
  icon_url            TEXT,
  api_base_url        TEXT,
  api_key             TEXT,
  app_url             TEXT,
  auth_mode           TEXT,
  data_endpoint       TEXT,
  default_ttl_seconds INTEGER,
  enabled             BOOLEAN,
  created_by          UUID,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT
    i.id, i.name, i.slug, i.description, i.icon_url, i.api_base_url,
    i.api_key, i.app_url, i.auth_mode, i.data_endpoint,
    i.default_ttl_seconds, i.enabled, i.created_by, i.created_at, i.updated_at
  FROM integrations i
  WHERE i.enabled = true AND (p_id IS NULL OR i.id = p_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_connectable_integrations(UUID) TO anon, authenticated;

-- The exposed key has been client-readable since it was generated; treat it
-- as compromised rather than rotating it. Nothing currently consumes it
-- (auth_bridge was never activated for this integration — see
-- SESSION_HANDOFF.md).
UPDATE integrations SET signing_key = NULL WHERE slug = 'protocode-learn';

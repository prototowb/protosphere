-- Migration 023: fix two RLS bugs
--
-- Bug 1 (42P17): servers_update policy referenced the servers table from
--   within a policy ON servers, causing infinite recursion.
--   Fix: direct column check + user_has_permission() (SECURITY DEFINER).
--
-- Bug 2 (42501): handled in supabase-backend.ts — no SQL change needed.
--   (dm_groups INSERT ... RETURNING * failed the SELECT policy because the
--   user wasn't yet in direct_message_members; fixed by inserting members
--   before SELECTing the group.)

DROP POLICY IF EXISTS "servers_update" ON servers;

CREATE POLICY "servers_update" ON servers
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR user_has_permission(id, auth.uid(), 1)  -- MANAGE_SPACE = 1 << 0
  );

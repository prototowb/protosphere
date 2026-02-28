-- 018_rls_m15.sql
-- M15: Supabase Real-time & Integration
--   1. Publish messages table to supabase_realtime (enables postgres_changes)
--   2. Add mutes UPDATE policy (backend uses upsert = INSERT + UPDATE on conflict)
--   3. Tighten poll_options and poll_votes SELECT policies (restrict to server members)
--   4. Tighten event_rsvps SELECT policy (restrict to server members)

-- ── 1. Real-time publication ─────────────────────────────────────────────────
-- Supabase Realtime listens only to tables explicitly added to the publication.
-- Without this, postgres_changes subscriptions on messages will subscribe but
-- never receive any events.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ── 2. Mutes UPDATE policy ───────────────────────────────────────────────────
-- The backend's mutes.add() uses .upsert() which performs an INSERT with
-- ON CONFLICT DO UPDATE. The UPDATE leg requires an UPDATE policy.
-- MUTE_MEMBERS = bit 26 = 67108864
CREATE POLICY "mutes_update" ON mutes
  FOR UPDATE USING (
    user_has_permission(server_id, auth.uid(), 67108864)
  );

-- ── 3. Poll RLS tightening ───────────────────────────────────────────────────
-- poll_options_select was too open (any authed user could read options of any poll).
-- Restrict to server members, matching polls_select.
DROP POLICY IF EXISTS "poll_options_select" ON poll_options;
CREATE POLICY "poll_options_select" ON poll_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN channels c ON c.id = p.channel_id
      JOIN members m ON m.server_id = c.server_id
      WHERE p.id = poll_options.poll_id
        AND m.user_id = auth.uid()
    )
  );

-- poll_votes_select was USING (true) — restrict to server members.
DROP POLICY IF EXISTS "poll_votes_select" ON poll_votes;
CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN channels c ON c.id = p.channel_id
      JOIN members m ON m.server_id = c.server_id
      WHERE p.id = poll_votes.poll_id
        AND m.user_id = auth.uid()
    )
  );

-- ── 4. Event RSVP RLS tightening ─────────────────────────────────────────────
-- event_rsvps_select was USING (true) — restrict to server members.
DROP POLICY IF EXISTS "event_rsvps_select" ON event_rsvps;
CREATE POLICY "event_rsvps_select" ON event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN members m ON m.server_id = e.server_id
      WHERE e.id = event_rsvps.event_id
        AND m.user_id = auth.uid()
    )
  );

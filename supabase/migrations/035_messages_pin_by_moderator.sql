-- Migration 035: allow moderators to update is_pinned on any message in their server

CREATE POLICY "messages_pin_by_moderator" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_id
        AND has_role_or_above(c.server_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_id
        AND has_role_or_above(c.server_id, auth.uid(), 'moderator')
    )
  );

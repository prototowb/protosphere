-- Migration 030: Enable RLS on channel_categories
--
-- channel_categories was created in migration 006 without RLS, exposing
-- all categories to any authenticated user (Security Advisor warning).
-- Policies mirror the channels table: members can read, admins can write.

ALTER TABLE channel_categories ENABLE ROW LEVEL SECURITY;

-- Server members can read categories for their spaces
CREATE POLICY "channel_categories_select" ON channel_categories
  FOR SELECT USING (is_server_member(server_id, auth.uid()));

-- Admins (MANAGE_SPACE or ADMINISTRATOR) can create/update/delete categories
CREATE POLICY "channel_categories_insert" ON channel_categories
  FOR INSERT WITH CHECK (user_has_permission(server_id, auth.uid(), 1));

CREATE POLICY "channel_categories_update" ON channel_categories
  FOR UPDATE USING (user_has_permission(server_id, auth.uid(), 1));

CREATE POLICY "channel_categories_delete" ON channel_categories
  FOR DELETE USING (user_has_permission(server_id, auth.uid(), 1));

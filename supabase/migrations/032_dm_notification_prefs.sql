-- Migration 032: DM notification preferences

CREATE TABLE dm_notification_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES dm_groups(id) ON DELETE CASCADE,
  muted BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE dm_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_notif_prefs_own" ON dm_notification_preferences
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

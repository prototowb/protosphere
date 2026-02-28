-- 017_events.sql
-- Community events with RSVP tracking.

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id  UUID REFERENCES channels(id) ON DELETE SET NULL,
  title       TEXT NOT NULL
                CONSTRAINT event_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_server_start ON events (server_id, start_at);

CREATE TABLE event_rsvps (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL
               CONSTRAINT valid_rsvp_status CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.server_id = events.server_id
        AND members.user_id = auth.uid()
    )
  );

CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "event_rsvps_select" ON event_rsvps FOR SELECT
  USING (true);

CREATE POLICY "event_rsvps_insert" ON event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_rsvps_update" ON event_rsvps FOR UPDATE
  USING (user_id = auth.uid());

-- 016_polls.sql
-- Polls appear as standalone items in a channel's polls panel.

CREATE TABLE polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  question    TEXT NOT NULL
                CONSTRAINT poll_question_length CHECK (char_length(question) BETWEEN 1 AND 500),
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  closed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_polls_channel ON polls (channel_id, created_at DESC);

CREATE TABLE poll_options (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text      TEXT NOT NULL
              CONSTRAINT poll_option_length CHECK (char_length(text) BETWEEN 1 AND 200),
  position  INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_poll_options_poll ON poll_options (poll_id, position);

CREATE TABLE poll_votes (
  poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "polls_select" ON polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN channels c ON c.server_id = m.server_id
      WHERE c.id = polls.channel_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "poll_options_select" ON poll_options FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM polls p WHERE p.id = poll_options.poll_id)
  );

CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT
  USING (true);

CREATE POLICY "polls_insert" ON polls FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "poll_options_insert" ON poll_options FOR INSERT
  WITH CHECK (true);

CREATE POLICY "poll_votes_insert" ON poll_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "poll_votes_update" ON poll_votes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "polls_update" ON polls FOR UPDATE
  USING (created_by = auth.uid());

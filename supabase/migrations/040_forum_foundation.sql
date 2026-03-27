-- Migration 040: Forum Foundation (PTSPH-184)
--
-- Replaces the thread system with a first-class forum.
-- Two post types: 'meta' (classic forum + voting) and 'page' (block editor, M23).
-- Messages marked as forum posts get expires_at = NULL (PTSPH-182).
--
-- Also removes thread columns from channels (they were only used by ThreadPanel).

-- ── Remove thread columns ─────────────────────────────────────────────────────

ALTER TABLE channels
  DROP COLUMN IF EXISTS parent_message_id,
  DROP COLUMN IF EXISTS parent_channel_id;

-- ── forum_posts ───────────────────────────────────────────────────────────────

CREATE TABLE forum_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID        NOT NULL REFERENCES servers(id)   ON DELETE CASCADE,
  source_message_id UUID      REFERENCES messages(id)           ON DELETE SET NULL,
  type            TEXT        NOT NULL CHECK (type IN ('meta', 'page')),
  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content         JSONB,                 -- Page type block editor content (M23)
  vote_score      INT         NOT NULL DEFAULT 0,
  created_by      UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  marked_by       UUID        REFERENCES profiles(id)           ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_space_id ON forum_posts (space_id, created_at DESC);

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- Members of a space can view its forum posts
CREATE POLICY "forum_posts_select" ON forum_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.server_id = forum_posts.space_id
        AND members.user_id = auth.uid()
    )
  );

CREATE POLICY "forum_posts_insert" ON forum_posts
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Author or person who marked it can update
CREATE POLICY "forum_posts_update" ON forum_posts
  FOR UPDATE USING (
    auth.uid() = created_by OR auth.uid() = marked_by
  );

CREATE POLICY "forum_posts_delete" ON forum_posts
  FOR DELETE USING (auth.uid() = created_by);

-- ── Trigger: keep updated_at current ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_forum_post_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_forum_post_updated_at
BEFORE UPDATE ON forum_posts
FOR EACH ROW EXECUTE FUNCTION set_forum_post_updated_at();

-- ── forum_collaborators ───────────────────────────────────────────────────────

CREATE TABLE forum_collaborators (
  post_id     UUID        NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  invited_by  UUID        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE forum_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_collaborators_select" ON forum_collaborators
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM forum_posts fp
      JOIN members m ON m.server_id = fp.space_id AND m.user_id = auth.uid()
      WHERE fp.id = forum_collaborators.post_id
    )
  );

-- Only post author or marked_by can add collaborators
CREATE POLICY "forum_collaborators_insert" ON forum_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM forum_posts fp
      WHERE fp.id = forum_collaborators.post_id
        AND (fp.created_by = auth.uid() OR fp.marked_by = auth.uid())
    )
  );

CREATE POLICY "forum_collaborators_delete" ON forum_collaborators
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM forum_posts fp
      WHERE fp.id = forum_collaborators.post_id AND fp.created_by = auth.uid()
    )
  );

-- ── Link messages to forum posts (PTSPH-182) ──────────────────────────────────
-- When a message is promoted to a forum post the app sets expires_at = NULL.
-- forum_post_id is the back-reference for display purposes.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS forum_post_id UUID REFERENCES forum_posts(id) ON DELETE SET NULL;

CREATE INDEX idx_messages_forum_post_id ON messages (forum_post_id)
  WHERE forum_post_id IS NOT NULL;

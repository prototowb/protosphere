-- Migration 041: Forum comments and voting (PTSPH-185)

-- ── forum_comments ────────────────────────────────────────────────────────────

CREATE TABLE forum_comments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID        NOT NULL REFERENCES forum_posts(id)    ON DELETE CASCADE,
  parent_comment_id UUID        REFERENCES forum_comments(id)          ON DELETE CASCADE,
  author_id         UUID        NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  content           TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at         TIMESTAMPTZ
);

CREATE INDEX idx_forum_comments_post_id  ON forum_comments (post_id, created_at);
CREATE INDEX idx_forum_comments_parent   ON forum_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can see the space
CREATE POLICY "forum_comments_select" ON forum_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forum_posts fp
      JOIN members m ON m.server_id = fp.space_id AND m.user_id = auth.uid()
      WHERE fp.id = forum_comments.post_id
    )
  );

CREATE POLICY "forum_comments_insert" ON forum_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "forum_comments_update" ON forum_comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "forum_comments_delete" ON forum_comments
  FOR DELETE USING (auth.uid() = author_id);

-- ── forum_post_votes ─────────────────────────────────────────────────────────

CREATE TABLE forum_post_votes (
  post_id   UUID     NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id   UUID     NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  value     SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE forum_post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_post_votes_select" ON forum_post_votes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "forum_post_votes_insert" ON forum_post_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "forum_post_votes_update" ON forum_post_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "forum_post_votes_delete" ON forum_post_votes
  FOR DELETE USING (auth.uid() = user_id);

-- ── Trigger: maintain vote_score on forum_posts ───────────────────────────────

CREATE OR REPLACE FUNCTION update_forum_post_vote_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET vote_score = vote_score - OLD.value WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE forum_posts SET vote_score = vote_score - OLD.value + NEW.value WHERE id = NEW.post_id;
    RETURN NEW;
  ELSE
    UPDATE forum_posts SET vote_score = vote_score + NEW.value WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_forum_vote_score
AFTER INSERT OR UPDATE OR DELETE ON forum_post_votes
FOR EACH ROW EXECUTE FUNCTION update_forum_post_vote_score();

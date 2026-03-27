-- Migration 044: Forum thread redesign (PTSPH-184 rev)
--
-- 1. Rename post type 'meta' → 'thread'
-- 2. Add body TEXT to forum_posts (thread creator's first reply)
-- 3. Add vote_score to forum_comments
-- 4. Create forum_comment_votes + triggers (vote_score + meta_points)
-- 5. Create forum_comment_reactions

-- ── 1. Rename type 'meta' → 'thread' ─────────────────────────────────────────

ALTER TABLE forum_posts DROP CONSTRAINT forum_posts_type_check;
UPDATE forum_posts SET type = 'thread' WHERE type = 'meta';
ALTER TABLE forum_posts ADD CONSTRAINT forum_posts_type_check CHECK (type IN ('thread', 'page'));

-- ── 2. Thread body ────────────────────────────────────────────────────────────

ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS body TEXT;

-- ── 3. Comment vote score ─────────────────────────────────────────────────────

ALTER TABLE forum_comments
  ADD COLUMN IF NOT EXISTS vote_score INT NOT NULL DEFAULT 0;

-- ── 4. forum_comment_votes ────────────────────────────────────────────────────

CREATE TABLE forum_comment_votes (
  comment_id UUID     NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id    UUID     NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE forum_comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcv_select" ON forum_comment_votes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "fcv_insert" ON forum_comment_votes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "fcv_update" ON forum_comment_votes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "fcv_delete" ON forum_comment_votes FOR DELETE USING (user_id = auth.uid());

-- Trigger: maintain vote_score on forum_comments
CREATE OR REPLACE FUNCTION update_forum_comment_vote_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE forum_comments SET vote_score = vote_score - OLD.value WHERE id = OLD.comment_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE forum_comments SET vote_score = vote_score - OLD.value + NEW.value WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSE
    UPDATE forum_comments SET vote_score = vote_score + NEW.value WHERE id = NEW.comment_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_forum_comment_vote_score
AFTER INSERT OR UPDATE OR DELETE ON forum_comment_votes
FOR EACH ROW EXECUTE FUNCTION update_forum_comment_vote_score();

-- Trigger: update comment author's meta_points on comment vote change
CREATE OR REPLACE FUNCTION update_author_meta_points_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_author_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT author_id INTO v_author_id FROM forum_comments WHERE id = OLD.comment_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET meta_points = GREATEST(0, meta_points - OLD.value) WHERE id = v_author_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT author_id INTO v_author_id FROM forum_comments WHERE id = NEW.comment_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET meta_points = GREATEST(0, meta_points - OLD.value + NEW.value) WHERE id = v_author_id;
    END IF;
    RETURN NEW;
  ELSE
    SELECT author_id INTO v_author_id FROM forum_comments WHERE id = NEW.comment_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET meta_points = GREATEST(0, meta_points + NEW.value) WHERE id = v_author_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_author_meta_points_comment
AFTER INSERT OR UPDATE OR DELETE ON forum_comment_votes
FOR EACH ROW EXECUTE FUNCTION update_author_meta_points_comment();

-- ── 5. forum_comment_reactions ────────────────────────────────────────────────

CREATE TABLE forum_comment_reactions (
  comment_id UUID        NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  emoji      TEXT        NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id, emoji)
);

ALTER TABLE forum_comment_reactions ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can see the space the post belongs to
CREATE POLICY "fcr_select" ON forum_comment_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forum_comments fc
      JOIN forum_posts fp ON fp.id = fc.post_id
      JOIN members m ON m.server_id = fp.space_id AND m.user_id = auth.uid()
      WHERE fc.id = forum_comment_reactions.comment_id
    )
  );

CREATE POLICY "fcr_insert" ON forum_comment_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcr_delete" ON forum_comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

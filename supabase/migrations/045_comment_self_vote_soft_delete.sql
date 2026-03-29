-- Migration 045: Comment auto self-vote + soft-delete with meta-point penalty
--
-- 1. Add is_deleted to forum_comments and forum_posts (soft-delete)
-- 2. Trigger: auto-insert self-upvote when a comment is created
-- 3. Trigger: subtract 1 meta_point when a comment is soft-deleted
-- 4. Trigger: subtract 1 meta_point when a post is soft-deleted
-- 5. RLS: allow post author to UPDATE forum_posts (needed for soft-delete)

-- ── 1. Soft-delete columns ────────────────────────────────────────────────────

ALTER TABLE forum_comments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Auto self-vote on comment INSERT ──────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_self_vote_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO forum_comment_votes (comment_id, user_id, value)
  VALUES (NEW.id, NEW.author_id, 1)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_self_vote_comment
AFTER INSERT ON forum_comments
FOR EACH ROW EXECUTE FUNCTION auto_self_vote_on_comment();

-- ── 3. Meta-point penalty on comment soft-delete ─────────────────────────────

CREATE OR REPLACE FUNCTION subtract_meta_on_comment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    UPDATE profiles
    SET meta_points = GREATEST(0, meta_points - 1)
    WHERE id = NEW.author_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comment_soft_delete_meta
AFTER UPDATE ON forum_comments
FOR EACH ROW EXECUTE FUNCTION subtract_meta_on_comment_delete();

-- ── 4. Meta-point penalty on post soft-delete ────────────────────────────────

CREATE OR REPLACE FUNCTION subtract_meta_on_post_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    UPDATE profiles
    SET meta_points = GREATEST(0, meta_points - 1)
    WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_soft_delete_meta
AFTER UPDATE ON forum_posts
FOR EACH ROW EXECUTE FUNCTION subtract_meta_on_post_delete();

-- ── 5. Allow post author to soft-delete via UPDATE ───────────────────────────
-- (existing forum_posts_update policy already covers auth.uid() = created_by;
--  we add a separate permissive policy so moderators can also soft-delete)

-- The existing policy already allows the author to update — no new policy needed.
-- Moderators can hard-delete via DELETE (existing forum_posts_delete policy).

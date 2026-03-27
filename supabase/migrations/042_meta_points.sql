-- Migration 042: Meta points system (PTSPH-186)
--
-- meta_points is a global-per-user reputation score earned when other members
-- vote on the user's forum posts. Points are called "meta points" (not karma).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS meta_points INT NOT NULL DEFAULT 0;

-- ── Trigger: update post author's meta_points on vote change ──────────────────

CREATE OR REPLACE FUNCTION update_author_meta_points()
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
    SELECT created_by INTO v_author_id FROM forum_posts WHERE id = OLD.post_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET meta_points = GREATEST(0, meta_points - OLD.value) WHERE id = v_author_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT created_by INTO v_author_id FROM forum_posts WHERE id = NEW.post_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET meta_points = GREATEST(0, meta_points - OLD.value + NEW.value) WHERE id = v_author_id;
    END IF;
    RETURN NEW;
  ELSE
    SELECT created_by INTO v_author_id FROM forum_posts WHERE id = NEW.post_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE profiles SET meta_points = GREATEST(0, meta_points + NEW.value) WHERE id = v_author_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_author_meta_points
AFTER INSERT OR UPDATE OR DELETE ON forum_post_votes
FOR EACH ROW EXECUTE FUNCTION update_author_meta_points();

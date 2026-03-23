-- Migration 036: Harden handle_new_user trigger for OAuth providers
--
-- Problems fixed:
-- 1. display_name check (BETWEEN 1 AND 48) fails when OAuth metadata returns
--    empty string '' for full_name/name (not NULL — COALESCE picks it up).
-- 2. username_format check ({3,32}) fails when email prefix transforms to < 3 chars.
-- 3. NULL email (e.g. GitHub with private email) causes split_part to return NULL.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email_prefix TEXT;
  v_username     TEXT;
  v_display_name TEXT;
BEGIN
  -- Safely derive email prefix (handles NULL email from providers like GitHub)
  v_email_prefix := regexp_replace(
    split_part(COALESCE(NEW.email, ''), '@', 1),
    '[^a-zA-Z0-9_]', '_', 'g'
  );

  -- Username: explicit > email prefix (only if >=3 chars) > UUID-based fallback
  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    CASE WHEN char_length(v_email_prefix) >= 3 THEN v_email_prefix ELSE NULL END,
    'user_' || substr(NEW.id::text, 1, 8)
  );

  -- Display name: use NULLIF on each source to skip empty strings
  v_display_name := COALESCE(
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'name', '')), ''),
    NULLIF(v_email_prefix, ''),
    'New User'
  );

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, v_username, v_display_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

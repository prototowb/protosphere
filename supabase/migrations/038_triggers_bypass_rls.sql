-- Migration 038: Explicitly bypass RLS in auth triggers
--
-- SECURITY DEFINER alone is not sufficient in Supabase — the postgres role
-- can still be subject to RLS depending on project configuration.
-- Adding SET row_security = off to the function definition ensures the trigger
-- bypasses RLS unconditionally, regardless of the calling role or Supabase version.

-- ── handle_new_user ──────────────────────────────────────────────────────────
-- Fires AFTER INSERT ON auth.users — creates the public.profiles row.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_email_prefix TEXT;
  v_username     TEXT;
  v_display_name TEXT;
BEGIN
  v_email_prefix := regexp_replace(
    split_part(COALESCE(NEW.email, ''), '@', 1),
    '[^a-zA-Z0-9_]', '_', 'g'
  );

  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    CASE WHEN char_length(v_email_prefix) >= 3 THEN v_email_prefix ELSE NULL END,
    'user_' || substr(NEW.id::text, 1, 8)
  );

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
$$;

-- ── bootstrap_first_user ─────────────────────────────────────────────────────
-- Fires AFTER INSERT ON profiles — seeds community_settings and assigns Owner
-- role on first ever signup. Returns early if already bootstrapped.

CREATE OR REPLACE FUNCTION bootstrap_first_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner_role_id UUID;
  v_server_id     UUID;
  v_community_count INT;
BEGIN
  SELECT COUNT(*) INTO v_community_count FROM community_settings;
  IF v_community_count > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO community_settings (name, description, registration_mode, rules, welcome_message)
  VALUES ('My Community', 'Welcome to our community!', 'open', '', 'Welcome!')
  ON CONFLICT DO NOTHING;

  SELECT r.id, r.server_id INTO v_owner_role_id, v_server_id
  FROM roles r
  WHERE r.name = 'Owner' AND r.is_system = true
  LIMIT 1;

  IF v_owner_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (NEW.id, v_owner_role_id)
    ON CONFLICT DO NOTHING;

    UPDATE members SET role = 'owner'
    WHERE server_id = v_server_id AND user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

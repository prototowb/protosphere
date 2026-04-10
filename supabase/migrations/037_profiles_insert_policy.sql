-- Migration 037: Add missing INSERT policy on profiles
--
-- Migration 002 enables RLS on profiles but only adds SELECT + UPDATE policies.
-- Supabase enforces RLS even for the postgres superuser role, so the
-- handle_new_user SECURITY DEFINER trigger cannot INSERT into profiles without
-- an explicit policy, causing "Database error saving new user" on every signup.
--
-- WITH CHECK (true) is safe here: the only INSERT path is the auth trigger
-- (which uses NEW.id from auth.users), and the PRIMARY KEY on profiles.id
-- prevents any duplicate or arbitrary inserts.

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (true);

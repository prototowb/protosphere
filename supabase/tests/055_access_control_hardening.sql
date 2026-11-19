-- Regression suite for migration 055 (access-control hardening).
--
-- Runs entirely inside a transaction that ends in ROLLBACK: it applies 054 and
-- 055 on top of a LOCAL database at 053, builds fixtures, then acts as real
-- `authenticated` users (forged request.jwt.claims) and checks that forbidden
-- writes/reads are blocked while normal flows keep working.
--
-- LOCAL STACK ONLY. Never run against a linked/hosted project.
--
--   docker cp supabase/migrations/054_integrations_rls_lockdown.sql supabase_db_protocode-chat:/tmp/054.sql
--   docker cp supabase/migrations/055_access_control_hardening.sql  supabase_db_protocode-chat:/tmp/055.sql
--   docker cp supabase/tests/055_access_control_hardening.sql       supabase_db_protocode-chat:/tmp/t.sql
--   MSYS_NO_PATHCONV=1 docker exec supabase_db_protocode-chat psql -U postgres -d postgres -tA -f /tmp/t.sql
--
-- Every line of output should start with PASS. (If the local DB is already at
-- 054+, drop the two \i lines.) Requires at least one community owner, one
-- space owner, two ordinary members and one message in the local data.

\set ON_ERROR_STOP on
\set QUIET on
BEGIN;
\i /tmp/054.sql
-- Reproduce production drift (2026-11-19): 024's DM creator trigger is absent
-- there. 055 must recreate it, or new DMs lock their creator out.
DROP TRIGGER IF EXISTS on_dm_group_created ON direct_message_groups;
DROP FUNCTION IF EXISTS public.auto_join_dm_creator();
\i /tmp/055.sql

-- Fixtures (as postgres): O = community owner, U and V = ordinary members,
-- S = a space owner. Put U in 'pending' to test self-approval.
SELECT NULL FROM set_config('t.o', (SELECT owner_id::text FROM community_settings LIMIT 1), true);
SELECT NULL FROM set_config('t.s', (SELECT owner_id::text FROM servers WHERE owner_id <> current_setting('t.o')::uuid LIMIT 1), true);
SELECT NULL FROM set_config('t.u', (SELECT id::text FROM profiles p WHERE NOT public.is_registration_moderator(p.id) ORDER BY id LIMIT 1), true);
SELECT NULL FROM set_config('t.v', (SELECT id::text FROM profiles p WHERE NOT public.is_registration_moderator(p.id) ORDER BY id OFFSET 1 LIMIT 1), true);
UPDATE profiles SET account_status = 'pending' WHERE id = current_setting('t.u')::uuid;
SELECT NULL FROM set_config('t.g', gen_random_uuid()::text, true);
SELECT NULL FROM set_config('request.jwt.claims', json_build_object('sub', current_setting('t.o'))::text, true);
INSERT INTO direct_message_groups (id) VALUES (current_setting('t.g')::uuid);
DELETE FROM direct_message_members WHERE dm_group_id = current_setting('t.g')::uuid;
INSERT INTO direct_message_members (dm_group_id, user_id) VALUES
  (current_setting('t.g')::uuid, current_setting('t.o')::uuid),
  (current_setting('t.g')::uuid, current_setting('t.v')::uuid);
SELECT NULL FROM set_config('t.msg', (SELECT id::text FROM messages LIMIT 1), true);
-- U must be a member of the message's space, so only the emoji CHECK can block.
INSERT INTO members (server_id, user_id)
  SELECT c.server_id, current_setting('t.u')::uuid FROM messages m JOIN channels c ON c.id = m.channel_id
  WHERE m.id = current_setting('t.msg')::uuid ON CONFLICT DO NOTHING;
-- V has a connected integration with one public, one hidden, one private field.
INSERT INTO integrations (id, name, slug, api_base_url, auth_mode, created_by)
  VALUES ('00000000-0000-0000-0000-0000000000a1', 'T', 't-fixture-055', 'https://x.test', 'same_domain_cookie', current_setting('t.o')::uuid);
INSERT INTO integration_field_schemas (integration_id, field_key, label, field_type, default_visibility) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'pub', 'P', 'number', 'public'),
  ('00000000-0000-0000-0000-0000000000a1', 'secret', 'S', 'number', 'hidden'),
  ('00000000-0000-0000-0000-0000000000a1', 'mine', 'M', 'number', 'private');
-- V authors a forum post in the same space (meta_points is maintained by a
-- SECURITY DEFINER trigger on votes — must keep working under the guard).
INSERT INTO forum_posts (id, space_id, type, title, created_by)
  SELECT '00000000-0000-0000-0000-0000000000b1', c.server_id, 'thread', 'fixture', current_setting('t.v')::uuid
  FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = current_setting('t.msg')::uuid;
INSERT INTO members (server_id, user_id)
  SELECT space_id, current_setting('t.v')::uuid FROM forum_posts WHERE id = '00000000-0000-0000-0000-0000000000b1'
  ON CONFLICT DO NOTHING;
INSERT INTO user_integrations (user_id, integration_id, synced_data, connection_token) VALUES
  (current_setting('t.v')::uuid, '00000000-0000-0000-0000-0000000000a1',
   '{"pub":{"value":1},"secret":{"value":2},"mine":{"value":3}}', 'tok');

CREATE FUNCTION pg_temp.act(uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SELECT set_config('request.jwt.claim.sub', uid, true);
$$;
CREATE TABLE pg_temp.results (name text, ok boolean);
GRANT ALL ON pg_temp.results TO authenticated;

-- expect_blocked: statement must raise 42501 or affect 0 rows.
CREATE FUNCTION pg_temp.expect_blocked(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE stmt; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO pg_temp.results VALUES (name, n = 0);
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  INSERT INTO pg_temp.results VALUES (name, true);
END $$;
-- expect_ok: statement must succeed and affect >= 1 row.
CREATE FUNCTION pg_temp.expect_ok(name text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE stmt; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO pg_temp.results VALUES (name, n >= 1);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '% failed: %', name, SQLERRM;
  INSERT INTO pg_temp.results VALUES (name, false);
END $$;

SET ROLE authenticated;

-- ── Attacks by ordinary member U ────────────────────────────────────────────
SELECT pg_temp.act(current_setting('t.u'));
SELECT pg_temp.expect_blocked('self-approve', format('UPDATE profiles SET account_status=%L WHERE id=%L', 'active', current_setting('t.u')));
SELECT pg_temp.expect_blocked('edit other bio', format('UPDATE profiles SET bio=%L WHERE id=%L', 'pwned', current_setting('t.v')));
SELECT pg_temp.expect_blocked('reject owner', format('UPDATE profiles SET account_status=%L WHERE id=%L', 'rejected', current_setting('t.o')));
SELECT pg_temp.expect_blocked('meta_points forge', format('UPDATE profiles SET meta_points=999999 WHERE id=%L', current_setting('t.u')));
SELECT pg_temp.expect_blocked('join foreign DM', format('INSERT INTO direct_message_members (dm_group_id,user_id) VALUES (%L,%L)', current_setting('t.g'), current_setting('t.u')));
SELECT pg_temp.expect_blocked('read others integrations', 'SELECT 1 FROM user_integrations WHERE user_id <> auth.uid()');
SELECT pg_temp.expect_blocked('markup reaction', format('INSERT INTO reactions (message_id,user_id,emoji) VALUES (%L,%L,%L)', current_setting('t.msg'), current_setting('t.u'), '<img src=x onerror=alert(1)>'));

-- ── Legitimate paths for U ──────────────────────────────────────────────────
SELECT pg_temp.expect_ok('own bio edit', format('UPDATE profiles SET bio=%L WHERE id=%L', 'hello', current_setting('t.u')));
SELECT pg_temp.expect_ok('own presence', format('UPDATE profiles SET status=%L WHERE id=%L', 'online', current_setting('t.u')));
SELECT pg_temp.expect_ok('rpc: viewer sees public only', format(
  $q$SELECT 1 FROM public.get_public_user_integrations(%L) WHERE synced_data ? 'pub' AND NOT synced_data ? 'secret' AND NOT synced_data ? 'mine'$q$,
  current_setting('t.v')));
SELECT NULL FROM set_config('t.meta0', (SELECT meta_points::text FROM profiles WHERE id = current_setting('t.v')::uuid), true);
SELECT pg_temp.expect_ok('vote on another member''s post', format('INSERT INTO forum_post_votes (post_id, user_id, value) VALUES (%L,%L,1)', '00000000-0000-0000-0000-0000000000b1', current_setting('t.u')));
SELECT pg_temp.expect_ok('vote trigger still updates author meta_points', format(
  'SELECT 1 FROM profiles WHERE id = %L AND meta_points = %s + 1', current_setting('t.v'), current_setting('t.meta0')));
SELECT pg_temp.expect_ok('normal emoji reaction', format('INSERT INTO reactions (message_id,user_id,emoji) VALUES (%L,%L,%L)', current_setting('t.msg'), current_setting('t.u'), '👍🏽'));

SELECT pg_temp.act(current_setting('t.v'));
SELECT pg_temp.expect_ok('rpc: owner sees private too', format(
  $q$SELECT 1 FROM public.get_public_user_integrations(%L) WHERE synced_data ? 'mine' AND NOT synced_data ? 'secret'$q$,
  current_setting('t.v')));
SELECT pg_temp.expect_ok('owner reads own row', 'SELECT 1 FROM user_integrations WHERE user_id = auth.uid()');
SELECT pg_temp.act(current_setting('t.u'));

-- DM creation flow exactly as the client does it: insert group (trigger adds
-- creator), then upsert all members in one statement.
SELECT NULL FROM set_config('t.g2', gen_random_uuid()::text, true);
SELECT pg_temp.expect_ok('DM create group', format('INSERT INTO direct_message_groups (id) VALUES (%L)', current_setting('t.g2')));
SELECT pg_temp.expect_ok('DM add members', format(
  'INSERT INTO direct_message_members (dm_group_id,user_id) VALUES (%L,%L),(%L,%L) ON CONFLICT DO NOTHING',
  current_setting('t.g2'), current_setting('t.u'), current_setting('t.g2'), current_setting('t.v')));

-- ── Space owner S: may moderate registrations, but nothing else on others ──
SELECT pg_temp.act(current_setting('t.s'));
SELECT pg_temp.expect_ok('moderator approves', format('UPDATE profiles SET account_status=%L WHERE id=%L', 'active', current_setting('t.u')));
SELECT pg_temp.expect_blocked('moderator edits bio', format('UPDATE profiles SET bio=%L WHERE id=%L', 'x', current_setting('t.v')));
SELECT pg_temp.expect_blocked('seize ownership', format('UPDATE community_settings SET owner_id=%L', current_setting('t.s')));

-- ── Owner O ─────────────────────────────────────────────────────────────────
SELECT pg_temp.act(current_setting('t.o'));
SELECT pg_temp.expect_ok('owner edits settings', 'UPDATE community_settings SET description = description');

RESET ROLE;
SELECT (CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END) || name FROM pg_temp.results;
ROLLBACK;

-- 019_dm_realtime.sql
-- Enable Supabase Realtime for direct_messages so DM conversations
-- receive live INSERT/UPDATE/DELETE events across clients.
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

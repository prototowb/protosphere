-- Migration 031: message_attachments table + attachments Storage bucket

-- attachments Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true)
  ON CONFLICT (id) DO NOTHING;

-- Upload: authenticated users only, path must start with their uid
CREATE POLICY "attachments_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read
CREATE POLICY "attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments');

-- message_attachments table
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Members of the space can read attachments
CREATE POLICY "attachments_member_select" ON message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE m.id = message_id AND is_server_member(c.server_id, auth.uid())
    )
  );

-- Only the message author can delete attachments
CREATE POLICY "attachments_author_delete" ON message_attachments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM messages WHERE id = message_id AND author_id = auth.uid())
  );

-- Anyone authenticated can insert (author is validated via RLS on messages)
CREATE POLICY "attachments_insert" ON message_attachments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM messages WHERE id = message_id AND author_id = auth.uid())
  );

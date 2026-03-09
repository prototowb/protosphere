-- Migration 028: Create avatars storage bucket + RLS policies
--
-- The avatars bucket was never provisioned via migration.
-- Supabase Storage bucket creation requires the storage schema.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload into their own folder (userId/avatar.ext)
CREATE POLICY "users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can replace their own avatar
CREATE POLICY "users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read (avatars are displayed to all users)
CREATE POLICY "avatars are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

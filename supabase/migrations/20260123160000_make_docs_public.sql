
-- 1. Make the 'driver_documents' bucket PUBLIC
-- This means anyone with the URL can view the file (if they guess the name),
-- which is what the user requested ("Make it normal/public").
UPDATE storage.buckets
SET public = true
WHERE id = 'driver_documents';

-- 2. Drop the strict "Admins Only" viewing policy
DROP POLICY IF EXISTS "Admins can view all driver documents" ON storage.objects;

-- 3. Allow EVERYONE (Public) to view files in this bucket
-- This ensures that simple <img> tags work without signed URLs.
CREATE POLICY "Public Access to Driver Documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'driver_documents' );

-- 4. Keep the Upload Policy (Authenticated Drivers only)
-- We still want to prevent random strangers from uploading junk.
-- Existing policy "Drivers can upload their own documents" should remain or be re-created if I nuked it.
-- Let's ensure it exists.
DROP POLICY IF EXISTS "Drivers can upload their own documents" ON storage.objects;

CREATE POLICY "Drivers can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver_documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

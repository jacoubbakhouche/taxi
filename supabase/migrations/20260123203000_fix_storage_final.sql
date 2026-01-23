-- FINAL FIX for Driver Documents Storage
-- Run this in Supabase SQL Editor

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver_documents', 
  'driver_documents', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

-- 2. DANGEROUSLY OPEN POLICIES (for troubleshooting)
-- Remove all existing policies on this bucket to avoid conflicts
DROP POLICY IF EXISTS "Allow Public Upload 2" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Select 2" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Update 2" ON storage.objects;
DROP POLICY IF EXISTS "Give me access" ON storage.objects;

-- 3. Allow ANYONE to do ANYTHING with this bucket
CREATE POLICY "Give me access"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'driver_documents')
WITH CHECK (bucket_id = 'driver_documents');

-- 4. Grant usage just in case
GRANT ALL ON TABLE storage.objects TO postgres;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO authenticated;

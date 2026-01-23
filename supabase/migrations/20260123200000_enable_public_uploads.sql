-- Enable PUBLIC (anon/authenticated) access to 'driver_documents' storage bucket
-- This is required because we handle verification loosely.

-- 1. Ensure bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver_documents', 'driver_documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Drivers can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload 1" ON storage.objects;
DROP POLICY IF EXISTS "Allow Select 1" ON storage.objects;

-- 3. Create Permissive Policies
CREATE POLICY "Allow Public Upload 2"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'driver_documents');

CREATE POLICY "Allow Public Select 2"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver_documents');

-- 4. Allow Update too (re-upload)
CREATE POLICY "Allow Public Update 2"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'driver_documents');

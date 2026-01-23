
-- 1. Create the storage bucket (Private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver_documents', 'driver_documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow Authenticated Users (Drivers) to UPLOAD files
-- They can only upload to their own folder: uid/filename
CREATE POLICY "Drivers can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver_documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Policy: Allow Admins to VIEW (Select) ALL files
-- Assumes there is a 'role' column in 'public.users' and admin has role='admin'
CREATE POLICY "Admins can view all driver documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver_documents' AND
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 5. Policy: Allow Drivers to VIEW/DOWNLOAD their own files (Optional? User said 'only admin')
-- Keeping it strict: If the user said "appears to into admin", we might NOT add this.
-- But usually apps need verification. I will omit this for now to strictly follow "Only Admin".
-- If the driver needs to see it, we can add: OR (storage.foldername(name))[1] = auth.uid()::text

-- 6. Policy: Allow Drivers to UPDATE/DELETE? 
-- Usually we don't want them deleting evidence, but maybe re-uploading?
-- For now, INSERT only.


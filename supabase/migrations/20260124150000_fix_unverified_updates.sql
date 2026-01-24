-- FIX: Allow Unverified Drivers to Update Profile and Upload Docs

-- 1. Allow users to update their own row in 'users' table (Vital for submitting docs)
-- We use separate policies for SELECT and UPDATE usually, but here we ensure UPDATE is open.
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- 2. Ensure Storage Access for 'driver_documents'
-- (Redundant if previous fix was run, but safe to repeat)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('driver_documents', 'driver_documents', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'driver_documents');

DROP POLICY IF EXISTS "Allow authenticated select" ON storage.objects;
CREATE POLICY "Allow authenticated select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'driver_documents');

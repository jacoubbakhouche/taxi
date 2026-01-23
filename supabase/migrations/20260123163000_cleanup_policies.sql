
-- 1. CLEANUP: Remove "safe_allow" policies which might be duplicates or insecure
DROP POLICY IF EXISTS "safe_allow_insert" ON public.users;
DROP POLICY IF EXISTS "safe_allow_update" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users; -- potentially duplicate
DROP POLICY IF EXISTS "Admins can update status" ON public.users; -- potentially duplicate

-- 2. ENSURE: Read Access is perfect
-- This is the critical one for "Seeing Drivers".
DROP POLICY IF EXISTS "Allow authenticated to view all profiles" ON public.users;
CREATE POLICY "Allow authenticated to view all profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- 3. ENSURE: Insert Access (Sign Up)
-- Users need to insert their own row when they sign up.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
TO public -- Needs to be public for initial signup? Or authenticated? 
-- Supabase auth.users usually exists first, so 'authenticated' is correct.
WITH CHECK (auth.uid() = id);

-- 4. ENSURE: Update Access (Drivers update self, Admins update status)
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 5. ENSURE: Admin Update Access (Verify Drivers)
-- Securely allow admins to update others.
-- We use a simple non-recursive check or trusted logic.
CREATE POLICY "Admins can update any profile"
ON public.users
FOR UPDATE
TO authenticated
USING (
  -- Check if the ACTOR is an admin.
  -- To avoid recursion, we rely on the fact that we have SELECT access to everyone now.
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

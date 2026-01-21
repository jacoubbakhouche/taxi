-- NUCLEAR FIX: REMOVE ALL POLICIES AND RESET
-- This script is designed to forcefully clear the "Infinite Recursion" error by removing all potential conflicting policies.

-- 1. Disable RLS temporarily to clear state
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Drop EVERY known policy on the users table
-- We use "IF EXISTS" so it doesn't fail if the policy is already gone.
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "users_view_own" ON public.users;
DROP POLICY IF EXISTS "view_own_profile" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Allow individual read access" ON public.users;
DROP POLICY IF EXISTS "Everyone can see drivers" ON public.users;

-- 3. Fix the helper function to BE SURE it bypasses RLS
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER -- Critical: Bypass RLS
SET search_path = public
STABLE
AS $function$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$function$;

-- 4. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Create ONE simple, non-recursive policy for SELECT
-- "TRUE" means "Allow everyone to read everything". 
-- This is temporary to prove the error is gone. It CANNOT cause recursion because it checks nothing.
CREATE POLICY "temporary_allow_read_all" ON public.users
FOR SELECT USING (true);

-- 6. Allow users to update their own profile
CREATE POLICY "allow_update_own" ON public.users
FOR UPDATE USING (auth_id = auth.uid());

-- 7. Allow insert (for signup)
CREATE POLICY "allow_insert_signup" ON public.users
FOR INSERT WITH CHECK (true);

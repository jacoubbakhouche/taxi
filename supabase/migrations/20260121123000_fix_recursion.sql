-- FIX: Infinite Recursion in RLS Policy
-- The error "infinite recursion detected" happens because the policy calls a function
-- that queries the table protected by the policy, creating an endless loop.

-- 1. Fix the helper function to bypass RLS (SECURITY DEFINER)
-- This allows the function to read the 'users' table without triggering the policy check again.
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER -- CRITICAL: Bypass RLS for this function
SET search_path = public
STABLE
AS $function$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$function$;

-- 2. Drop the problematic policy to be safe
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- 3. Re-create the policy using the direct 'auth_id' check (Faster & Safer)
-- Instead of calling the function, we can directly compare the auth_id column
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT USING (auth_id = auth.uid());

-- 4. Grant permissions just in case
GRANT EXECUTE ON FUNCTION public.get_current_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_id TO service_role;

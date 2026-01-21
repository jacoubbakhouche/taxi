-- Fix infinite recursion in "Drivers can view customer info for rides" policy

-- 1. Create a secure function to get the current user's ID without triggering recursion
-- This function runs as the owner (SECURITY DEFINER) and bypasses RLS on the users table
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Drivers can view customer info for rides" ON public.users;

-- 3. Recreate the policy using the secure function
-- This avoids querying the users table directly within the policy using the user's implicit permissions
CREATE POLICY "Drivers can view customer info for rides"
ON public.users
FOR SELECT
USING (
  id IN (
    SELECT customer_id FROM rides 
    WHERE driver_id = public.get_current_user_id()
    OR status = 'pending'
  )
);

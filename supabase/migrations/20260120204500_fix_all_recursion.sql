-- Comprehensive Fix for Infinite Recursion (Error 42P17)
-- This script breaks the loop between 'users' and 'rides' tables by using a secure lookup function.

-- 1. Create/Update the helper function (Security Definer breaks the RLS chain)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$$;

-- 2. Fix 'users' table policies
DROP POLICY IF EXISTS "Drivers can view customer info for rides" ON public.users;

CREATE POLICY "Drivers can view customer info for rides"
ON public.users
FOR SELECT
USING (
  id IN (
    SELECT customer_id FROM rides 
    WHERE driver_id = public.get_current_user_id()
    OR (status = 'pending' AND (SELECT role FROM public.users WHERE id = public.get_current_user_id()) = 'driver')
  )
);

-- 3. Fix 'rides' table policies (Replace potentially recursive lookups)
DROP POLICY IF EXISTS "Users can view own rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update rides" ON public.rides;
DROP POLICY IF EXISTS "Customers can create rides" ON public.rides;

-- Safe: View own rides using the helper function
CREATE POLICY "Users can view own rides" ON public.rides
FOR SELECT USING (
  customer_id = public.get_current_user_id() OR
  driver_id = public.get_current_user_id()
);

-- Safe: Drivers update rides
CREATE POLICY "Drivers can update rides" ON public.rides
FOR UPDATE USING (
  driver_id = public.get_current_user_id() OR
  customer_id = public.get_current_user_id()
);

-- Safe: Customers create rides
CREATE POLICY "Customers can create rides" ON public.rides
FOR INSERT WITH CHECK (
  customer_id = public.get_current_user_id()
);

-- 4. Ensure basic policies still exist (Non-recursive)
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

CREATE POLICY "Users can view own data" ON public.users
FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own data" ON public.users
FOR UPDATE USING (auth.uid() = auth_id);

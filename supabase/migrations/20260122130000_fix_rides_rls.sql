-- Fix RLS policies to allow "Broadcast" rides (driver_id IS NULL)
-- and allow drivers to claim (UPDATE) these rides.

-- 1. Relax INSERT Policy
DROP POLICY IF EXISTS "Customers can create rides" ON public.rides;

CREATE POLICY "Customers can create rides" ON public.rides
FOR INSERT WITH CHECK (
  -- Allow if the user is the customer linked to the ride
  customer_id IN (
    SELECT id FROM public.users 
    WHERE auth_id = auth.uid()
  )
);

-- 2. Fix UPDATE Policy for Drivers (to allow claiming unassigned rides)
DROP POLICY IF EXISTS "Drivers can update rides" ON public.rides;

CREATE POLICY "Drivers can update rides" ON public.rides
FOR UPDATE USING (
  -- Allow if:
  -- 1. User is the assigned driver
  driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'driver'::user_role)
  OR
  -- 2. Ride is pending (Broadcast mode) - ANY driver can try to update it (to claim it)
  (status = 'pending'::ride_status)
  OR
  -- 3. User is the customer (to cancel etc)
  customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

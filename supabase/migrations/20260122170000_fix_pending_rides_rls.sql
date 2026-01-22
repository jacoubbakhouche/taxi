-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Drivers can view pending rides" ON public.rides;

-- Re-create with stricter checks
CREATE POLICY "Drivers can view pending rides" ON public.rides
FOR SELECT USING (
  status = 'pending'::ride_status 
  AND (
    driver_id IS NULL 
    OR driver_id = auth.uid()
  )
);

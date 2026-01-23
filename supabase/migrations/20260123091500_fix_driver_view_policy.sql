DROP POLICY IF EXISTS "Drivers can view pending rides" ON public.rides;

CREATE POLICY "Drivers can view pending rides" ON public.rides
FOR SELECT USING (
  status = 'pending'::ride_status 
  AND (
    driver_id IS NULL 
    OR 
    driver_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  )
);

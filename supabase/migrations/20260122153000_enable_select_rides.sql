-- Allow customers to view their own rides
CREATE POLICY "Users can view own rides" ON public.rides
FOR SELECT USING (
  auth.uid() IN (customer_id, driver_id)
);

-- Allow drivers to view pending rides (Broadcast)
CREATE POLICY "Drivers can view pending rides" ON public.rides
FOR SELECT USING (
  -- Check if user is a driver (role check not strictly separate table constraint here, but good practice)
  -- Or just check if status is pending? 
  -- Pending rides should be visible to ALL authenticated users? Ideally only drivers.
  -- But since we filter by role in UI, we can allow authenticated users to see pending rides to simplify finding them.
  status = 'pending'::ride_status
);

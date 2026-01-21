-- Allow drivers to view customer information for their pending/accepted rides
CREATE POLICY "Drivers can view customer info for rides"
ON public.users
FOR SELECT
USING (
  id IN (
    SELECT customer_id FROM rides 
    WHERE (driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
    OR (status = 'pending')
  )
);
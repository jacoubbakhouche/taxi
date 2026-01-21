-- Drop the existing restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Customers can create rides" ON public.rides;

CREATE POLICY "Customers can create rides" 
ON public.rides 
FOR INSERT 
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT users.id
    FROM users
    WHERE users.auth_id = auth.uid() AND users.role = 'customer'
  )
);
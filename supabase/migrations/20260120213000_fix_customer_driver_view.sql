-- Fix permission for customers to view their driver's info
-- Prevents UI from failing to load driver details after ride acceptance

CREATE POLICY "Customers can view assigned driver"
ON public.users
FOR SELECT
USING (
  id IN (
    SELECT driver_id FROM public.rides 
    WHERE customer_id = public.get_current_user_id()
  )
);

-- Allow ANYONE (including anonymous) to VIEW all users (Admin Dashboard)
DROP POLICY IF EXISTS "Public can view users" ON public.users;
CREATE POLICY "Public can view users" ON public.users
  FOR SELECT USING (true);

-- Allow ANYONE to UPDATE users (Admin Actions: Verify/Ban)
-- Note: This is highly insecure but requested for "Direct Access" mode without auth.
DROP POLICY IF EXISTS "Public can update users" ON public.users;
CREATE POLICY "Public can update users" ON public.users
  FOR UPDATE USING (true);

-- Ensure RLS doesn't block Insert if needed (User Signup handles this usually)
-- But pure admin might need it? Usually not.

-- Also ensure 'rides' are viewable if we show stats?
DROP POLICY IF EXISTS "Public can view all rides" ON public.rides;
CREATE POLICY "Public can view all rides" ON public.rides
  FOR SELECT USING (true);

-- Add vehicle_type column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_type text;

-- Optional: Create an update policy if needed (but drivers can update their own profile already)
-- The existing policy for 'users' UPDATE usually handles (id = auth.uid())


-- Add subscription_end_date to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ;

-- Allow admins to update this column (covered by existing policy, but good to note)

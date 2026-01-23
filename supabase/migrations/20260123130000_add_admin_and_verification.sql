-- Add verification and admin columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Creating a policy for Admins?
-- For now, we keep it simple. We will rely on the is_admin column in the UI.
-- (RLS policies can be enhanced later to strictly forbid non-admins from reading other users)

-- Update driver policy to allow them to be seen only if verified?
-- Actually for now, let's just use the column.

-- Set default Verified to TRUE for existing drivers to avoid disrupting current demo
UPDATE public.users SET is_verified = true WHERE role = 'driver';

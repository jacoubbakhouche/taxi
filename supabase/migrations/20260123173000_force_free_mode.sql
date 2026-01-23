-- Force Enable Free Mode for everyone
UPDATE public.users 
SET is_verified = true
WHERE role = 'driver';

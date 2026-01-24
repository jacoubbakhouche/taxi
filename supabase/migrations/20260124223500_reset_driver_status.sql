-- Reset all drivers to 'offline' and clear location
-- This clears "Zombie Drivers" who closed the app without logging out
UPDATE public.users
SET 
  is_online = false,
  current_lat = NULL,
  current_lng = NULL
WHERE role = 'driver';

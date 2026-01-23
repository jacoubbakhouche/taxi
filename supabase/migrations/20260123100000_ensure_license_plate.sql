-- Ensure car details columns exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS car_model text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS license_plate text;

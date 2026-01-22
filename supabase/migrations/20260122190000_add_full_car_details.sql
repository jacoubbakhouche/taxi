-- Add comprehensive car details
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS car_model text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_color text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_class text DEFAULT 'standard';

-- Create an optional type if we wanted strict enums, but text is more flexible for now
-- 'standard': Economic, small cars
-- 'comfort': Sedans, spacious
-- 'luxury': High-end cars

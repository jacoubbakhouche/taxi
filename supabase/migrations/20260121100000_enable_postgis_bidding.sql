-- Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Create Enums (Idempotent)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ride_status AS ENUM ('pending', 'negotiating', 'accepted', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- DROP CONFLICTING POLICIES (Required to Alter Columns)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can create rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view pending rides" ON public.rides;
DROP POLICY IF EXISTS "Users can view own rides" ON public.rides;

-- CRITICAL FIX: Drop policies on USERS that depend on rides.status or users.role
DROP POLICY IF EXISTS "Drivers can view customer info for rides" ON public.users;
DROP POLICY IF EXISTS "Customers can view assigned driver" ON public.users;

-- -----------------------------------------------------------------------------
-- UPDATE USERS TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rating float DEFAULT 5.0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Temporarily disable the check constraint on role if it exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Cast role column to enum
-- First drop default if exists (unlikely but safe)
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN role TYPE user_role USING role::user_role;
-- Set default back if needed (default to customer)
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'customer'::user_role;

-- -----------------------------------------------------------------------------
-- UPDATE RIDES TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pickup_location geography(Point, 4326);
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS destination_location geography(Point, 4326);
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS offered_price float;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS final_price float;

-- Drop check constraint on status before altering type
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

-- Drop default value for status to allow type conversion (Fixes ERROR: 42804)
ALTER TABLE public.rides ALTER COLUMN status DROP DEFAULT;

-- Migrate Status to Enum
ALTER TABLE public.rides 
ALTER COLUMN status TYPE ride_status 
USING (
  CASE 
    WHEN status = 'started' THEN 'in_progress'::ride_status 
    ELSE status::ride_status 
  END
);

-- Re-set default value with correct Enum type
ALTER TABLE public.rides ALTER COLUMN status SET DEFAULT 'pending'::ride_status;

-- Migrate Lat/Lng to Geography (for existing rows)
UPDATE public.rides 
SET pickup_location = ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326) 
WHERE pickup_location IS NULL;

UPDATE public.rides 
SET destination_location = ST_SetSRID(ST_MakePoint(destination_lng, destination_lat), 4326) 
WHERE destination_location IS NULL;

-- Initial offered_price migration
UPDATE public.rides SET offered_price = price WHERE offered_price IS NULL;

-- -----------------------------------------------------------------------------
-- RE-CREATE DROPPED POLICIES (With ENUM Casting)
-- -----------------------------------------------------------------------------

-- Rides Table Policies
CREATE POLICY "Customers can create rides" ON public.rides
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'customer'::user_role)
  );

CREATE POLICY "Drivers can update rides" ON public.rides
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'driver'::user_role) OR
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Drivers can view pending rides" ON public.rides
  FOR SELECT USING (status = 'pending'::ride_status);

CREATE POLICY "Users can view own rides" ON public.rides
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Users Table Policies (The ones that caused the error)
CREATE POLICY "Drivers can view customer info for rides"
ON public.users
FOR SELECT
USING (
  id IN (
    SELECT customer_id FROM rides 
    WHERE driver_id = public.get_current_user_id()
    OR (status = 'pending'::ride_status AND (SELECT role FROM public.users WHERE id = public.get_current_user_id()) = 'driver'::user_role)
  )
);

CREATE POLICY "Customers can view assigned driver"
ON public.users
FOR SELECT
USING (
  id IN (
    SELECT driver_id FROM public.rides 
    WHERE customer_id = public.get_current_user_id()
  )
);

-- -----------------------------------------------------------------------------
-- CREATE RIDE OFFERS TABLE (For Bidding)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ride_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount FLOAT NOT NULL,
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for offers
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

-- Policies for Ride Offers
DROP POLICY IF EXISTS "Drivers can create offers" ON public.ride_offers;
CREATE POLICY "Drivers can create offers" ON public.ride_offers
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'driver'::user_role)
  );

DROP POLICY IF EXISTS "Drivers can view own offers" ON public.ride_offers;
CREATE POLICY "Drivers can view own offers" ON public.ride_offers
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Customers can view offers for their rides" ON public.ride_offers;
CREATE POLICY "Customers can view offers for their rides" ON public.ride_offers
  FOR SELECT USING (
    ride_id IN (SELECT id FROM public.rides WHERE customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------

-- Trigger to Sync Legacy Lat/Lng with Geography for Rides
CREATE OR REPLACE FUNCTION sync_rides_location() RETURNS TRIGGER AS $$
BEGIN
  -- Sync Float -> Geography
  IF NEW.pickup_lng IS NOT NULL AND NEW.pickup_lat IS NOT NULL THEN
      NEW.pickup_location = ST_SetSRID(ST_MakePoint(NEW.pickup_lng, NEW.pickup_lat), 4326);
  END IF;
  
  IF NEW.destination_lng IS NOT NULL AND NEW.destination_lat IS NOT NULL THEN
      NEW.destination_location = ST_SetSRID(ST_MakePoint(NEW.destination_lng, NEW.destination_lat), 4326);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rides_location_sync ON public.rides;
CREATE TRIGGER rides_location_sync
BEFORE INSERT OR UPDATE OF pickup_lat, pickup_lng, destination_lat, destination_lng ON public.rides
FOR EACH ROW EXECUTE FUNCTION sync_rides_location();

-- Function to find nearby drivers
-- FIXED: Renamed input parameters to avoid conflict with output column names
CREATE OR REPLACE FUNCTION get_nearby_drivers(
  p_lat float,
  p_lng float,
  p_radius_meters float
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  avatar_url text,
  rating float,
  lat float,
  lng float,
  dist_meters float
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id, 
    u.full_name, 
    u.phone, 
    u.avatar_url, 
    u.rating, 
    st_y(u.location::geometry) as lat, 
    st_x(u.location::geometry) as lng,
    ST_Distance(u.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) as dist_meters
  FROM public.users u
  WHERE 
    u.role = 'driver'::user_role
    AND u.is_online = true
    AND ST_DWithin(u.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), p_radius_meters);
END;
$$ LANGUAGE plpgsql;

-- Function to update driver location
-- FIXED: Renamed input parameters for consistency
CREATE OR REPLACE FUNCTION update_driver_location(p_lat float, p_lng float)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET 
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    is_online = true 
  WHERE auth_id = auth.uid() AND role = 'driver'::user_role;
END;
$$ LANGUAGE plpgsql;

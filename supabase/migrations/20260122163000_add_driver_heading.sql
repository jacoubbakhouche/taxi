-- Add heading column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS heading float DEFAULT 0.0;

-- Update get_nearby_drivers to return heading
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
  heading float,
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
    COALESCE(u.heading, 0.0) as heading,
    ST_Distance(u.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) as dist_meters
  FROM public.users u
  WHERE 
    u.role = 'driver'::user_role
    AND u.is_online = true
    AND ST_DWithin(u.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), p_radius_meters);
END;
$$ LANGUAGE plpgsql;

-- Update update_driver_location to accept heading
CREATE OR REPLACE FUNCTION update_driver_location(
  p_lat float, 
  p_lng float,
  p_heading float DEFAULT 0.0
)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET 
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    heading = p_heading,
    is_online = true 
  WHERE auth_id = auth.uid() AND role = 'driver'::user_role;
END;
$$ LANGUAGE plpgsql;

-- Drop valid function if exists to avoid signature conflicts
DROP FUNCTION IF EXISTS match_drivers_for_ride;

CREATE OR REPLACE FUNCTION match_drivers_for_ride(
  client_lat float,
  client_long float,
  radius_km int DEFAULT 5,
  limit_count int DEFAULT 10,
  excluded_driver_ids uuid[] DEFAULT '{}'
)
RETURNS TABLE (
  driver_id uuid,
  driver_name text,
  lat float,
  long float,
  distance_meters float,
  fcm_token text,
  rating float,
  car_model text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as driver_id,
    u.full_name as driver_name,
    u.current_lat as lat,
    u.current_lng as long,
    ST_Distance(
      u.location,
      ST_SetSRID(ST_MakePoint(client_long, client_lat), 4326)::geography
    ) as distance_meters,
    'dummy_token'::text as fcm_token,
    u.rating,
    u.car_model,
    u.phone
  FROM public.users u
  WHERE 
    u.role = 'driver' 
    AND u.is_online = true
    AND u.is_verified = true
    -- Exclude drivers in the blacklist
    AND (excluded_driver_ids IS NULL OR NOT (u.id = ANY(excluded_driver_ids)))
    AND ST_DWithin(
      u.location,
      ST_SetSRID(ST_MakePoint(client_long, client_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$;

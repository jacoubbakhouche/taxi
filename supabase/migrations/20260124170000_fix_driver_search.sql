create or replace function get_nearby_drivers(lat float, lng float)
returns table (
  id uuid,
  full_name text,
  current_lat float,
  current_lng float,
  car_model text,
  rating float,
  phone text,
  dist_km float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    u.id,
    u.full_name,
    u.current_lat,
    u.current_lng,
    u.car_model,
    u.rating,
    u.phone,
    (
      6371 * acos(
        cos(radians(lat)) * cos(radians(u.current_lat)) *
        cos(radians(u.current_lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(u.current_lat))
      )
    ) as dist_km
  from users u
  where
    u.role = 'driver'
    and u.is_online = true
    -- Ensure driver is verified (important!)
    and u.is_verified = true
    -- Check if updated recently (e.g., within last 24 hours to be safe, but ideally 10 mins)
    -- Relaxing this to 24 hours for testing.
    and u.updated_at > (now() - interval '24 hours')
    -- Radius: 50km (Large enough for testing)
    and (
      6371 * acos(
        cos(radians(lat)) * cos(radians(u.current_lat)) *
        cos(radians(u.current_lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(u.current_lat))
      )
    ) < 50
  order by dist_km asc;
end;
$$;

-- 1. Enable PostGIS Extension
create extension if not exists postgis;

-- 2. Add 'location' column of type Geography (Point)
alter table public.users add column if not exists location geography(point);

-- 3. Create Index for fast spatial search
create index if not exists users_location_idx on public.users using gist (location);

-- 4. Sync Function: Keep 'location' updated when 'current_lat'/'current_lng' change
create or replace function sync_location_column()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.current_lat is not null and new.current_lng is not null then
    new.location := ST_SetSRID(ST_MakePoint(new.current_lng, new.current_lat), 4326)::geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

-- 5. Attach Sync Trigger
drop trigger if exists on_location_update on public.users;
create trigger on_location_update
before insert or update of current_lat, current_lng on public.users
for each row
execute function sync_location_column();

-- 6. Helper: Backfill existing data
update public.users 
set location = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography
where current_lat is not null and current_lng is not null;

-- 7. The Main Matching Function (RPC)
create or replace function match_drivers_for_ride(
  client_lat float,
  client_long float,
  radius_km int default 5,
  limit_count int default 10
)
returns table (
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
language plpgsql
security definer
as $$
begin
  return query
  select 
    u.id as driver_id,
    u.full_name as driver_name,
    u.current_lat as lat,
    u.current_lng as long,
    ST_Distance(
      u.location,
      ST_SetSRID(ST_MakePoint(client_long, client_lat), 4326)::geography
    ) as distance_meters,
    'dummy_token'::text as fcm_token, -- Placeholder until FCM integrated
    u.rating,
    u.car_model,
    u.phone
  from public.users u
  where 
    u.role = 'driver' 
    and u.is_online = true
    and u.is_verified = true
    -- and u.status = 'free' -- Assuming we will add 'status' column later or use existing logic
    and ST_DWithin(
      u.location,
      ST_SetSRID(ST_MakePoint(client_long, client_lat), 4326)::geography,
      radius_km * 1000
    )
  order by distance_meters asc
  limit limit_count;
end;
$$;

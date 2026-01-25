-- 1. Add Filter Columns for Hybrid Roles
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_driver_registered boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_customer_registered boolean DEFAULT false;

-- 2. Migrate Old Data
-- Drivers are both Drivers and Customers (potential)
UPDATE public.users 
SET is_driver_registered = true, 
    is_customer_registered = true 
WHERE role = 'driver';

-- Customers are just Customers (until they upgrade)
UPDATE public.users 
SET is_customer_registered = true 
WHERE role = 'customer';

-- Ensure new columns are not null for future queries
ALTER TABLE public.users ALTER COLUMN is_driver_registered SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN is_customer_registered SET NOT NULL;


-- 3. Upgrade Function (for Hybrid Auth)
CREATE OR REPLACE FUNCTION register_as_driver()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET is_driver_registered = true,
      -- If they are upgrading, they might get free trial / or default verification state
      is_verified = false, -- Require docs for new driver role
      is_online = false
  WHERE id = auth.uid();
  
  RETURN true;
END;
$$;


-- 4. UPDATE CORE LOGIC: match_drivers_for_ride
-- Replace 'role = driver' with 'is_driver_registered = true'
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
declare
  is_premium_active boolean;
begin
  -- Get the global setting
  select premium_mode_enabled into is_premium_active from public.app_settings limit 1;

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
    u.is_driver_registered = true -- <--- CHANGED FROM role='driver'
    AND u.is_online = true
    AND u.is_suspended = false
    
    -- FREEMIUM LOGIC:
    AND (
      is_premium_active = false 
      OR 
      u.is_verified = true
    )

    -- Blacklist Logic
    AND (excluded_driver_ids IS NULL OR NOT (u.id = ANY(excluded_driver_ids)))
    
    -- Spatial Logic
    AND ST_DWithin(
      u.location,
      ST_SetSRID(ST_MakePoint(client_long, client_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$;


-- 5. UPDATE ADMIN RPC: get_admin_users_paginated
-- Replace 'role = driver' with 'is_driver_registered = true'
DROP FUNCTION IF EXISTS get_admin_users_paginated;

CREATE OR REPLACE FUNCTION get_admin_users_paginated(
  page_number int default 1,
  page_size int default 20,
  search_query text default '',
  status_filter text default 'all'
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  role text, -- Keeping column name for frontend compatibility, but value might be hybrid
  is_verified boolean,
  subscription_end_date timestamptz,
  accumulated_commission numeric,
  documents_submitted boolean,
  profile_image text,
  car_model text,
  license_plate text,
  created_at timestamptz,
  total_count bigint,
  is_suspended boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  offset_val int;
begin
  offset_val := (page_number - 1) * page_size;

  return query
  with filtered_users as (
    select *, count(*) over() as full_count
    from public.users u
    where 
      u.is_driver_registered = true -- <--- CHANGED
      and (
        search_query = '' or 
        u.full_name ilike '%' || search_query || '%' or
        u.phone ilike '%' || search_query || '%'
      )
      and (
        case status_filter
          when 'verified' then u.is_verified = true
          when 'pending' then u.is_verified = false and u.documents_submitted = true
          when 'expired' then (u.subscription_end_date < now() or u.subscription_end_date is null)
          else true -- 'all'
        end
      )
  )
  select 
    f.id, f.full_name, f.phone, f.role::text, f.is_verified, 
    f.subscription_end_date, f.accumulated_commission::numeric, 
    f.documents_submitted, f.profile_image, f.car_model, 
    f.license_plate, f.created_at,
    f.full_count,
    f.is_suspended
  from filtered_users f
  order by f.created_at desc
  limit page_size
  offset offset_val;
end;
$$;


-- 6. UPDATE DASHBOARD KPI
CREATE OR REPLACE FUNCTION get_dashboard_kpi()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  total_drivers int;
  pending_verification int;
  active_subscriptions int;
  total_revenue numeric;
  expired_subs int;
begin
  select count(*) into total_drivers from public.users where is_driver_registered = true; -- <--- CHANGED
  
  select count(*) into pending_verification 
  from public.users 
  where is_driver_registered = true and is_verified = false and documents_submitted = true; -- <--- CHANGED

  select count(*) into active_subscriptions
  from public.users
  where is_driver_registered = true and subscription_end_date > now(); -- <--- CHANGED

  select count(*) into expired_subs
  from public.users
  where is_driver_registered = true and (subscription_end_date < now() or subscription_end_date is null); -- <--- CHANGED

  -- Sum revenue from history
  select coalesce(sum(amount), 0) into total_revenue from public.payment_history;

  return jsonb_build_object(
    'total_drivers', total_drivers,
    'pending_verification', pending_verification,
    'active_subscriptions', active_subscriptions,
    'expired_subscriptions', expired_subs,
    'total_revenue', total_revenue
  );
end;
$$;

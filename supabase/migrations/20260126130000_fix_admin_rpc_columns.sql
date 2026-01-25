-- RPC for Admin Users Pagination (Updated to include document URLs)
-- This fixes the issue where document images were missing in the admin drawer.

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
  role text,
  is_verified boolean,
  subscription_end_date timestamptz,
  accumulated_commission numeric,
  documents_submitted boolean,
  profile_image text,
  car_model text,
  license_plate text,
  created_at timestamptz,
  total_count bigint,
  is_suspended boolean,
  driving_license_url text, -- <--- ADDED
  carte_grise_url text      -- <--- ADDED
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
      u.is_driver_registered = true 
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
    f.id, 
    f.full_name, 
    f.phone, 
    f.role::text, 
    COALESCE(f.is_verified, false), 
    f.subscription_end_date, 
    f.accumulated_commission::numeric, 
    COALESCE(f.documents_submitted, false), 
    f.profile_image, 
    f.car_model, 
    f.license_plate, 
    f.created_at,
    f.full_count,
    COALESCE(f.is_suspended, false),
    f.driving_license_url, -- <--- MAPPED
    f.carte_grise_url      -- <--- MAPPED
  from filtered_users f
  order by f.created_at desc
  limit page_size
  offset offset_val;
end;
$$;

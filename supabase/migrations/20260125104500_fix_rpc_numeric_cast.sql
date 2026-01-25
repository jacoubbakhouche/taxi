-- FINAL FIX: Cast accumulated_commission to numeric
-- The column in 'users' is double precision (float), but RPC expects numeric.
-- We will cast it explicitly.

DROP FUNCTION IF EXISTS get_admin_users_paginated(int, int, text, text);

create or replace function get_admin_users_paginated(
  page_number int default 1,
  page_size int default 20,
  search_query text default '',
  status_filter text default 'all'
)
returns table (
  id uuid,
  full_name text,
  phone text,
  role text,
  is_verified boolean,
  subscription_end_date timestamptz,
  accumulated_commission numeric, -- We keep this as numeric for cleaner JSON
  documents_submitted boolean,
  profile_image text,
  car_model text,
  license_plate text,
  created_at timestamptz,
  is_suspended boolean,
  total_count bigint
)
language plpgsql
security definer
as $$
declare
  offset_val int;
begin
  offset_val := (page_number - 1) * page_size;

  return query
  with filtered_users as (
    select *, count(*) over() as full_count
    from public.users u
    where 
      u.role = 'driver'
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
    f.role::text,                 -- Cast Enum to Text
    f.is_verified, 
    f.subscription_end_date, 
    f.accumulated_commission::numeric, -- <--- FINAL FIX: Cast Float to Numeric
    f.documents_submitted, 
    f.profile_image, 
    f.car_model, 
    f.license_plate, 
    f.created_at,
    f.is_suspended,
    f.full_count
  from filtered_users f
  order by f.created_at desc
  limit page_size
  offset offset_val;
end;
$$;

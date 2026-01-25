-- 1. Payment History Table (Audit Trail)
create table if not exists public.payment_history (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.users(id) not null,
  admin_id uuid references public.users(id), -- Nullable if system action
  amount numeric not null default 0,
  commission_cleared numeric default 0,
  months_added int default 1,
  operation_type text default 'renewal', -- 'renewal', 'fine', 'bonus'
  created_at timestamptz default now()
);

-- RLS: Only admins can view/insert payments
alter table public.payment_history enable row level security;
create policy "Admins can view all payments" on public.payment_history for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
create policy "Admins can insert payments" on public.payment_history for insert with check (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);


-- 2. Smart Renewal Function (Transaction)
create or replace function admin_renew_subscription(
  target_driver_id uuid,
  months_to_add int,
  admin_user_id uuid,
  payment_amount numeric default 0
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_end_date timestamptz;
  new_end_date timestamptz;
  cleared_comm numeric;
begin
  -- Check if admin (optional extra security, RLS handles it but good practice)
  -- if not exists (select 1 from users where id = admin_user_id and role = 'admin') then
  --   raise exception 'Unauthorized';
  -- end if;

  -- Get current subscription state
  select subscription_end_date, accumulated_commission 
  into current_end_date, cleared_comm
  from public.users where id = target_driver_id;

  -- Calculate new date
  if current_end_date is null or current_end_date < now() then
    -- Start fresh from NOW
    new_end_date := now() + (months_to_add || ' months')::interval;
  else
    -- Extend existing
    new_end_date := current_end_date + (months_to_add || ' months')::interval;
  end if;

  -- Update User: Extend date + Clear Commission + Verify
  update public.users
  set 
    subscription_end_date = new_end_date,
    accumulated_commission = 0, -- Reset commission debt
    is_verified = true,         -- Ensure they are active
    status = 'approved'         -- Sync legacy status column if exists
  where id = target_driver_id;

  -- Log Payment
  insert into public.payment_history (
    driver_id, admin_id, amount, commission_cleared, months_added
  ) values (
    target_driver_id, admin_user_id, payment_amount, coalesce(cleared_comm, 0), months_to_add
  );

  return jsonb_build_object(
    'new_end_date', new_end_date,
    'commission_cleared', cleared_comm
  );
end;
$$;


-- 3. Pagination & Search Function
create or replace function get_admin_users_paginated(
  page_number int default 1,
  page_size int default 20,
  search_query text default '',
  status_filter text default 'all' -- 'all', 'verified', 'pending', 'expired'
)
returns table (
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
    f.id, f.full_name, f.phone, f.role, f.is_verified, 
    f.subscription_end_date, f.accumulated_commission, 
    f.documents_submitted, f.profile_image, f.car_model, 
    f.license_plate, f.created_at,
    f.full_count
  from filtered_users f
  order by f.created_at desc
  limit page_size
  offset offset_val;
end;
$$;


-- 4. Fast KPI Stats Function
create or replace function get_dashboard_kpi()
returns jsonb
language plpgsql
security definer
as $$
declare
  total_drivers int;
  pending_verification int;
  active_subscriptions int;
  total_revenue numeric;
  expired_subs int;
begin
  select count(*) into total_drivers from public.users where role = 'driver';
  
  select count(*) into pending_verification 
  from public.users 
  where role = 'driver' and is_verified = false and documents_submitted = true;

  select count(*) into active_subscriptions
  from public.users
  where role = 'driver' and subscription_end_date > now();

  select count(*) into expired_subs
  from public.users
  where role = 'driver' and (subscription_end_date < now() or subscription_end_date is null);

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

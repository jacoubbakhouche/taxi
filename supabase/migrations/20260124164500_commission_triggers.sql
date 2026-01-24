-- 1. Add accumulated_commission column
alter table users 
add column if not exists accumulated_commission float default 0;

-- 2. Trigger Function: Calculate Commission on Ride Completion
create or replace function calculate_commission_on_completion()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only run if status changed to 'completed'
  if new.status = 'completed' and (old.status is null or old.status != 'completed') then
    update users
    set accumulated_commission = coalesce(accumulated_commission, 0) + (new.price * 0.10)
    where id = new.driver_id;
  end if;
  return new;
end;
$$;

-- Drop trigger if exists to avoid duplication errors
drop trigger if exists on_ride_completed_commission on rides;

create trigger on_ride_completed_commission
after update on rides
for each row
execute function calculate_commission_on_completion();

-- 3. Trigger Function: Reset Commission on Subscription Renewal
create or replace function reset_commission_on_renewal()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Check if subscription_end_date changed
  if new.subscription_end_date is distinct from old.subscription_end_date then
    -- Reset commission to 0
    new.accumulated_commission := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists on_subscription_renewed_reset on users;

create trigger on_subscription_renewed_reset
before update on users
for each row
execute function reset_commission_on_renewal();

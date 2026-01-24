create or replace function get_driver_monthly_stats(driver_uuid uuid)
returns json
language plpgsql
security definer
as $$
declare
  start_of_month timestamp;
  end_of_month timestamp;
  total_earnings numeric;
  commission numeric;
begin
  -- Calculate start of current month (e.g., 2026-01-01 00:00:00)
  start_of_month := date_trunc('month', now());
  
  -- Calculate sum of completed rides for this driver in this month
  select coalesce(sum(price), 0)
  into total_earnings
  from rides
  where driver_id = driver_uuid
    and status = 'completed'
    and created_at >= start_of_month;

  -- Calculate 10% commission
  commission := total_earnings * 0.10;

  return json_build_object(
    'month_earnings', total_earnings,
    'commission', commission,
    'month_name', to_char(now(), 'Month YYYY')
  );
end;
$$;

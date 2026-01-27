CREATE OR REPLACE FUNCTION renew_driver_subscription(target_driver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Reset Debt
  UPDATE users
  SET 
    accumulated_commission = 0,
    is_suspended = FALSE,
    subscription_end_date = NOW() + INTERVAL '1 month'
  WHERE id = target_driver_id;

  -- 2. Log Payment (Optional - Create history table if needed, skipping for now as per instructions "if it exists")
  -- We assume a 'payment_history' table might not exist yet, so we just perform the update.
  
END;
$$;

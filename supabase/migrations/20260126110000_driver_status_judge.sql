-- The "Judge" Function in SQL
-- This function decides the driver's status based on strict order of operations.

CREATE OR REPLACE FUNCTION get_driver_status(driver_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  u_record RECORD;
  is_premium_mode boolean;
BEGIN
  -- 1. Fetch User Data
  SELECT * INTO u_record FROM public.users WHERE id = driver_id;
  
  -- 2. Fetch Global Settings
  SELECT premium_mode_enabled INTO is_premium_mode FROM public.app_settings LIMIT 1;

  -- 3. THE LOGIC LADDER (Strict Order)

  -- Barrier 1: Suspended?
  IF u_record.is_suspended THEN
    RETURN 'suspended';
  END IF;

  -- Barrier 2: Freemium Mode? (If Premium is OFF, everyone passes here)
  IF is_premium_mode = false THEN
    RETURN 'active'; -- Freemium = No more checks needed
  END IF;

  -- Barrier 3: Documents Uploaded?
  IF u_record.documents_submitted = false THEN
    RETURN 'upload_documents';
  END IF;

  -- Barrier 4: Verified by Admin?
  IF u_record.is_verified = false THEN
    RETURN 'pending_approval';
  END IF;

  -- Barrier 5: Subscription Valid?
  -- (Checks if date is null OR in the past)
  IF u_record.subscription_end_date IS NULL OR u_record.subscription_end_date < now() THEN
    RETURN 'payment_required';
  END IF;

  -- 6. All Clear
  RETURN 'active';

END;
$$;

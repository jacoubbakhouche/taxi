-- The "Judge" Function in SQL (Revised with COALESCE)
-- This function decides the driver's status based on strict order of operations.
-- Now handles NULL values robustly to prevent logic fall-through.

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

  -- -----------------------------------------------------------
  -- THE LOGIC LADDER (Strict Order)
  -- -----------------------------------------------------------

  -- 1. Suspended? (Always First)
  -- Use COALESCE to treat NULL as false
  IF COALESCE(u_record.is_suspended, false) = true THEN
    RETURN 'suspended';
  END IF;

  -- 2. Freemium Mode? (If Enabled/False/Null, assume Freemium if logic dictates, or strictly follow setting)
  -- Logic: If premium_mode_enabled is FALSE (or NULL usually defaults to non-blocking in earlier logic, let's treat NULL as FALSE for 'free mode default' safety)
  IF COALESCE(is_premium_mode, false) = false THEN
    RETURN 'active'; -- Freemium = No more checks needed
  END IF;

  -- 3. Documents Uploaded? (FIX: Handle NULLs)
  -- This was the bug: NULL = false fails. COALESCE(NULL, false) = false passes equality check.
  IF COALESCE(u_record.documents_submitted, false) = false THEN
    RETURN 'upload_documents';
  END IF;

  -- 4. Verified by Admin?
  IF COALESCE(u_record.is_verified, false) = false THEN
    RETURN 'pending_approval';
  END IF;

  -- 5. Subscription Valid?
  -- (Checks if date is null OR in the past)
  IF u_record.subscription_end_date IS NULL OR u_record.subscription_end_date < now() THEN
    RETURN 'payment_required';
  END IF;

  -- 6. All Clear
  RETURN 'active';

END;
$$;

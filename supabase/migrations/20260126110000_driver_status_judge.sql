-- The "Judge" Function in SQL (Revised with Golden Ticket Logic)
-- "Verified" status now acts as a Golden Ticket bypass for document checks.

CREATE OR REPLACE FUNCTION get_driver_status(driver_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  u_record RECORD;
  is_premium_mode boolean;
  is_driver_verified boolean;
BEGIN
  -- 1. Fetch User Data
  SELECT * INTO u_record FROM public.users WHERE id = driver_id;
  
  -- 2. Fetch Global Settings
  SELECT premium_mode_enabled INTO is_premium_mode FROM public.app_settings LIMIT 1;

  is_driver_verified := COALESCE(u_record.is_verified, false);

  -- -----------------------------------------------------------
  -- THE LOGIC LADDER (Strict Order)
  -- -----------------------------------------------------------

  -- 1. Suspended? (Always First - Blocks Everyone)
  IF COALESCE(u_record.is_suspended, false) = true THEN
    RETURN 'suspended';
  END IF;

  -- 2. Freemium Mode? (Free Pass for Everyone)
  IF COALESCE(is_premium_mode, false) = false THEN
    RETURN 'active';
  END IF;

  -- 3. THE GOLDEN TICKET CHECK
  -- If Verified, skip document checks and go straight to payment.
  -- This fixes the issue where manually verified drivers get stuck in 'upload_documents'.
  
  IF is_driver_verified = false THEN
      -- If NOT verified, enforce document upload first
      IF COALESCE(u_record.documents_submitted, false) = false THEN
        RETURN 'upload_documents';
      END IF;
      
      -- If documents submitted but not verified -> Pending
      RETURN 'pending_approval';
  END IF;

  -- 4. Subscription Valid? (Only for Verified Drivers)
  -- If we reached here, is_driver_verified is TRUE.
  IF u_record.subscription_end_date IS NULL OR u_record.subscription_end_date < now() THEN
    RETURN 'payment_required';
  END IF;

  -- 5. All Clear
  RETURN 'active';

END;
$$;

-- The "Judge" Function in SQL (Revised with Smart Priority Logic)
-- Fixes the issue where 'Payment Required' blocked the 'Upload Documents' prompt for Verified users with no subscription.

CREATE OR REPLACE FUNCTION get_driver_status(driver_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  u_record RECORD;
  is_premium_mode boolean;
  is_driver_verified boolean;
  is_sub_valid boolean;
  has_docs boolean;
BEGIN
  -- 1. Fetch User Data
  SELECT * INTO u_record FROM public.users WHERE id = driver_id;
  
  -- 2. Fetch Global Settings
  SELECT premium_mode_enabled INTO is_premium_mode FROM public.app_settings LIMIT 1;

  -- Normalize Booleans
  is_driver_verified := COALESCE(u_record.is_verified, false);
  has_docs := COALESCE(u_record.documents_submitted, false);
  
  -- Check Subscription Validity (Handle NULL as Invalid)
  is_sub_valid := (u_record.subscription_end_date IS NOT NULL AND u_record.subscription_end_date > now());

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

  -- 3. NOT VERIFIED Path
  IF is_driver_verified = false THEN
      -- Strict: Docs First, then Pending
      IF has_docs = false THEN
        RETURN 'upload_documents';
      END IF;
      RETURN 'pending_approval'; -- Docs submitted, waiting for admin
  END IF;

  -- 4. VERIFIED Path (Golden Ticket)
  -- Admin has verified this user.
  
  -- A. If Subscription is Valid -> ACTIVE.
  -- We trust the verified user completely if they have paid.
  IF is_sub_valid THEN
      RETURN 'active';
  END IF;

  -- B. If Subscription is Invalid / Null
  -- User needs to pay. BUT... what if they have no docs?
  -- Priority Fix: Ask for docs BEFORE asking for payment, avoiding the "Payment Block" confusion.
  
  IF has_docs = false THEN
      RETURN 'upload_documents';
  END IF;

  -- C. Default for Verified + Docs + No Sub
  RETURN 'payment_required';

END;
$$;

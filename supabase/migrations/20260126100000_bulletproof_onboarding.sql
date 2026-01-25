-- RPC for Bulletproof Driver Onboarding
-- This function runs with SECURITY DEFINER, bypassing RLS issues.

CREATE OR REPLACE FUNCTION complete_driver_profile(
    p_full_name text,
    p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- 1. Attempt Update (Upsert logic via DB)
  UPDATE public.users
  SET 
    full_name = p_full_name,
    phone = p_phone,
    is_driver_registered = true,
    is_verified = true, -- Free mode default
    role = 'driver', -- Maintain legacy
    updated_at = now()
  WHERE auth_id = auth.uid();

  -- 2. If row didn't exist (Trigger failed?), Insert it now
  IF NOT FOUND THEN
    INSERT INTO public.users (auth_id, full_name, phone, role, is_driver_registered, is_verified)
    VALUES (auth.uid(), p_full_name, p_phone, 'driver', true, true);
  END IF;

  RETURN true;
END;
$$;

-- Also fix RLS just in case, to be clean
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;
    CREATE POLICY "Users can manage own profile"
    ON public.users
    FOR ALL
    USING (auth.uid() = auth_id)
    WITH CHECK (auth.uid() = auth_id);
END
$$;

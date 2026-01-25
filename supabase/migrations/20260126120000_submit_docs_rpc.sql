-- RPC for Secure Document Submission
-- This bypasses RLS issues by running as SECURITY DEFINER
-- and ensures the Documents state is synced correctly to the DB.

CREATE OR REPLACE FUNCTION submit_driver_documents(
    p_license_url text,
    p_carte_grise_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Update the user record linked to the executing Auth User
  UPDATE public.users
  SET 
    driving_license_url = p_license_url,
    carte_grise_url = p_carte_grise_url,
    documents_submitted = true,
    updated_at = now()
  WHERE auth_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or permission denied';
  END IF;

  RETURN true;
END;
$$;

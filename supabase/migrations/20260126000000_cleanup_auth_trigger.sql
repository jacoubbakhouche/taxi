-- 1. FIX: Ensure auth_id is UNIQUE so UPSERT works in frontend
ALTER TABLE public.users ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);


-- 2. AUTOMATION: Trigger to create public Profile automatically on Google Login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_id, full_name, role, phone, is_driver_registered, is_customer_registered)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
    'customer', -- Default role
    '', -- Empty phone
    false, -- Not a driver yet
    true -- Is a customer
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

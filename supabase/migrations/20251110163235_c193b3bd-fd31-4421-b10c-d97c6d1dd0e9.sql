-- Fix function search path security issue
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
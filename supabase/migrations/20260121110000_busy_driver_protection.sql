-- 1. FIX: Ensure Users can view their own profile (Solves "Connection Error" if caused by RLS)
-- We check if the policy exists to avoid errors, or just use CREATE POLICY IF NOT EXISTS (Postgres 9.5+ syntax varies, better to drop/create)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT USING (auth.uid() = id);

-- 2. FEATURE: Busy Driver Protection Functions & Triggers

-- Helper Function: Check if driver is busy (has active ride)
CREATE OR REPLACE FUNCTION is_driver_busy(driver_uuid UUID, exclude_ride_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.rides
    WHERE driver_id = driver_uuid
    AND status IN ('accepted'::ride_status, 'in_progress'::ride_status)
    AND (exclude_ride_id IS NULL OR id != exclude_ride_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger Function: Prevent assigning a ride to a busy driver
CREATE OR REPLACE FUNCTION prevent_busy_driver_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if we are assigning a driver (driver_id changed or is new)
  IF (NEW.driver_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.driver_id IS DISTINCT FROM NEW.driver_id)) THEN
      IF is_driver_busy(NEW.driver_id, NEW.id) THEN 
          RAISE EXCEPTION 'Driver is currently busy with another ride.';
      END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Attach to rides table
DROP TRIGGER IF EXISTS check_driver_busy_rides ON public.rides;
CREATE TRIGGER check_driver_busy_rides
BEFORE INSERT OR UPDATE OF driver_id, status ON public.rides
FOR EACH ROW
WHEN (NEW.status IN ('accepted'::ride_status, 'in_progress'::ride_status))
EXECUTE FUNCTION prevent_busy_driver_assignment();

-- Trigger Function: Prevent busy driver from making an offer
CREATE OR REPLACE FUNCTION prevent_busy_driver_offer()
RETURNS TRIGGER AS $$
BEGIN
  IF is_driver_busy(NEW.driver_id) THEN
      RAISE EXCEPTION 'You cannot make an offer while you have an active ride.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Attach to ride_offers table
DROP TRIGGER IF EXISTS check_driver_busy_offer ON public.ride_offers;
CREATE TRIGGER check_driver_busy_offer
BEFORE INSERT ON public.ride_offers
FOR EACH ROW
EXECUTE FUNCTION prevent_busy_driver_offer();

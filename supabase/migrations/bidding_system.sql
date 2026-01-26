-- 1. Update 'rides' table (Safe check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'customer_offer_price') THEN
        ALTER TABLE rides ADD COLUMN customer_offer_price DECIMAL(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'final_price') THEN
        ALTER TABLE rides ADD COLUMN final_price DECIMAL(10,2);
    END IF;
END $$;

-- 2. Create 'ride_offers' table (Safe check)
CREATE TABLE IF NOT EXISTS ride_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies (Drop first to avoid duplication errors)
ALTER TABLE ride_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can insert offers" ON ride_offers;
DROP POLICY IF EXISTS "Drivers can view their own offers" ON ride_offers;
DROP POLICY IF EXISTS "Customers can view offers for their rides" ON ride_offers;

-- Re-create Policies
CREATE POLICY "Drivers can insert offers" 
ON ride_offers FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = (SELECT auth_id FROM users WHERE id = driver_id));

CREATE POLICY "Drivers can view their own offers" 
ON ride_offers FOR SELECT 
TO authenticated 
USING (auth.uid() = (SELECT auth_id FROM users WHERE id = driver_id));

CREATE POLICY "Customers can view offers for their rides" 
ON ride_offers FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM rides 
        WHERE id = ride_offers.ride_id 
        AND customer_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
);

-- 4. RPC Function to Accept an Offer (Critical Logic)
CREATE OR REPLACE FUNCTION accept_ride_offer(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_ride_id UUID;
  v_driver_id UUID;
  v_amount DECIMAL;
BEGIN
  -- Get offer details
  SELECT ride_id, driver_id, amount INTO v_ride_id, v_driver_id, v_amount
  FROM ride_offers WHERE id = p_offer_id;

  IF v_ride_id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  -- Update Ride (Assign Driver & Final Price)
  UPDATE rides
  SET 
    driver_id = v_driver_id,
    status = 'accepted',
    final_price = v_amount,
    updated_at = NOW()
  WHERE id = v_ride_id;

  -- Mark this offer as accepted
  UPDATE ride_offers
  SET status = 'accepted'
  WHERE id = p_offer_id;

  -- Reject other offers for this ride
  UPDATE ride_offers
  SET status = 'rejected'
  WHERE ride_id = v_ride_id AND id != p_offer_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

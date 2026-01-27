CREATE OR REPLACE FUNCTION accept_ride_offer(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_ride_id UUID;
  v_driver_id UUID;
  v_amount DECIMAL;
BEGIN
  -- 1. Get the Agreed Amount from the Offer
  SELECT ride_id, driver_id, amount INTO v_ride_id, v_driver_id, v_amount
  FROM ride_offers WHERE id = p_offer_id;

  IF v_ride_id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  -- 2. Update the Ride with the AGREED Price
  UPDATE rides
  SET 
    driver_id = v_driver_id,
    status = 'accepted',      -- Or 'IN_TRIP' based on your flow
    final_price = v_amount,   -- Set the specific final price
    price = v_amount,         -- CRITICAL: Overwrite the main price so the UI sees the new amount
    updated_at = NOW()
  WHERE id = v_ride_id;

  -- 3. Instant Cleanup (Delete offers as requested)
  DELETE FROM ride_offers WHERE ride_id = v_ride_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

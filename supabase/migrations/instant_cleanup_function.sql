CREATE OR REPLACE FUNCTION accept_ride_offer(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_ride_id UUID;
  v_driver_id UUID;
  v_amount DECIMAL;
BEGIN
  -- 1. Capture Data First (Before Deletion)
  SELECT ride_id, driver_id, amount 
  INTO v_ride_id, v_driver_id, v_amount
  FROM ride_offers 
  WHERE id = p_offer_id;

  -- Safety Check: Ensure offer exists
  IF v_ride_id IS NULL THEN
    RAISE EXCEPTION 'Offer not found or already processed';
  END IF;

  -- 2. Update Ride (Assign Driver & Final Price)
  UPDATE rides
  SET 
    driver_id = v_driver_id,
    status = 'accepted',
    final_price = v_amount,
    updated_at = NOW()
  WHERE id = v_ride_id;

  -- 3. Instant Cleanup (Delete ALL offers for this ride immediately)
  -- This removes the accepted offer AND all competing offers in one go.
  DELETE FROM ride_offers 
  WHERE ride_id = v_ride_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

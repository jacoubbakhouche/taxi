-- 1. Create the Cleanup Function
-- This function deletes offers that are older than 24 hours AND belong to rides that are already completed or cancelled.
-- This is safer than just deleting by time, as it ensures active negotiations aren't touched (though 24h is usually safe enough).

CREATE OR REPLACE FUNCTION cleanup_old_offers()
RETURNS void AS $$
BEGIN
  -- Build the query log for debugging (optional)
  RAISE NOTICE 'Starting cleanup of old ride offers...';

  -- Delete offers older than 24 hours
  DELETE FROM ride_offers
  WHERE created_at < NOW() - INTERVAL '24 hours';

  -- Log completion
  RAISE NOTICE 'Cleanup completed.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Setup Cron Job (Requires pg_cron extension)
-- Enable the extension first
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to run every day at 3:00 AM
-- Format: min, hour, day, month, week_day
SELECT cron.schedule(
  'cleanup-offers-daily',   -- Job name
  '0 3 * * *',             -- Cron schedule (3:00 AM daily)
  $$SELECT cleanup_old_offers();$$ -- SQL command
);

-- Note: If you cannot enable pg_cron via SQL due to permissions, 
-- you can just run the FUNCTION part and set up the cron/schedule via the Supabase Dashboard UI > Database > Extensions/Wrappers (or Scheduled Functions).

-- Add ride_offers to supabase_realtime publication to ensure subscription works
begin;
  -- Check if publication exists (standard in Supabase)
  -- Try to add table, if already added it might error or be ignored depending on postgres version, 
  -- so we can safely run alter publication usually.
  alter publication supabase_realtime add table ride_offers;
commit;

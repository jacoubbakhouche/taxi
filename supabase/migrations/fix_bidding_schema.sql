-- Fix ride_offers table: Ensure 'status' column exists and 'accepted' is gone if it exists
DO $$ 
BEGIN 
    -- 1. Add 'status' column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ride_offers' AND column_name = 'status') THEN
        ALTER TABLE ride_offers ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'));
    END IF;

    -- 2. Drop 'accepted' column if it exists (Cleaning up mismatch)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ride_offers' AND column_name = 'accepted') THEN
        ALTER TABLE ride_offers DROP COLUMN accepted;
    END IF;

    -- 3. Add 'is_bidding' column to 'rides' table for Hybrid System
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'is_bidding') THEN
        ALTER TABLE rides ADD COLUMN is_bidding BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

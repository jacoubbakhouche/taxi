-- Add driver-specific columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS current_lat double precision,
ADD COLUMN IF NOT EXISTS current_lng double precision,
ADD COLUMN IF NOT EXISTS rating double precision DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS total_rides integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_image text;

-- Add rating column to rides table
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS rating integer,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Enable realtime for rides table
ALTER PUBLICATION supabase_realtime ADD TABLE rides;

-- Set replica identity to full for real-time updates
ALTER TABLE rides REPLICA IDENTITY FULL;

-- Create index for faster queries on pending rides
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_customer_id ON rides(customer_id);

-- Create index for online drivers location queries
CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online) WHERE is_online = true;
-- Create users table with role
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'driver')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = auth_id);

CREATE POLICY "Anyone can insert on signup" ON public.users
  FOR INSERT WITH CHECK (true);

-- Create rides table
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  destination_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'started', 'completed', 'cancelled')),
  distance DOUBLE PRECISION,
  duration INTEGER,
  price DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Policies for rides
CREATE POLICY "Users can view own rides" ON public.rides
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Customers can create rides" ON public.rides
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'customer')
  );

CREATE POLICY "Drivers can view pending rides" ON public.rides
  FOR SELECT USING (status = 'pending');

CREATE POLICY "Drivers can update rides" ON public.rides
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'driver') OR
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
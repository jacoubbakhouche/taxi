-- SUPER NUCLEAR FIX: DROP TRIGGERS, POLICIES AND SECURE RPCs
-- This script addresses "Infinite Recursion" by removing ALL Triggers on 'users' 
-- and ensuring all RPC functions bypass RLS (Security Definer).

-- 1. DYNAMICALLY DROP ALL TRIGGERS ON USERS
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'users' 
        AND event_object_schema = 'public'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.users', r.trigger_name);
        RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
    END LOOP;
END $$;

-- 2. DYNAMICALLY DROP ALL POLICIES ON USERS (Again, to be safe)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', r.policyname);
    END LOOP;
END $$;

-- 3. DISABLE RLS TEMPORARILY
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 4. SECURE VITAL FUNCTIONS (SECURITY DEFINER = Bypass RLS)
-- This ensures that even if RLS is broken, these functions will still work because they ignore policies.

-- 4.1. Update Location Function
CREATE OR REPLACE FUNCTION update_driver_location(p_lat float, p_lng float)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET 
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    is_online = true 
  WHERE auth_id = auth.uid() AND role = 'driver'::user_role;
END;
$$;

-- 4.2. Get User ID Function
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER -- Bypass RLS
SET search_path = public
STABLE
AS $function$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$function$;

-- 5. RE-ENABLE RLS WITH A "DUMB" POLICY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Simple "Allow All" policy that cannot recurse (checking TRUE requires no DB lookup)
CREATE POLICY "super_safe_allow_all" ON public.users
FOR ALL USING (true) WITH CHECK (true);

-- 6. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_current_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_driver_location TO authenticated;

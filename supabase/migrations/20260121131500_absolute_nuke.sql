-- ABSOLUTE NUCLEAR FIX: DYNAMICALLY DROP ALL POLICIES
-- This script uses PL/pgSQL to look up every existing policy on the 'users' table 
-- and drop it, regardless of its name. This guarantees a clean slate.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all policies on the 'users' table in the 'public' schema
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
    ) LOOP
        -- Execute the DROP command dynamically
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Disable and Enable RLS to force a flush
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Re-create the Helper Function (Security Definer)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$function$;

-- Create the ONE simple, safe policy
CREATE POLICY "safe_allow_read_all" ON public.users
FOR SELECT USING (true); -- Allow all reads (temporary fix)

CREATE POLICY "safe_allow_update_own" ON public.users
FOR UPDATE USING (auth_id = auth.uid()); -- Allow owner update

CREATE POLICY "safe_allow_insert_signup" ON public.users
FOR INSERT WITH CHECK (true); -- Allow signup

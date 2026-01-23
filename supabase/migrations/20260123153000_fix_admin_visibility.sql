
-- FIX: DROP ALL problematic policies on users table first to be clean
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can select all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;

-- 1. Create a SIMPLE, PERMISSIVE policy for SELECT
-- This allows ANY authenticated user to see ANY user profile.
-- This effectively "makes it normal" as requested, removing the complexity of admin checks for viewing.
CREATE POLICY "Allow authenticated to view all profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- 2. Allow Admins to UPDATE (Approve/Reject)
-- We use a simple check for now. Ideally use a function to avoid recursion, but for UPDATE it's less prone to recursion on SELECT policies.
-- IF recursion is an issue even here, we can temporarily allow update for all authenticated IF the frontend protects it, 
-- BUT better to be slightly secure. 
-- "USING (role = 'admin')" might verify against the row being updated (bad) or the auth user (recursion).
-- Let's just use: USING (true) for now for verified users? No, too dangerous.

-- Let's use the JWT metadata if available, or just a simple check that doesn't query the table itself recursively?
-- Actually, for `UPDATE`, the recursion happens if the `USING` clause queries the table.
-- Let's rely on the permissive SELECT policy to allow checking the admin status safely?
-- No, the safest way without recursion is:
-- CREATE POLICY "Admins can update" ON users FOR UPDATE USING (auth.jwt() ->> 'email' = 'admin@taxidz.com' OR ...);

-- But we don't know the admin email.
-- Let's stick to the user's request: "Remove complications".
-- We will allow UPDATE for authenticated users for now, trusting the frontend Admin Dashboard is the only place fetching/editing this.
-- WAIT: "Users can update their own profile" is usually needed.
-- Let's adding:
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- For Admin to update OTHERS:
-- We'll try the recursion-safe approach: using a separate function or just risking it because we fixed SELECT.
-- If SELECT is "true", recursion loop is broken for the SELECT part.
-- So `(SELECT role FROM users WHERE id = auth.uid())` should now work without infinite loop because the inner SELECT just returns true immediately.

CREATE POLICY "Admins can update status"
ON public.users
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


# Database Setup for Account Deletion

To enable the "Delete Account" functionality, you must run the following SQL command in your Supabase SQL Editor. This is required because client-side code cannot securely delete users from the authentication system by default.

## Run this SQL:

```sql
-- 1. Create a secure function to allow users to delete their own account
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This deletes the user from the Authentication system
  -- If your public tables (users, rides) reference auth.users with "ON DELETE CASCADE", 
  -- they will be automatically cleaned up.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- 2. Grant permission for logged-in users to use this function
GRANT EXECUTE ON FUNCTION delete_own_account TO authenticated;
```

## How to run:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Loock for the **SQL Editor** in the left sidebar.
4. Paste the code above and click **Run**.

Once this is done, the "Delete Account" button in the Settings page will work correctly.

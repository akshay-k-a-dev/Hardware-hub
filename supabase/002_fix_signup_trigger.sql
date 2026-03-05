-- ============================================================
-- FIX 1: Improve Signup Trigger Error Handling
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE profiles ALTER COLUMN email_verified SET DEFAULT false;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role, status, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    'active',
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP POLICY IF EXISTS "System can insert profiles" ON profiles CASCADE;
CREATE POLICY "System can insert profiles"
  ON profiles FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Check for any duplicate email issues
-- Uncomment the next line to see if there are duplicates:
-- SELECT email, COUNT(*) FROM profiles GROUP BY email HAVING COUNT(*) > 1;

-- 6. Verify the trigger is working
-- After running this, test signup again and check the profiles table:
-- SELECT id, name, email, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 5;

-- ============================================================
-- TROUBLESHOOTING CHECKLIST
-- ============================================================
-- [ ] Run the commands above in order
-- [ ] Test signup again with a new email
-- [ ] Check browser console for detailed error messages
-- [ ] Check your Supabase dashboard Logs tab for database errors
-- [ ] Verify profiles table has data after successful signup
-- [ ] If still failing, check auth.users table to see if user was created
-- ============================================================

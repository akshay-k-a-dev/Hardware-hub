-- ============================================================
-- FIX 2: Create RPC function for profile creation
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_profile(
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_role TEXT DEFAULT 'student'
)
RETURNS JSON AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role, status, email_verified)
  VALUES (
    user_id,
    COALESCE(user_name, 'User'),
    user_email,
    COALESCE(user_role, 'student'),
    'active',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Profile created successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Profile already exists'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'errorcode', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;

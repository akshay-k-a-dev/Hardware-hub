-- ============================================================
-- Add Phone and OTP verification logic
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Enhance get_user_profile to include phone fields
-- (The previous implementation left off the actual phone numbers, only is_verified_phone boolean.
-- Since this system needs mock OTP and visible badges, we update it)
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'status', p.status,
    'created_at', p.created_at,
    'avatar_url', p.avatar_url,
    'full_name', p.full_name,
    'name', p.name,
    'bio', p.bio,
    'city', p.city,
    'phone', p.phone,
    'is_verified_email', p.is_verified_email,
    'is_verified_phone', COALESCE(p.phone_verified, p.is_verified_phone, false),
    'tinkerhub_id', p.tinkerhub_id,
    'academic_role', p.academic_role,
    'college_name', p.college_name,
    'lab_name', p.lab_name,
    'profile_completed', p.profile_completed,
    'trust', COALESCE(
      jsonb_build_object(
        'score', t.score,
        'band', t.band,
        'total_borrows', t.total_borrows,
        'on_time_returns', t.on_time_returns,
        'late_returns', t.late_returns
      ), 
      jsonb_build_object(
        'score', 100, 
        'band', 'trusted', 
        'total_borrows', 0, 
        'on_time_returns', 0, 
        'late_returns', 0
      )
    )
  ) INTO v_result
  FROM profiles p
  LEFT JOIN trust_scores t ON t.user_id = p.id
  WHERE p.id = p_user_id;

  RETURN v_result;
END;
$$;

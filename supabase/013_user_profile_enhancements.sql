-- ============================================================
-- HardwareHub — User Profile Enhancements
-- Migration: 013_user_profile_enhancements.sql
-- ============================================================

-- ═════════════════════════════════════════════════════════════
-- SECTION 1: Profile Fields (DB + UI)
-- Add new columns safely without breaking existing schema.
-- Backfill full_name from existing name column.
-- ═════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT CHECK (length(bio) <= 160),
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_verified_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified_phone BOOLEAN DEFAULT false;

-- Backfill existing profiles
UPDATE profiles 
SET full_name = COALESCE(name, 'Unknown User') 
WHERE full_name IS NULL;

-- Enforce required constraint on full_name
ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;

-- Add Computed Column for profile completeness
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN GENERATED ALWAYS AS (
    full_name IS NOT NULL AND trim(full_name) <> '' AND
    avatar_url IS NOT NULL AND trim(avatar_url) <> '' AND
    bio IS NOT NULL AND trim(bio) <> '' AND
    city IS NOT NULL AND trim(city) <> ''
  ) STORED;


-- ═════════════════════════════════════════════════════════════
-- SECTION 2: RLS Policies
-- Enforce strict read/write access.
-- ═════════════════════════════════════════════════════════════

-- Ensure table has RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Public (or authenticated) can view all profiles
DROP POLICY IF EXISTS "Anyone authenticated can read profiles" ON profiles;
CREATE POLICY "Anyone authenticated can read profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

-- 2. UPDATE: Users can only update their own profile and ONLY specific safe fields
DROP POLICY IF EXISTS "Users can update own safe profile fields" ON profiles;
CREATE POLICY "Users can update own safe profile fields"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent role and status escalation
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM profiles WHERE id = auth.uid())
    -- Prevent altering verification flags manually via direct table update
    AND is_verified_email = (SELECT is_verified_email FROM profiles WHERE id = auth.uid())
    AND is_verified_phone = (SELECT is_verified_phone FROM profiles WHERE id = auth.uid())
  );


-- ═════════════════════════════════════════════════════════════
-- SECTION 3: API / Backend Functions
-- ═════════════════════════════════════════════════════════════

-- A: Get User Profile + Trust Summary combined
-- Uses LEFT JOIN to ensure profile returns even if trust_scores row is delayed.
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
    'name', p.name, -- legacy fallback
    'bio', p.bio,
    'city', p.city,
    'skills', p.skills,
    'is_verified_email', p.is_verified_email,
    'is_verified_phone', p.is_verified_phone,
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

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_result;
END;
$$;

-- B: Safely Update User Profile
-- Bypasses the need to craft complex client-side UPDATE objects,
-- strictly enforcing field limitations.
CREATE OR REPLACE FUNCTION update_user_profile(
  p_full_name TEXT,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_skills JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name is strictly required' USING ERRCODE = 'P0001';
  END IF;

  IF p_bio IS NOT NULL AND length(p_bio) > 160 THEN
     RAISE EXCEPTION 'Bio must not exceed 160 characters' USING ERRCODE = 'P0001';
  END IF;

  UPDATE profiles
  SET 
    full_name = p_full_name,
    avatar_url = p_avatar_url,
    bio = p_bio,
    city = p_city,
    skills = p_skills
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Profile updated successfully');
END;
$$;

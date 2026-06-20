-- ============================================================
-- HardwareHub — Hardware Item Enhancements
-- Migration: 015_hardware_item_enhancements.sql
-- ============================================================

-- 1. Add missing is_active column to hardware_items
-- This was used in the frontend but missing in the initial schema
ALTER TABLE hardware_items 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Add delivery and location fields to hardware_items
-- These were added to the AddComponentForm but not the database
ALTER TABLE hardware_items
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS devlivery_courier BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_offline BOOLEAN DEFAULT true;

-- Fix typo in column name if already created (unlikely since grep failed, but defensive)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hardware_items' AND column_name='devlivery_courier') THEN
    ALTER TABLE hardware_items RENAME COLUMN devlivery_courier TO delivery_courier;
  END IF;
END $$;

-- 3. Ensure full_name is synchronized from name if null
UPDATE profiles SET full_name = name WHERE full_name IS NULL;

-- 4. Update the trigger to handle both full_name and name
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, full_name, email, role, status, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
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

-- 5. Update the RPC to handle both full_name and name
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_role TEXT DEFAULT 'student'
)
RETURNS JSON
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, full_name, email, role, status, email_verified)
  VALUES (
    user_id,
    COALESCE(user_name, 'User'),
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

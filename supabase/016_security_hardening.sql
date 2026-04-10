-- ============================================================
-- Security Hardening & Audit Fixes
-- Run this in the Supabase SQL Editor
-- This addresses Supabase 'Low Security' Warnings
-- ============================================================

-- 1. Enable RLS on missed utility tables (Triggers Supabase Low Security emails)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_limits ENABLE ROW LEVEL SECURITY;

-- 2. Lock down rate_limit_log (System-only table via trigger)
-- No public user should read or write to this. Triggers act as service_role.
DROP POLICY IF EXISTS "Deny all rate_limit_log" ON rate_limit_log;
CREATE POLICY "Deny all rate_limit_log" ON rate_limit_log FOR ALL USING (false);

-- 3. Lock down platform_limits
-- Everyone can read the limits, but NO ONE can update them directly from client
DROP POLICY IF EXISTS "Anyone can read platform_limits" ON platform_limits;
CREATE POLICY "Anyone can read platform_limits" ON platform_limits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update platform_limits" ON platform_limits;
CREATE POLICY "Admins can update platform_limits" ON platform_limits FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. Purge overly permissive policies introduced in older migrations
-- Profiles: Drop 'System can insert profiles' which allowed any authenticated user to insert ANY profile.
-- Since the trigger `handle_new_user` handles signup with SECURITY DEFINER, we do NOT need client-side INSERT policies.
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;

-- User Ratings: Ensure only authenticated users can view ratings to prevent anon data leakage
DROP POLICY IF EXISTS "Anyone can view ratings" ON user_ratings;
CREATE POLICY "Authenticated users can view ratings" ON user_ratings FOR SELECT TO authenticated USING (true);

-- 5. Force Re-evaluation of default schema security
-- Confirming profiles are locked
DROP POLICY IF EXISTS "System can create profiles during signup" ON profiles;
DROP POLICY IF EXISTS "Unauthenticated users and anon key can create profiles" ON profiles;

-- 6. Lock down Storage just in case 
-- Ensure component-images isn't completely open for deletion or modification
-- (Previous scripts established owner-delete and provider upload, but we'll 
-- confirm no wide-open UPDATE exists).

-- ============================================================
-- Security Advisor Fixes
-- Migration: 023_security_advisor_fixes.sql
--
-- Addresses:
-- - role-mutable search_path on trust RPCs
-- - overly broad hardware_items INSERT policy
-- - broad storage.objects SELECT policy for public component images
-- ============================================================

-- 1. Pin function search_path for Security Definer RPCs.
-- ALTER FUNCTION is enough when the current function body is correct but the
-- deployed metadata is missing a fixed search_path.
ALTER FUNCTION public.get_user_trust_summary(UUID) SET search_path = public;
ALTER FUNCTION public.can_user_borrow(UUID) SET search_path = public;

-- 2. Replace permissive hardware INSERT policies with owner + role checks.
-- Drop both known legacy names and the canonical policy before recreating.
DROP POLICY IF EXISTS "Anyone authenticated can add hardware" ON public.hardware_items;
DROP POLICY IF EXISTS "Anyone authenticated can insert hardware" ON public.hardware_items;
DROP POLICY IF EXISTS "Authenticated users can add hardware" ON public.hardware_items;
DROP POLICY IF EXISTS "Providers can insert own hardware" ON public.hardware_items;

CREATE POLICY "Providers can insert own hardware"
  ON public.hardware_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('provider', 'admin')
        AND p.status = 'active'
    )
  );

-- 3. Public buckets do not need a broad SELECT policy for public object URLs.
-- Remove broad listing access, then allow users to read metadata for their own
-- folder and admins to inspect all component image metadata.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Component image metadata access" ON storage.objects;

CREATE POLICY "Component image metadata access"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'component-images'
    AND (
      name LIKE (auth.uid()::TEXT || '/%')
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
    )
  );

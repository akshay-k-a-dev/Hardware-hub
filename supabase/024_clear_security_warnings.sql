-- ============================================================
-- HardwareHub — Clear Security Linter Warnings
-- Migration: 024_clear_security_warnings.sql
--
-- This migration hardens Supabase SQL metadata and permissions by:
-- 1. Pinning search_path for mutable RPCs.
-- 2. Restricting hardware item insert policies.
-- 3. Removing broad public listing on storage bucket metadata.
-- 4. Revoking anonymous/public execute access from internal or unsafe SECURITY DEFINER functions.
-- 5. Explicitly granting execute only to authenticated where needed.
-- ============================================================

-- 1. Ensure search_path is fixed for the trust RPCs flagged by the linter.
ALTER FUNCTION public.get_user_trust_summary(UUID) SET search_path = public;
ALTER FUNCTION public.can_user_borrow(UUID) SET search_path = public;

-- 1b. Convert safe, exposed public RPCs to SECURITY INVOKER.
ALTER FUNCTION public.create_user_profile(UUID, TEXT, TEXT, TEXT) SECURITY INVOKER;
ALTER FUNCTION public.get_multiple_user_ratings(UUID[]) SECURITY INVOKER;
ALTER FUNCTION public.get_user_rating(UUID) SECURITY INVOKER;
ALTER FUNCTION public.get_user_profile(UUID) SECURITY INVOKER;
ALTER FUNCTION public.update_user_profile(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SECURITY INVOKER;
ALTER FUNCTION public.get_user_trust_summary(UUID) SECURITY INVOKER;
ALTER FUNCTION public.can_user_borrow(UUID) SECURITY INVOKER;
ALTER FUNCTION public.get_prebook_count(UUID) SECURITY INVOKER;
ALTER FUNCTION public.get_user_prebook_position(UUID, UUID) SECURITY INVOKER;
ALTER FUNCTION public.prebook_item(UUID) SECURITY INVOKER;
ALTER FUNCTION public.cancel_prebook(UUID) SECURITY INVOKER;
ALTER FUNCTION public.claim_prebook(UUID, TEXT, TEXT) SECURITY INVOKER;
ALTER FUNCTION public.cancel_request(UUID) SECURITY INVOKER;
ALTER FUNCTION public.return_request(UUID, TEXT, TEXT) SECURITY INVOKER;
ALTER FUNCTION public.issue_request(UUID, TEXT, TEXT) SECURITY INVOKER;
ALTER FUNCTION public.approve_request(UUID, TEXT, INTEGER) SECURITY INVOKER;
ALTER FUNCTION public.reject_request(UUID, TEXT) SECURITY INVOKER;
ALTER FUNCTION public.admin_adjust_trust(UUID, INTEGER, TEXT) SECURITY INVOKER;

-- 2. Stronger hardware_items INSERT policy, replacing legacy broad policies.
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

-- 3. Remove broad storage listing policies and scope metadata access.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read 7tk5j1_0" ON storage.objects;
DROP POLICY IF EXISTS "Component image metadata access" ON storage.objects;
DROP POLICY IF EXISTS "Hardware image metadata access" ON storage.objects;

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

CREATE POLICY "Hardware image metadata access"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hardware-images'
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

-- 4. Lock down execute privileges on SECURITY DEFINER functions.
-- Revoke broad or anonymous execution access. Keep authenticated access only
-- for explicitly needed RPCs.

-- Internal trigger and maintenance functions.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION trg_fn_init_trust_on_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trg_fn_init_trust_on_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION trg_fn_init_trust_on_signup() FROM authenticated;

REVOKE EXECUTE ON FUNCTION trg_fn_trust_on_return() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trg_fn_trust_on_return() FROM anon;
REVOKE EXECUTE ON FUNCTION trg_fn_trust_on_return() FROM authenticated;

REVOKE EXECUTE ON FUNCTION trg_fn_enforce_borrow_gate() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trg_fn_enforce_borrow_gate() FROM anon;
REVOKE EXECUTE ON FUNCTION trg_fn_enforce_borrow_gate() FROM authenticated;

REVOKE EXECUTE ON FUNCTION on_stock_increase() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION on_stock_increase() FROM anon;
REVOKE EXECUTE ON FUNCTION on_stock_increase() FROM authenticated;

REVOKE EXECUTE ON FUNCTION notify_on_request_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_on_request_event() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_on_request_event() FROM authenticated;

REVOKE EXECUTE ON FUNCTION expire_stale_prebooks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION expire_stale_prebooks() FROM anon;
REVOKE EXECUTE ON FUNCTION expire_stale_prebooks() FROM authenticated;

REVOKE EXECUTE ON FUNCTION process_prebook_queue(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION process_prebook_queue(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION process_prebook_queue(UUID) FROM authenticated;

REVOKE EXECUTE ON FUNCTION apply_trust_delta(UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION apply_trust_delta(UUID, INTEGER, TEXT, UUID, TEXT) FROM anon;

REVOKE EXECUTE ON FUNCTION fn_daily_trust_accountability() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_daily_trust_accountability() FROM anon;
REVOKE EXECUTE ON FUNCTION fn_daily_trust_accountability() FROM authenticated;

-- User-facing RPCs:
REVOKE EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_user_rating(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_rating(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_user_rating(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_user_profile(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_profile(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION update_user_profile(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_user_profile(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION update_user_profile(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_user_trust_summary(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_trust_summary(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_user_trust_summary(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION can_user_borrow(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION can_user_borrow(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION can_user_borrow(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_prebook_count(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_prebook_count(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_prebook_count(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_user_prebook_position(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_prebook_position(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_user_prebook_position(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION prebook_item(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION prebook_item(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION prebook_item(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_prebook(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cancel_prebook(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_prebook(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION claim_prebook(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_prebook(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION claim_prebook(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_request(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cancel_request(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_request(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION return_request(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION return_request(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION return_request(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION issue_request(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION issue_request(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION issue_request(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION approve_request(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION approve_request(UUID, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION approve_request(UUID, TEXT, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION reject_request(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reject_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION reject_request(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_adjust_trust(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_adjust_trust(UUID, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION admin_adjust_trust(UUID, INTEGER, TEXT) TO authenticated;

-- 5. Ensure the legacy get_multiple_user_ratings policy stays scoped to authenticated only.
REVOKE EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) TO authenticated;

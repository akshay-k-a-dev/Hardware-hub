-- ============================================================
-- HardwareHub — Trust & Borrow Limits Refinement
-- Migration: 020_relax_hard_borrow_limits_and_domains.sql
-- ============================================================

-- ═════════════════════════════════════════════════════════════
-- 1. INCREASE GLOBAL PLATFORM LIMIT
-- ═════════════════════════════════════════════════════════════
-- Increase max_active_requests from 5 to 10 to support legitimate
-- student projects requiring multiple components (e.g., Arduino + sensors + wires)
UPDATE platform_limits SET max_active_requests = 10 WHERE id = 1;


-- ═════════════════════════════════════════════════════════════
-- 2. INSTITUTIONAL DOMAINS (VERIFIED STUDENT BADGE)
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS institutional_domains (
  domain_pattern TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with Indian institutional patterns
INSERT INTO institutional_domains (domain_pattern)
VALUES 
  ('%.ac.in'),
  ('%.edu.in'),
  ('%.edu')
ON CONFLICT DO NOTHING;

-- Allow read access for everyone
ALTER TABLE institutional_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read institutional domains" ON institutional_domains FOR SELECT USING (true);


-- ═════════════════════════════════════════════════════════════
-- 3. UPDATE `can_user_borrow()` (Remove Caution limit)
-- ═════════════════════════════════════════════════════════════
-- We remove the rigid "1 active request" limit for caution band
-- users so they can borrow multiple low-value items. High-value
-- item restriction is handled by the trigger instead.
CREATE OR REPLACE FUNCTION can_user_borrow(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score        INTEGER;
  v_band         TEXT;
  v_active_count INTEGER;
  v_profile      profiles%ROWTYPE;
BEGIN
  -- ── 1. Check profile exists and is active ────────────────
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'User profile not found.');
  END IF;

  IF v_profile.status = 'suspended' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Your account has been suspended. Contact support.');
  END IF;

  -- ── 2. Initialize trust score if first-time user ─────────
  INSERT INTO trust_scores (user_id, score)
  VALUES (p_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── 3. Load trust band ───────────────────────────────────
  SELECT score, band INTO v_score, v_band
  FROM trust_scores
  WHERE user_id = p_user_id;

  -- ── 4. Hard block ────────────────────────────────────────
  IF v_band = 'blocked' THEN
    RETURN jsonb_build_object(
      'allowed',     false,
      'band',        v_band,
      'score',       v_score,
      'reason',      'Your trust score is too low (' || v_score || '/100). Borrowing is suspended. Please contact support to resolve any outstanding issues.',
      'action',      'contact_support'
    );
  END IF;

  -- ── 5. Count active requests ─────────────────────────────
  SELECT COUNT(*) INTO v_active_count
  FROM requests
  WHERE user_id = p_user_id
    AND status IN ('pending', 'approved', 'issued');

  -- CAUTION BAND restriction removed here. Caution band users
  -- are now allowed to borrow multiple low-value items.
  -- High-value item block is enforced in trg_fn_enforce_borrow_gate.

  -- ── 7. All checks passed — allow ─────────────────────────
  RETURN jsonb_build_object(
    'allowed',         true,
    'band',            v_band,
    'score',           v_score,
    'active_requests', v_active_count
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- 4. UPDATE BORROW GATE (Remove High-Value Item Caps)
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_enforce_borrow_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result            JSONB;
  v_global_active     INTEGER;
  v_band              TEXT;
  v_is_high_value     BOOLEAN;
  v_limit             INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated context not allowed';
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Invalid user_id (spoofing attempt)';
  END IF;

  -- Atomic Rate Limit
  INSERT INTO rate_limit_log(user_id, action)
  SELECT NEW.user_id, 'borrow_request'
  WHERE (
    SELECT COUNT(*) FROM rate_limit_log
    WHERE user_id = NEW.user_id
    AND action = 'borrow_request'
    AND created_at > now() - INTERVAL '1 minute'
  ) <= 5;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Too many requests. Try again later.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = NEW.user_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'Only students can create borrow requests';
  END IF;

  -- Standard gate check (ensures not 'blocked')
  v_result := can_user_borrow(NEW.user_id);
  IF NOT (v_result->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'BORROW_GATE_BLOCKED: %', v_result->>'reason' USING ERRCODE = 'P0001';
  END IF;

  v_band := v_result->>'band';

  -- High Value & Global counts
  SELECT is_high_value INTO v_is_high_value FROM hardware_items WHERE id = NEW.hardware_id;
  SELECT COUNT(*) INTO v_global_active FROM requests WHERE user_id = NEW.user_id AND status IN ('pending', 'approved', 'issued');

  -- High Value Asset Restrictions
  IF v_is_high_value THEN
    IF v_band = 'caution' THEN
      RAISE EXCEPTION 'BORROW_GATE_BLOCKED: Caution band users cannot borrow High-Value items. Please improve your trust score first.' USING ERRCODE = 'P0001';
    END IF;
    -- Note: Removed all hard quantity limits (1 or 3) for High-Value items for Trusted users.
    -- Trusted users are now governed solely by global platform limits and inventory availability.
  END IF;

  -- Global limit
  SELECT max_active_requests INTO v_limit FROM platform_limits WHERE id = 1;
  IF v_global_active >= COALESCE(v_limit, 10) THEN
    RAISE EXCEPTION 'BORROW_GATE_BLOCKED: Maximum concurrent active requests reached.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- 5. UPDATE `get_user_trust_summary()`
-- ═════════════════════════════════════════════════════════════
-- Includes the new `is_verified_student` flag based on email domains.
CREATE OR REPLACE FUNCTION get_user_trust_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trust  trust_scores%ROWTYPE;
  v_events JSONB;
  v_verified BOOLEAN;
BEGIN
  -- Initialize if not exists
  INSERT INTO trust_scores (user_id, score)
  VALUES (p_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_trust FROM trust_scores WHERE user_id = p_user_id;

  -- Last 20 events, most recent first
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',          e.id,
      'delta',       e.delta,
      'reason',      e.reason,
      'score_after', e.score_after,
      'notes',       e.notes,
      'request_id',  e.request_id,
      'created_at',  e.created_at
    )
    ORDER BY e.created_at DESC
  ), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT * FROM trust_events
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) e;

  -- Check verified student status
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN institutional_domains d ON p.email LIKE d.domain_pattern
    WHERE p.id = p_user_id
  ) INTO v_verified;

  RETURN jsonb_build_object(
    'user_id',            v_trust.user_id,
    'score',              v_trust.score,
    'band',               v_trust.band,
    'total_borrows',      v_trust.total_borrows,
    'on_time_returns',    v_trust.on_time_returns,
    'late_returns',       v_trust.late_returns,
    'damages_reported',   v_trust.damages_reported,
    'manual_adjustments', v_trust.manual_adjustments,
    'last_updated',       v_trust.last_updated,
    'recent_events',      v_events,
    'is_verified_student', v_verified
  );
END;
$$;

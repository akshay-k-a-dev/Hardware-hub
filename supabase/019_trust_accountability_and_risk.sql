-- ============================================================
-- HardwareHub — Trust Accountability & Risk Model Updates
-- Migration: 019_trust_accountability_and_risk.sql
-- ============================================================

-- ═════════════════════════════════════════════════════════════
-- 1. ADD HIGH-VALUE FLAG TO HARDWARE
-- ═════════════════════════════════════════════════════════════
ALTER TABLE hardware_items ADD COLUMN IF NOT EXISTS is_high_value BOOLEAN DEFAULT false;

-- ═════════════════════════════════════════════════════════════
-- 2. UPDATE BORROW GATE (Asset-Tiered limits)
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
  v_high_value_active INTEGER;
  v_band              TEXT;
  v_is_high_value     BOOLEAN;
  v_limit             INTEGER;
  v_total_borrows     INTEGER;
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

  -- Standard gate check (ensures score > 40)
  v_result := can_user_borrow(NEW.user_id);
  IF NOT (v_result->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'BORROW_GATE_BLOCKED: %', v_result->>'reason' USING ERRCODE = 'P0001';
  END IF;

  v_band := v_result->>'band';

  -- High Value & Global counts
  SELECT is_high_value INTO v_is_high_value FROM hardware_items WHERE id = NEW.hardware_id;
  SELECT COUNT(*) INTO v_global_active FROM requests WHERE user_id = NEW.user_id AND status IN ('pending', 'approved', 'issued');
  
  SELECT COUNT(*) INTO v_high_value_active 
  FROM requests r
  JOIN hardware_items h ON r.hardware_id = h.id
  WHERE r.user_id = NEW.user_id 
    AND r.status IN ('pending', 'approved', 'issued')
    AND h.is_high_value = true;

  -- Get total borrows to distinguish "New" from "Veteran" users
  SELECT total_borrows INTO v_total_borrows FROM trust_scores WHERE user_id = NEW.user_id;
  v_total_borrows := COALESCE(v_total_borrows, 0);

  -- High Value Asset Restrictions
  IF v_is_high_value THEN
    IF v_band = 'caution' THEN
      RAISE EXCEPTION 'BORROW_GATE_BLOCKED: Caution band users cannot borrow High-Value items.' USING ERRCODE = 'P0001';
    END IF;
    
    IF v_band = 'trusted' THEN
      IF v_total_borrows < 3 AND v_high_value_active >= 1 THEN
        RAISE EXCEPTION 'BORROW_GATE_BLOCKED: New users can only borrow 1 High-Value item at a time.' USING ERRCODE = 'P0001';
      END IF;
      IF v_total_borrows >= 3 AND v_high_value_active >= 3 THEN
        RAISE EXCEPTION 'BORROW_GATE_BLOCKED: You have reached the limit of 3 active High-Value items.' USING ERRCODE = 'P0001';
      END IF;
    END IF;
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
-- 3. AUTOMATED ACCOUNTABILITY JOB (pg_cron)
-- ═════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION fn_daily_trust_accountability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Process active issued requests with an expected return date
  FOR r IN 
    SELECT r.id, r.user_id, r.expected_return_date, h.name as item_name
    FROM requests r
    JOIN hardware_items h ON r.hardware_id = h.id
    WHERE r.status = 'issued' AND r.expected_return_date IS NOT NULL
  LOOP
    -- T-1: Due Tomorrow
    IF CURRENT_DATE = (r.expected_return_date - INTERVAL '1 day')::DATE THEN
      IF NOT EXISTS (SELECT 1 FROM notifications WHERE reference_id = r.id AND title = 'Due Tomorrow') THEN
        INSERT INTO notifications (user_id, title, message, type, reference_id)
        VALUES (r.user_id, 'Due Tomorrow', 'Reminder: "' || r.item_name || '" is due tomorrow.', 'reminder', r.id);
      END IF;
    END IF;

    -- T+0: Due Today
    IF CURRENT_DATE = r.expected_return_date::DATE THEN
      IF NOT EXISTS (SELECT 1 FROM notifications WHERE reference_id = r.id AND title = 'Due Today') THEN
        INSERT INTO notifications (user_id, title, message, type, reference_id)
        VALUES (r.user_id, 'Due Today', '"' || r.item_name || '" is due today. Please return it to avoid penalties.', 'reminder', r.id);
      END IF;
    END IF;

    -- T+1 and beyond: Overdue Penalty
    IF CURRENT_DATE > r.expected_return_date::DATE THEN
      -- Prevent double-penalizing on the exact same day
      IF NOT EXISTS (
        SELECT 1 FROM trust_events 
        WHERE request_id = r.id 
          AND reason = 'overdue_daily_penalty' 
          AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE
      ) THEN
        -- Apply penalty using existing engine
        PERFORM apply_trust_delta(r.user_id, -2, 'overdue_daily_penalty', r.id, 'Daily penalty for overdue item: ' || r.item_name);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Unschedule if already exists to ensure idempotency
DO $$
BEGIN
  PERFORM cron.unschedule('daily_trust_accountability');
EXCEPTION WHEN OTHERS THEN
  -- pg_cron might not be fully installed/configured on some local setups, ignore error
END $$;

-- Schedule the cron job to run at Midnight UTC
DO $$
BEGIN
  PERFORM cron.schedule('daily_trust_accountability', '0 0 * * *', 'SELECT fn_daily_trust_accountability();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling failed (expected on some restricted environments).';
END $$;

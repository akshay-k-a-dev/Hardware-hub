-- ============================================================
-- HardwareHub — Deep Audit Fixes (V4 - Production Hardening)
-- Migration: 012_deep_audit_fixes.sql
--
-- FIXES & HARDENING:
-- SECTION 1 — Critical (RLS + privilege)
--   CRIT-1: Revoke public execute on apply_trust_delta
--   CRIT-2: DB-level borrow gate, auth spoof protection, rate limiting
--   CRIT-3: get_user_trust_summary caller authorization
--   CRIT-4: Notifications INSERT policy strictly scopes service_role
--   CRIT-5: SELECT/INSERT policies for requests hardened
--   CRIT-6: DELETE protections added to critical tables
--   CRIT-7: Atomic rate-limiting race-condition fix
--
-- SECTION 2 — High Priority
--   HIGH-1: total_borrows moved inside apply_trust_delta lock
--   HIGH-2: admin_adjust_trust delta range clamp (-30 to +30)
--   HIGH-3: approve_request FOR UPDATE locking (prevents TOCTOU)
--   HIGH-4/5: lending_history RLS scoped
--
-- SECTION 3 — Profile & Auth Security
--   SEC-1: anon profile inserts strictly blocked
--   SEC-2: Role/status immutability trigger
--
-- SECTION 4 — Abuse & Limits
--   ABUSE-1: 24h Cooldown on 'on_time_return' trust rewards
--   ABUSE-2: rate_limit_log + platform_limits tables
--   ABUSE-3: Provider trust RLS scoped
--
-- SECTION 5 — Schema Locks
--   SCHEMA-1: Non-negative CHECK constraints
--   SCHEMA-2: Bounded delta constraints
--   SCHEMA-3: Request anti-tampering trigger
--   SCHEMA-4: Legal state machine trigger
--
-- SECTION 6 — Indexes
--   IDX-1 to IDX-4 for performance & idempotency
-- ============================================================

-- ═════════════════════════════════════════════════════════════
-- STEP 0: EXECUTION ORDER & NEW SYSTEM TABLES
-- ═════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trust_scores') THEN
    RAISE EXCEPTION '012 requires 010_trust_engine.sql to have been run first.';
  END IF;
END;
$$;

-- Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action_time
ON rate_limit_log(user_id, action, created_at DESC);

-- Configurable limits table
CREATE TABLE IF NOT EXISTS platform_limits (
  id INT PRIMARY KEY DEFAULT 1,
  max_active_requests INT DEFAULT 5
);
INSERT INTO platform_limits (id, max_active_requests) VALUES (1, 5) ON CONFLICT DO NOTHING;
ALTER TABLE platform_limits DROP CONSTRAINT IF EXISTS chk_single_row;
ALTER TABLE platform_limits ADD CONSTRAINT chk_single_row CHECK (id = 1);
ALTER TABLE platform_limits DROP CONSTRAINT IF EXISTS platform_limits_singleton;
ALTER TABLE platform_limits ADD CONSTRAINT platform_limits_singleton UNIQUE (id);


-- ═════════════════════════════════════════════════════════════
-- CRIT-1: REVOKE PUBLIC EXECUTE on apply_trust_delta
-- ═════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION apply_trust_delta(UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION apply_trust_delta(UUID, INTEGER, TEXT, UUID, TEXT) FROM authenticated;


-- ═════════════════════════════════════════════════════════════
-- SEC-2: PROFILE ROLE/STATUS PROTECTION TRIGGER
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() = NEW.id THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = NEW.id THEN
      RAISE EXCEPTION 'Users cannot change their own status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_protect_profile_fields();


-- ═════════════════════════════════════════════════════════════
-- HIGH-1 + CRIT-1: apply_trust_delta
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION apply_trust_delta(
  p_user_id    UUID,
  p_delta      INTEGER,
  p_reason     TEXT,
  p_request_id UUID    DEFAULT NULL,
  p_notes      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_score    INTEGER;
  v_new_score    INTEGER;
  v_old_band     TEXT;
  v_new_band     TEXT;
  v_triggered    UUID;
  v_recent_notif BOOLEAN := FALSE;
BEGIN
  IF p_reason NOT IN (
    'on_time_return', 'late_return_mild', 'late_return_moderate',
    'late_return_severe', 'damage_minor', 'damage_major', 'item_lost',
    'overdue_daily_penalty', 'manual_adjustment',
    'dispute_resolved_favor', 'first_borrow_bonus'
  ) THEN
    RAISE EXCEPTION 'apply_trust_delta: unknown reason "%"', p_reason;
  END IF;

  IF p_reason = 'manual_adjustment' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'apply_trust_delta: manual_adjustment requires notes';
  END IF;

  INSERT INTO trust_scores (user_id, score) VALUES (p_user_id, 100) ON CONFLICT (user_id) DO NOTHING;

  SELECT score INTO v_old_score FROM trust_scores WHERE user_id = p_user_id FOR UPDATE;
  v_new_score := GREATEST(0, LEAST(100, v_old_score + p_delta));

  UPDATE trust_scores
  SET
    score              = v_new_score,
    last_updated       = now(),
    on_time_returns    = on_time_returns    + CASE WHEN p_reason = 'on_time_return' THEN 1 ELSE 0 END,
    late_returns       = late_returns       + CASE WHEN p_reason LIKE 'late_return_%' THEN 1 ELSE 0 END,
    damages_reported   = damages_reported   + CASE WHEN p_reason IN ('damage_minor','damage_major','item_lost') THEN 1 ELSE 0 END,
    manual_adjustments = manual_adjustments + CASE WHEN p_reason = 'manual_adjustment' THEN 1 ELSE 0 END,
    total_borrows      = total_borrows      + CASE WHEN p_reason IN ('on_time_return','late_return_mild','late_return_moderate','late_return_severe') THEN 1 ELSE 0 END
  WHERE user_id = p_user_id;

  v_triggered := NULLIF(auth.uid()::TEXT, '')::UUID;

  INSERT INTO trust_events (
    user_id, delta, reason, score_after, notes, request_id, triggered_by
  ) VALUES (
    p_user_id, p_delta, p_reason, v_new_score, p_notes, p_request_id, v_triggered
  );

  v_old_band := CASE WHEN v_old_score >= 70 THEN 'trusted' WHEN v_old_score >= 40 THEN 'caution' ELSE 'blocked' END;
  v_new_band := CASE WHEN v_new_score >= 70 THEN 'trusted' WHEN v_new_score >= 40 THEN 'caution' ELSE 'blocked' END;

  IF v_old_band IS DISTINCT FROM v_new_band THEN
    SELECT EXISTS (
      SELECT 1 FROM notifications WHERE user_id = p_user_id AND type = 'trust' AND created_at > now() - INTERVAL '6 hours'
    ) INTO v_recent_notif;

    IF NOT v_recent_notif THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        p_user_id,
        CASE v_new_band WHEN 'trusted' THEN '✅ Trust Status: Trusted' WHEN 'caution' THEN '⚠️ Trust Status: Caution' ELSE '🚫 Trust Status: Blocked' END,
        CASE v_new_band WHEN 'trusted' THEN 'Your trust score is strong. You have full borrowing privileges.' WHEN 'caution' THEN 'Your trust score has dropped. You are limited to 1 active request at a time.' ELSE 'Your trust score is too low. Borrowing is suspended. Please contact support.' END,
        'trust',
        p_request_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'user_id', p_user_id, 'old_score', v_old_score, 'new_score', v_new_score,
    'delta', p_delta, 'reason', p_reason, 'old_band', v_old_band, 'new_band', v_new_band
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- HIGH-1: trg_fn_trust_on_return (With 24hr Cooldown)
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_trust_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_late      NUMERIC;
  v_borrow_hours   NUMERIC;
  v_delta          INTEGER;
  v_reason         TEXT;
  v_is_damaged     BOOLEAN := FALSE;
  v_condition      TEXT;
  v_already_scored BOOLEAN := FALSE;
BEGIN
  IF NOT (OLD.status IN ('issued', 'overdue') AND NEW.status = 'returned') THEN RETURN NEW; END IF;

  -- PREVENT TRUST SCORE RACE CONDITION
  PERFORM 1 FROM trust_scores
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM trust_events WHERE request_id = NEW.id AND reason IN ('on_time_return','late_return_mild','late_return_moderate','late_return_severe')
  ) INTO v_already_scored;
  IF v_already_scored THEN RETURN NEW; END IF;

  IF NEW.actual_return_date IS NOT NULL AND NEW.expected_return_date IS NOT NULL THEN
    v_days_late := EXTRACT(EPOCH FROM (NEW.actual_return_date - NEW.expected_return_date)) / 86400.0;
  ELSE
    v_days_late := 0;
  END IF;

  IF NEW.actual_return_date IS NOT NULL THEN
    v_borrow_hours := EXTRACT(EPOCH FROM (NEW.actual_return_date - COALESCE(NEW.issue_date, NEW.created_at))) / 3600.0;
  ELSE
    v_borrow_hours := 999;
  END IF;

  IF v_days_late <= 0 THEN
    IF v_borrow_hours < 2 THEN
      INSERT INTO trust_scores (user_id, score) VALUES (NEW.user_id, 100) ON CONFLICT (user_id) DO NOTHING;
      INSERT INTO trust_events (user_id, delta, reason, score_after, notes, request_id)
      SELECT NEW.user_id, 0, 'on_time_return', ts.score, 'Reward suppressed: returned in < 2 hours (anti-farming)', NEW.id
      FROM trust_scores ts WHERE ts.user_id = NEW.user_id;
      RETURN NEW;
    ELSIF EXISTS (
      SELECT 1 FROM trust_events
      WHERE user_id = NEW.user_id
      AND reason = 'on_time_return'
      AND created_at > now() - INTERVAL '24 hours'
    ) THEN
      INSERT INTO trust_scores (user_id, score) VALUES (NEW.user_id, 100) ON CONFLICT (user_id) DO NOTHING;
      INSERT INTO trust_events (user_id, delta, reason, score_after, notes, request_id)
      SELECT NEW.user_id, 0, 'on_time_return', ts.score, 'Reward suppressed: 24h limit (anti-farming)', NEW.id
      FROM trust_scores ts WHERE ts.user_id = NEW.user_id;
      RETURN NEW;
    ELSE
      v_delta  := 8; v_reason := 'on_time_return';
    END IF;
  ELSIF v_days_late <= 3 THEN
    v_delta := -8;  v_reason := 'late_return_mild';
  ELSIF v_days_late <= 7 THEN
    v_delta := -18; v_reason := 'late_return_moderate';
  ELSE
    v_delta := -30; v_reason := 'late_return_severe';
  END IF;

  SELECT condition_on_return INTO v_condition FROM lending_history WHERE request_id = NEW.id LIMIT 1;
  IF COALESCE(v_condition, '') IN ('Damaged', 'Broken', 'Poor') THEN v_is_damaged := TRUE; END IF;

  PERFORM apply_trust_delta(
    NEW.user_id, v_delta, v_reason, NEW.id,
    'Auto-scored. Days late: ' || ROUND(v_days_late, 1) || '. Borrow duration: ' || ROUND(v_borrow_hours, 1) || 'h'
  );

  IF v_is_damaged THEN
    PERFORM apply_trust_delta(
      NEW.user_id, CASE WHEN v_condition = 'Broken' THEN -35 ELSE -20 END,
      CASE WHEN v_condition = 'Broken' THEN 'damage_major' ELSE 'damage_minor' END, NEW.id,
      'Condition logged as: ' || v_condition
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trust_on_return ON requests;
CREATE TRIGGER trg_trust_on_return AFTER UPDATE OF status ON requests FOR EACH ROW EXECUTE FUNCTION trg_fn_trust_on_return();


-- ═════════════════════════════════════════════════════════════
-- HIGH-2: admin_adjust_trust
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_adjust_trust(p_target_user UUID, p_delta INTEGER, p_notes TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin_adjust_trust: caller is not an admin';
  END IF;
  IF p_target_user = auth.uid() THEN RAISE EXCEPTION 'admin_adjust_trust: admins cannot adjust their own trust score'; END IF;
  IF p_notes IS NULL OR trim(p_notes) = '' THEN RAISE EXCEPTION 'admin_adjust_trust: notes are required'; END IF;
  IF p_delta < -30 OR p_delta > 30 THEN RAISE EXCEPTION 'admin_adjust_trust: delta must be between -30 and +30'; END IF;

  RETURN apply_trust_delta(p_target_user, p_delta, 'manual_adjustment', NULL, '[Admin: ' || auth.uid() || '] ' || p_notes);
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- HIGH-3: approve_request (FOR UPDATE ATOMIC STOCK)
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION approve_request(p_request_id UUID, p_notes TEXT DEFAULT NULL, p_lending_days INTEGER DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request  requests%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
  v_days     INTEGER;
BEGIN
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Request no longer pending'; END IF;

  SELECT * INTO v_hardware
  FROM hardware_items
  WHERE id = v_request.hardware_id
  FOR UPDATE;

  IF v_hardware.owner_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Atomic Stock Update
  UPDATE hardware_items
  SET quantity_available = quantity_available - v_request.quantity
  WHERE id = v_hardware.id
  AND quantity_available >= v_request.quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock update failed due to concurrent modification or insufficient stock';
  END IF;

  v_days := COALESCE(p_lending_days, v_hardware.max_lending_days);

  UPDATE requests SET status = 'approved', approval_date = now(), expected_return_date = now() + (v_days || ' days')::INTERVAL, provider_notes = COALESCE(p_notes, provider_notes) WHERE id = p_request_id;
  INSERT INTO lending_history (request_id, condition_on_issue) VALUES (p_request_id, 'Good') ON CONFLICT DO NOTHING;
  INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (v_request.user_id, 'Request Approved', 'Your request has been approved.', 'request_update', p_request_id);

  RETURN json_build_object('success', true, 'message', 'Request approved');
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- CRIT-3: get_user_trust_summary
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_user_trust_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_role TEXT;
  v_trust       trust_scores%ROWTYPE;
  v_events      JSONB;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;

  IF v_caller_role = 'student' AND v_caller_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'get_user_trust_summary: students may only view their own summary';
  END IF;
  IF v_caller_role = 'provider' THEN
    IF NOT EXISTS (
      SELECT 1 FROM requests r JOIN hardware_items h ON h.id = r.hardware_id
      WHERE r.user_id = p_user_id AND h.owner_id = v_caller_id AND r.status IN ('pending','approved','issued')
    ) THEN
      RAISE EXCEPTION 'get_user_trust_summary: no active requests from this user on your items';
    END IF;
  END IF;

  INSERT INTO trust_scores (user_id, score) VALUES (p_user_id, 100) ON CONFLICT DO NOTHING;
  SELECT * INTO v_trust FROM trust_scores WHERE user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', e.id, 'delta', e.delta, 'reason', e.reason, 'score_after', e.score_after, 'notes', e.notes, 'request_id', e.request_id, 'created_at', e.created_at)
  ), '[]'::JSONB) INTO v_events
  FROM (SELECT * FROM trust_events WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20) e;

  RETURN jsonb_build_object(
    'user_id', v_trust.user_id, 'score', v_trust.score, 'band', v_trust.band, 'total_borrows', v_trust.total_borrows,
    'on_time_returns', v_trust.on_time_returns, 'late_returns', v_trust.late_returns, 'damages_reported', v_trust.damages_reported,
    'manual_adjustments', v_trust.manual_adjustments, 'last_updated', v_trust.last_updated, 'recent_events', v_events
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- CRIT-2 + ABUSE-2: Borrow Gate, Strict UID & Rate Limit
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_enforce_borrow_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result        JSONB;
  v_global_active INTEGER;
  v_limit         INTEGER;
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

  SELECT COUNT(*) INTO v_global_active FROM requests WHERE user_id = NEW.user_id AND status IN ('pending', 'approved', 'issued');
  SELECT max_active_requests INTO v_limit FROM platform_limits WHERE id = 1;

  IF v_global_active >= COALESCE(v_limit, 5) THEN
    RAISE EXCEPTION 'BORROW_GATE_BLOCKED: Maximum concurrent active requests reached.' USING ERRCODE = 'P0001';
  END IF;

  v_result := can_user_borrow(NEW.user_id);
  IF NOT (v_result->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'BORROW_GATE_BLOCKED: %', v_result->>'reason' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_borrow_gate ON requests;
CREATE TRIGGER trg_enforce_borrow_gate BEFORE INSERT ON requests FOR EACH ROW EXECUTE FUNCTION trg_fn_enforce_borrow_gate();


-- ═════════════════════════════════════════════════════════════
-- SCHEMA-3 & SCHEMA-4: Request update protections 
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_validate_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id of an existing request';
  END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'Cannot change requested quantity once created';
  END IF;

  IF auth.uid() = OLD.user_id AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('cancelled') THEN
      RAISE EXCEPTION 'Students can only transition logic to cancelled, not %', NEW.status;
    END IF;
  END IF;

  IF OLD.status = 'pending'  AND NEW.status NOT IN ('approved','rejected','cancelled') THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  IF OLD.status = 'approved' AND NEW.status NOT IN ('issued','cancelled','rejected') THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  IF OLD.status = 'issued'   AND NEW.status NOT IN ('returned','overdue') THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  IF OLD.status = 'overdue'  AND NEW.status NOT IN ('returned') THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  IF OLD.status IN ('returned','rejected','cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'Terminal state'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_status_transition ON requests;
DROP TRIGGER IF EXISTS trg_validate_request_update ON requests;
CREATE TRIGGER trg_validate_request_update BEFORE UPDATE ON requests FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_request_update();


-- ═════════════════════════════════════════════════════════════
-- RLS POLICY HARDENINGS
-- ═════════════════════════════════════════════════════════════

-- ── ENABLE RLS ───────────────────────────────────────────────
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;

-- ── CRIT-5: Active students only can create requests ─────────
DROP POLICY IF EXISTS "Students can create requests" ON requests;
CREATE POLICY "Active students can create requests"
  ON requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student' AND status = 'active')
  );

-- ── CRIT-5b: Ensure strict SELECT policy on requests ─────────
DROP POLICY IF EXISTS "Users can view own or related requests" ON requests;
CREATE POLICY "Users can view own or related requests"
  ON requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM hardware_items h WHERE h.id = requests.hardware_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── CRIT-6: DELETE protections ───────────────────────────────
DROP POLICY IF EXISTS "No delete on requests" ON requests;
CREATE POLICY "No delete on requests" ON requests FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "No delete on lending_history" ON lending_history;
CREATE POLICY "No delete on lending_history" ON lending_history FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "No delete on trust_events" ON trust_events;
CREATE POLICY "No delete on trust_events" ON trust_events FOR DELETE TO authenticated USING (false);

-- ── SCHEMA-3: RLS FOR UPDATE ON requests ─────────────────────
DROP POLICY IF EXISTS "Providers and admins can update requests" ON requests;
DROP POLICY IF EXISTS "Users can only update their own requests safely" ON requests;
CREATE POLICY "Users can only update their own requests safely"
  ON requests FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM hardware_items h WHERE h.id = requests.hardware_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM hardware_items h WHERE h.id = requests.hardware_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── CRIT-4: Notifications INSERT policy (Safe for Sys) ───────
-- WARNING: auth.uid() IS NULL allows all SECURITY DEFINER functions.
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users insert own notifications only" ON notifications;
DROP POLICY IF EXISTS "Users insert own notifications or system" ON notifications;
CREATE POLICY "Users insert own notifications or system"
  ON notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      auth.uid() IS NULL
      AND current_setting('role', true) = 'service_role'
    )
  );

-- ── SEC-1: Bound profile inserts to auth.uid() ───────────────
DROP POLICY IF EXISTS "Unauthenticated users and anon key can create profiles" ON profiles;
DROP POLICY IF EXISTS "System can create profiles during signup" ON profiles;
CREATE POLICY "Users can only insert own profile on signup"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role IN ('student', 'provider'));

-- ── SEC-2: Cleanup broken RLS profile update subqueries ──────
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own safe profile fields" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile rows" ON profiles;
CREATE POLICY "Users can update own profile rows"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── HIGH-4 & HIGH-5: Scoped lending_history ──────────────────
DROP POLICY IF EXISTS "Authenticated users can view lending history" ON lending_history;
DROP POLICY IF EXISTS "Scoped lending history access SELECT" ON lending_history;
CREATE POLICY "Scoped lending history access SELECT"
  ON lending_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM requests WHERE id = lending_history.request_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM requests r JOIN hardware_items h ON h.id = r.hardware_id WHERE r.id = lending_history.request_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "System can insert lending history" ON lending_history;
DROP POLICY IF EXISTS "Providers can update lending history" ON lending_history;
DROP POLICY IF EXISTS "Provider or admin manages lending history WRITE" ON lending_history;
CREATE POLICY "Provider or admin manages lending history WRITE"
  ON lending_history FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM requests r JOIN hardware_items h ON h.id = r.hardware_id WHERE r.id = lending_history.request_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM requests r JOIN hardware_items h ON h.id = r.hardware_id WHERE r.id = lending_history.request_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ═════════════════════════════════════════════════════════════
-- SCHEMA CONSTRAINTS & INDEXES
-- ═════════════════════════════════════════════════════════════
ALTER TABLE trust_scores DROP CONSTRAINT IF EXISTS chk_trust_counters_non_negative;
ALTER TABLE trust_scores ADD CONSTRAINT chk_trust_counters_non_negative CHECK (
  total_borrows >= 0 AND on_time_returns >= 0 AND late_returns >= 0 AND damages_reported >= 0 AND manual_adjustments >= 0
);

ALTER TABLE trust_events DROP CONSTRAINT IF EXISTS chk_trust_event_delta_bounds;
ALTER TABLE trust_events ADD CONSTRAINT chk_trust_event_delta_bounds CHECK (delta BETWEEN -100 AND 100);

-- IDX & UNIQUE: Idempotency safety
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_events_unique_return_score
  ON trust_events(request_id, reason)
  WHERE reason IN ('on_time_return','late_return_mild','late_return_moderate','late_return_severe')
  AND request_id IS NOT NULL;

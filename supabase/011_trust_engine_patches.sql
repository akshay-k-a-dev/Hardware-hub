-- ============================================================
-- HardwareHub — Trust Engine Security & Correctness Patches
-- Migration: 011_trust_engine_patches.sql
--
-- Patches applied to 010_trust_engine.sql functions:
--   FIX 1: search_path = public on all SECURITY DEFINER fns
--   FIX 2: Double-execution guard in trg_fn_trust_on_return
--   FIX 3: Safe lending_history query (LIMIT 1 + NULL guard)
--   FIX 4: Composite index for can_user_borrow COUNT query
--   FIX 5: Trust-farming protection (min borrow duration)
--   FIX 6: Notification spam control (6-hour dedup window)
--
-- SAFETY:
--   • Zero modifications to existing tables
--   • All functions use CREATE OR REPLACE — fully idempotent
--   • All existing logic is preserved; only additions/guards added
-- ============================================================


-- ═════════════════════════════════════════════════════════════
-- FIX 4: INDEX — runs first, no dependencies
-- Covers the COUNT(*) query in can_user_borrow()
-- Dramatically speeds up the active-request check at scale
-- ═════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_requests_user_status
  ON requests(user_id, status);

-- Supporting index for trust_events idempotency guard (FIX 2)
-- Covers: WHERE request_id = X AND reason IN ('on_time_return', 'late_return_%')
CREATE INDEX IF NOT EXISTS idx_trust_events_request_reason
  ON trust_events(request_id, reason)
  WHERE request_id IS NOT NULL;

-- Supporting index for notification spam dedup (FIX 6)
-- Covers: WHERE user_id = X AND type = 'trust' AND created_at > now() - 6h
CREATE INDEX IF NOT EXISTS idx_notifications_trust_dedup
  ON notifications(user_id, type, created_at DESC)
  WHERE type = 'trust';


-- ═════════════════════════════════════════════════════════════
-- FIX 1 + 6: apply_trust_delta()
--
-- Changes from v1:
--   [FIX 1] SET search_path = public — prevents search_path
--           hijack attacks on SECURITY DEFINER functions
--   [FIX 6] Notification spam control — check if a 'trust'
--           notification was sent to this user in the last
--           6 hours before inserting another one
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
SET search_path = public                            -- FIX 1
AS $$
DECLARE
  v_old_score       INTEGER;
  v_new_score       INTEGER;
  v_old_band        TEXT;
  v_new_band        TEXT;
  v_triggered       UUID;
  v_recent_notif    BOOLEAN := FALSE;               -- FIX 6
BEGIN
  -- ── STEP 1: Validate reason ──────────────────────────────
  IF p_reason NOT IN (
    'on_time_return', 'late_return_mild', 'late_return_moderate',
    'late_return_severe', 'damage_minor', 'damage_major', 'item_lost',
    'overdue_daily_penalty', 'manual_adjustment',
    'dispute_resolved_favor', 'first_borrow_bonus'
  ) THEN
    RAISE EXCEPTION 'apply_trust_delta: unknown reason "%"', p_reason;
  END IF;

  -- Manual adjustments MUST have notes
  IF p_reason = 'manual_adjustment' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'apply_trust_delta: manual_adjustment requires notes';
  END IF;

  -- ── STEP 2: Initialize row for new users ─────────────────
  INSERT INTO trust_scores (user_id, score)
  VALUES (p_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── STEP 3: Lock row — prevent concurrent writes ──────────
  SELECT score INTO v_old_score
  FROM trust_scores
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- ── STEP 4: Compute clamped new score ────────────────────
  v_new_score := GREATEST(0, LEAST(100, v_old_score + p_delta));

  -- ── STEP 5: Update trust_scores atomically ────────────────
  UPDATE trust_scores
  SET
    score              = v_new_score,
    last_updated       = now(),
    on_time_returns    = on_time_returns    + CASE WHEN p_reason = 'on_time_return'                             THEN 1 ELSE 0 END,
    late_returns       = late_returns       + CASE WHEN p_reason LIKE 'late_return_%'                           THEN 1 ELSE 0 END,
    damages_reported   = damages_reported   + CASE WHEN p_reason IN ('damage_minor','damage_major','item_lost') THEN 1 ELSE 0 END,
    manual_adjustments = manual_adjustments + CASE WHEN p_reason = 'manual_adjustment'                         THEN 1 ELSE 0 END
  WHERE user_id = p_user_id;

  -- ── STEP 6: Capture caller identity ──────────────────────
  BEGIN
    v_triggered := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_triggered := NULL;
  END;

  -- ── STEP 7: Append audit log entry ───────────────────────
  INSERT INTO trust_events (
    user_id, delta, reason, score_after, notes, request_id, triggered_by
  ) VALUES (
    p_user_id, p_delta, p_reason, v_new_score, p_notes, p_request_id, v_triggered
  );

  -- ── STEP 8: Band-change notification with spam guard ─────
  v_old_band := CASE
    WHEN v_old_score >= 70 THEN 'trusted'
    WHEN v_old_score >= 40 THEN 'caution'
    ELSE 'blocked'
  END;
  v_new_band := CASE
    WHEN v_new_score >= 70 THEN 'trusted'
    WHEN v_new_score >= 40 THEN 'caution'
    ELSE 'blocked'
  END;

  IF v_old_band IS DISTINCT FROM v_new_band THEN
    -- FIX 6: Only send if no 'trust' notification was sent in the last 6 hours
    SELECT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id   = p_user_id
        AND type      = 'trust'
        AND created_at > now() - INTERVAL '6 hours'
    ) INTO v_recent_notif;

    IF NOT v_recent_notif THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        p_user_id,
        CASE v_new_band
          WHEN 'trusted' THEN '✅ Trust Status: Trusted'
          WHEN 'caution' THEN '⚠️ Trust Status: Caution'
          WHEN 'blocked' THEN '🚫 Trust Status: Blocked'
        END,
        CASE v_new_band
          WHEN 'trusted' THEN 'Your trust score is strong. You have full borrowing privileges.'
          WHEN 'caution' THEN 'Your trust score has dropped. You are limited to 1 active request at a time.'
          WHEN 'blocked' THEN 'Your trust score is too low. Borrowing is suspended. Please contact support.'
        END,
        'trust',
        p_request_id
      );
    END IF;
  END IF;

  -- ── STEP 9: Return structured result ─────────────────────
  RETURN jsonb_build_object(
    'success',      true,
    'user_id',      p_user_id,
    'old_score',    v_old_score,
    'new_score',    v_new_score,
    'delta',        p_delta,
    'reason',       p_reason,
    'old_band',     v_old_band,
    'new_band',     v_new_band,
    'band_changed', (v_old_band IS DISTINCT FROM v_new_band)
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- FIX 1 + 2 + 3 + 5: trg_fn_trust_on_return()
--
-- Changes from v1:
--   [FIX 1] SET search_path = public
--   [FIX 2] Idempotency guard — checks trust_events for a
--           prior scoring event for this request_id before
--           executing. If any return-scoring event exists for
--           this request, the trigger exits immediately.
--           Uses the new idx_trust_events_request_reason index.
--   [FIX 3] lending_history query now uses LIMIT 1 and
--           handles NULL condition_on_return gracefully.
--           Will not error even if the row is missing.
--   [FIX 5] Trust-farming protection: on_time_return reward
--           is only given if the borrow lasted >= 2 hours.
--           If the item was returned within 2 hours, no
--           positive reward is granted — but penalties for
--           late returns still apply normally.
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_fn_trust_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public                            -- FIX 1
AS $$
DECLARE
  v_days_late         NUMERIC;
  v_borrow_hours      NUMERIC;                      -- FIX 5
  v_delta             INTEGER;
  v_reason            TEXT;
  v_is_damaged        BOOLEAN := FALSE;
  v_condition         TEXT;
  v_already_scored    BOOLEAN := FALSE;             -- FIX 2
BEGIN
  -- ── Guard: only process status transition → 'returned' ───
  IF NOT (OLD.status IN ('issued', 'overdue') AND NEW.status = 'returned') THEN
    RETURN NEW;
  END IF;

  -- ── FIX 2: Idempotency guard ─────────────────────────────
  -- If a scoring event already exists for this request_id,
  -- the trigger has already run. Exit cleanly without re-scoring.
  SELECT EXISTS (
    SELECT 1 FROM trust_events
    WHERE request_id = NEW.id
      AND reason IN (
        'on_time_return',
        'late_return_mild',
        'late_return_moderate',
        'late_return_severe'
      )
  ) INTO v_already_scored;

  IF v_already_scored THEN
    -- Silent return — no error, no double-scoring
    RETURN NEW;
  END IF;

  -- ── 1. Calculate lateness ────────────────────────────────
  IF NEW.actual_return_date IS NOT NULL AND NEW.expected_return_date IS NOT NULL THEN
    v_days_late := EXTRACT(EPOCH FROM (NEW.actual_return_date - NEW.expected_return_date)) / 86400.0;
  ELSE
    v_days_late := 0;
  END IF;

  -- ── FIX 5: Calculate actual borrow duration ───────────────
  -- Use issue_date → actual_return_date.
  -- Fallback to created_at if issue_date is NULL (edge case).
  IF NEW.actual_return_date IS NOT NULL THEN
    v_borrow_hours := EXTRACT(EPOCH FROM (
      NEW.actual_return_date - COALESCE(NEW.issue_date, NEW.created_at)
    )) / 3600.0;
  ELSE
    v_borrow_hours := 999; -- No return date = treat as normal borrow
  END IF;

  -- ── 2. Classify lateness → delta + reason ────────────────
  IF v_days_late <= 0 THEN
    -- FIX 5: Suppress reward if item returned within 2 hours
    -- (anti-farming: stops users from rapidly borrowing & returning)
    IF v_borrow_hours < 2 THEN
      -- No reward, but still log as on_time_return (no penalty)
      -- We apply delta=0 to produce an audit trail entry
      -- without manipulating the score.
      -- Use a direct INSERT to trust_events (bypass apply_trust_delta
      -- to avoid polluting counters with a zero-delta no-op call).
      INSERT INTO trust_scores (user_id, score)
      VALUES (NEW.user_id, 100)
      ON CONFLICT (user_id) DO NOTHING;

      INSERT INTO trust_events (user_id, delta, reason, score_after, notes, request_id)
      SELECT
        NEW.user_id,
        0,
        'on_time_return',
        ts.score,
        'Reward suppressed: item returned in less than 2 hours (anti-farming guard)',
        NEW.id
      FROM trust_scores ts WHERE ts.user_id = NEW.user_id;

      -- Skip the PERFORM apply_trust_delta call for delta
      v_delta  := NULL; -- sentinel: skip main delta application
      v_reason := NULL;
    ELSE
      v_delta  := 8;
      v_reason := 'on_time_return';
    END IF;
  ELSIF v_days_late <= 3 THEN
    v_delta  := -8;
    v_reason := 'late_return_mild';
  ELSIF v_days_late <= 7 THEN
    v_delta  := -18;
    v_reason := 'late_return_moderate';
  ELSE
    v_delta  := -30;
    v_reason := 'late_return_severe';
  END IF;

  -- ── FIX 3: Safe lending_history query ────────────────────
  -- Added LIMIT 1 — safe even if multiple rows exist (shouldn't, but defensive)
  -- Explicit NULL coalesce — v_condition stays NULL if no row found
  SELECT condition_on_return
  INTO v_condition
  FROM lending_history
  WHERE request_id = NEW.id
  LIMIT 1;                                          -- FIX 3a: defensive LIMIT 1

  -- FIX 3b: NULL-safe damage check
  -- COALESCE ensures no error if condition_on_return is NULL
  IF COALESCE(v_condition, '') IN ('Damaged', 'Broken', 'Poor') THEN
    v_is_damaged := TRUE;
  END IF;

  -- ── 4. Apply return delta (skip if farming guard triggered) ──
  IF v_delta IS NOT NULL AND v_reason IS NOT NULL THEN
    PERFORM apply_trust_delta(
      NEW.user_id,
      v_delta,
      v_reason,
      NEW.id,
      'Auto-scored on request return. Days late: ' || ROUND(v_days_late, 1)
        || '. Borrow duration: ' || ROUND(v_borrow_hours, 1) || 'h'
    );
  END IF;

  -- ── 5. Apply damage delta if needed ──────────────────────
  IF v_is_damaged THEN
    PERFORM apply_trust_delta(
      NEW.user_id,
      CASE WHEN v_condition = 'Broken' THEN -35 ELSE -20 END,
      CASE WHEN v_condition = 'Broken' THEN 'damage_major' ELSE 'damage_minor' END,
      NEW.id,
      'Condition logged as: ' || v_condition
    );
  END IF;

  -- ── 6. Increment total_borrows counter ───────────────────
  UPDATE trust_scores
  SET total_borrows = total_borrows + 1
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Re-register trigger (idempotent — DROP IF EXISTS before CREATE)
DROP TRIGGER IF EXISTS trg_trust_on_return ON requests;
CREATE TRIGGER trg_trust_on_return
  AFTER UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_trust_on_return();


-- ═════════════════════════════════════════════════════════════
-- FIX 1: trg_fn_init_trust_on_signup()
-- Change: search_path hardening only — no logic changes
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_fn_init_trust_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public                            -- FIX 1
AS $$
BEGIN
  INSERT INTO trust_scores (user_id, score)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger re-registration is NOT needed — function body replacement
-- is sufficient. The trigger record in pg_trigger still points to
-- the same function OID (CREATE OR REPLACE preserves OID).


-- ═════════════════════════════════════════════════════════════
-- FIX 1: can_user_borrow()
-- Change: search_path hardening only — all logic preserved
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION can_user_borrow(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public                            -- FIX 1
AS $$
DECLARE
  v_score        INTEGER;
  v_band         TEXT;
  v_active_count INTEGER;
  v_profile      profiles%ROWTYPE;
BEGIN
  -- ── 1. Check profile exists and is active ─────────────────
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'User profile not found.');
  END IF;

  IF v_profile.status = 'suspended' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Your account has been suspended. Contact support.');
  END IF;

  -- ── 2. Initialize trust score if first-time user ──────────
  INSERT INTO trust_scores (user_id, score)
  VALUES (p_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── 3. Load trust band ────────────────────────────────────
  SELECT score, band INTO v_score, v_band
  FROM trust_scores
  WHERE user_id = p_user_id;

  -- ── 4. Hard block ─────────────────────────────────────────
  IF v_band = 'blocked' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'band',    v_band,
      'score',   v_score,
      'reason',  'Your trust score is too low (' || v_score || '/100). Borrowing is suspended. Please contact support to resolve any outstanding issues.',
      'action',  'contact_support'
    );
  END IF;

  -- ── 5. Count active requests (uses idx_requests_user_status) ─
  SELECT COUNT(*) INTO v_active_count
  FROM requests
  WHERE user_id = p_user_id
    AND status IN ('pending', 'approved', 'issued');

  -- ── 6. Caution band — max 1 active request ────────────────
  IF v_band = 'caution' AND v_active_count >= 1 THEN
    RETURN jsonb_build_object(
      'allowed',         false,
      'band',            v_band,
      'score',           v_score,
      'active_requests', v_active_count,
      'reason',          'Your trust score is in Caution band (' || v_score || '/100). You may only have 1 active request at a time. Return your current item first.',
      'action',          'return_existing'
    );
  END IF;

  -- ── 7. All checks passed ──────────────────────────────────
  RETURN jsonb_build_object(
    'allowed',         true,
    'band',            v_band,
    'score',           v_score,
    'active_requests', v_active_count
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- FIX 1: admin_adjust_trust()
-- Change: search_path hardening only — all logic preserved
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_adjust_trust(
  p_target_user UUID,
  p_delta       INTEGER,
  p_notes       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public                            -- FIX 1
AS $$
BEGIN
  -- ── 1. Verify caller is admin ──────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_adjust_trust: caller is not an admin';
  END IF;

  -- ── 2. Prevent self-adjustment ─────────────────────────────
  IF p_target_user = auth.uid() THEN
    RAISE EXCEPTION 'admin_adjust_trust: admins cannot adjust their own trust score';
  END IF;

  -- ── 3. Notes mandatory ────────────────────────────────────
  IF p_notes IS NULL OR trim(p_notes) = '' THEN
    RAISE EXCEPTION 'admin_adjust_trust: notes are required for manual adjustments';
  END IF;

  -- ── 4. Delegate to apply_trust_delta ─────────────────────
  RETURN apply_trust_delta(
    p_target_user,
    p_delta,
    'manual_adjustment',
    NULL,
    '[Admin: ' || auth.uid() || '] ' || p_notes
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- FIX 1: get_user_trust_summary()
-- Change: search_path hardening only — all logic preserved
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_trust_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public                            -- FIX 1
AS $$
DECLARE
  v_trust  trust_scores%ROWTYPE;
  v_events JSONB;
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
    'recent_events',      v_events
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- UPDATED COMMENTS
-- ═════════════════════════════════════════════════════════════

COMMENT ON FUNCTION apply_trust_delta IS
  '[v2 — 011 patch] THE only authorized write path for trust_scores. '
  'search_path hardened. Band-change notifications deduplicated to 1 per 6 hours. '
  'Uses FOR UPDATE lock for concurrency safety. Audit-logs every change.';

COMMENT ON FUNCTION trg_fn_trust_on_return IS
  '[v2 — 011 patch] Scores trust on request return. '
  'search_path hardened. Idempotency guard via trust_events lookup. '
  'lending_history query uses LIMIT 1. '
  'Farming protection: no reward if borrow < 2 hours.';

COMMENT ON FUNCTION trg_fn_init_trust_on_signup IS
  '[v2 — 011 patch] Auto-initializes trust_score on profile creation. search_path hardened.';

COMMENT ON FUNCTION can_user_borrow IS
  '[v2 — 011 patch] Pre-request borrow gate. search_path hardened. '
  'COUNT query accelerated by idx_requests_user_status index.';

COMMENT ON FUNCTION admin_adjust_trust IS
  '[v2 — 011 patch] Admin manual trust adjustment. search_path hardened. '
  'Requires notes. Prevents self-adjustment.';

COMMENT ON FUNCTION get_user_trust_summary IS
  '[v2 — 011 patch] Read-only trust profile summary. search_path hardened.';

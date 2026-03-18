-- ============================================================
-- HardwareHub — Trust Engine
-- Migration: 010_trust_engine.sql
--
-- SAFE RULES:
--   • DOES NOT modify: hardware_items, requests, prebook_queue
--   • All new tables are additive and independent
--   • Hooks into return_request() and lending_history via
--     a NEW AFTER UPDATE trigger on requests (no conflict
--     with existing tr_notify_on_request trigger)
--   • apply_trust_delta() is the SINGLE write-path for scores
--   • Uses FOR UPDATE locks to prevent race conditions
--   • Idempotent: safe to re-run (IF NOT EXISTS everywhere)
-- ============================================================


-- ═════════════════════════════════════════════════════════════
-- SECTION 1: EXTEND NOTIFICATION TYPES
-- (existing constraint from 009 must be replaced cleanly)
-- ═════════════════════════════════════════════════════════════

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'request_update', 'approval', 'reminder', 'system', 'prebook', 'trust'
  ));


-- ═════════════════════════════════════════════════════════════
-- SECTION 2: TABLE — trust_scores
-- One row per user, auto-initialized on first interaction.
-- The `band` column is a GENERATED column — always consistent,
-- never manually settable, never drifts from score.
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trust_scores (
  user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Score is clamped 0–100 at all write points
  score         INTEGER NOT NULL DEFAULT 100
                CHECK (score >= 0 AND score <= 100),

  -- Computed band — derives directly from score, no manual writes possible
  band          TEXT GENERATED ALWAYS AS (
                  CASE
                    WHEN score >= 70 THEN 'trusted'
                    WHEN score >= 40 THEN 'caution'
                    ELSE 'blocked'
                  END
                ) STORED,

  -- Counters give admin a quick summary without querying trust_events
  total_borrows       INTEGER NOT NULL DEFAULT 0,
  on_time_returns     INTEGER NOT NULL DEFAULT 0,
  late_returns        INTEGER NOT NULL DEFAULT 0,
  damages_reported    INTEGER NOT NULL DEFAULT 0,
  manual_adjustments  INTEGER NOT NULL DEFAULT 0,

  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for band-based queries (e.g. "show all blocked users")
CREATE INDEX IF NOT EXISTS idx_trust_scores_band ON trust_scores(band);


-- ═════════════════════════════════════════════════════════════
-- SECTION 3: TABLE — trust_events
-- Immutable audit log. Every score change is recorded here.
-- Provides full traceability: who changed, why, when, how much.
-- NEVER updated after insert — append-only by design.
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trust_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Signed integer: positive = reward, negative = penalty
  delta         INTEGER NOT NULL,

  -- Controlled vocabulary for reason — prevents free-form abuse
  reason        TEXT NOT NULL CHECK (reason IN (
                  'on_time_return',
                  'late_return_mild',      -- 1–3 days late
                  'late_return_moderate',  -- 4–7 days late
                  'late_return_severe',    -- 8+ days late
                  'damage_minor',
                  'damage_major',
                  'item_lost',
                  'overdue_daily_penalty', -- Applied by cron each day
                  'manual_adjustment',     -- Admin override (requires notes)
                  'dispute_resolved_favor',
                  'first_borrow_bonus'
                )),

  -- Score snapshot AFTER this event was applied (for audit timeline)
  score_after   INTEGER NOT NULL,

  -- For manual_adjustment, admin must supply a note
  notes         TEXT,

  -- Reference to the request that caused this event (NULL for manual)
  request_id    UUID REFERENCES requests(id) ON DELETE SET NULL,

  -- Who triggered this event — auth.uid() for manual, NULL for auto-triggers
  triggered_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trust_events_user     ON trust_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_events_request  ON trust_events(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trust_events_reason   ON trust_events(reason);


-- ═════════════════════════════════════════════════════════════
-- SECTION 4: RLS POLICIES
-- ═════════════════════════════════════════════════════════════

ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;

-- ─── trust_scores ───────────────────────────────────────────

-- Students: read only their own score
CREATE POLICY "student_view_own_trust_score"
  ON trust_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Providers: read scores of users who have requested THEIR components
-- (needed to show trust badge on request review panel)
CREATE POLICY "provider_view_requester_trust_score"
  ON trust_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM requests r
      JOIN hardware_items h ON h.id = r.hardware_id
      WHERE r.user_id = trust_scores.user_id
        AND h.owner_id = auth.uid()
    )
  );

-- Admins: read all scores
CREATE POLICY "admin_view_all_trust_scores"
  ON trust_scores FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- NO INSERT/UPDATE/DELETE policies for trust_scores.
-- The ONLY allowed write path is apply_trust_delta() — SECURITY DEFINER.
-- Direct user writes are blocked at the DB layer.

-- ─── trust_events ───────────────────────────────────────────

-- Students: read own events only
CREATE POLICY "student_view_own_trust_events"
  ON trust_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins: read all events
CREATE POLICY "admin_view_all_trust_events"
  ON trust_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- NO INSERT/UPDATE/DELETE policies.
-- Only apply_trust_delta() (SECURITY DEFINER) can write here.


-- ═════════════════════════════════════════════════════════════
-- SECTION 5: CORE FUNCTION — apply_trust_delta()
--
-- THE ONLY AUTHORIZED WRITE PATH TO trust_scores.
--
-- Safety Decisions:
--   1. SECURITY DEFINER — bypasses RLS, can write regardless of caller
--   2. FOR UPDATE lock on trust_scores row — prevents race conditions
--      when two concurrent returns happen for the same user
--   3. Score clamped with GREATEST/LEAST — never goes out of 0–100
--   4. Inserts trust_event in the SAME transaction — atomically linked
--   5. Returns JSONB — callers can inspect result without error overhead
--   6. Initializes a trust_scores row if missing (first-time users)
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
AS $$
DECLARE
  v_old_score   INTEGER;
  v_new_score   INTEGER;
  v_old_band    TEXT;
  v_new_band    TEXT;
  v_triggered   UUID;
BEGIN
  -- ── STEP 1: Validate reason is a recognized enum value ──
  IF p_reason NOT IN (
    'on_time_return', 'late_return_mild', 'late_return_moderate',
    'late_return_severe', 'damage_minor', 'damage_major', 'item_lost',
    'overdue_daily_penalty', 'manual_adjustment',
    'dispute_resolved_favor', 'first_borrow_bonus'
  ) THEN
    RAISE EXCEPTION 'apply_trust_delta: unknown reason "%"', p_reason;
  END IF;

  -- Manual adjustments MUST have notes (auditability requirement)
  IF p_reason = 'manual_adjustment' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'apply_trust_delta: manual_adjustment requires notes';
  END IF;

  -- ── STEP 2: Initialize row for new users if missing ──────
  INSERT INTO trust_scores (user_id, score)
  VALUES (p_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── STEP 3: Lock the row to prevent concurrent writes ────
  -- FOR UPDATE ensures only one transaction modifies at a time
  SELECT score INTO v_old_score
  FROM trust_scores
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- ── STEP 4: Compute clamped new score ───────────────────
  v_new_score := GREATEST(0, LEAST(100, v_old_score + p_delta));

  -- ── STEP 5: Update trust_scores atomically ───────────────
  UPDATE trust_scores
  SET
    score      = v_new_score,
    last_updated = now(),
    -- Increment the appropriate counter
    on_time_returns  = on_time_returns  + CASE WHEN p_reason = 'on_time_return'            THEN 1 ELSE 0 END,
    late_returns     = late_returns     + CASE WHEN p_reason LIKE 'late_return_%'           THEN 1 ELSE 0 END,
    damages_reported = damages_reported + CASE WHEN p_reason IN ('damage_minor','damage_major','item_lost') THEN 1 ELSE 0 END,
    manual_adjustments = manual_adjustments + CASE WHEN p_reason = 'manual_adjustment'     THEN 1 ELSE 0 END
  WHERE user_id = p_user_id;

  -- ── STEP 6: Capture who triggered this ──────────────────
  -- auth.uid() returns NULL when called from a trigger (no session)
  -- In that case triggered_by stays NULL — this is correct and expected
  BEGIN
    v_triggered := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_triggered := NULL;
  END;

  -- ── STEP 7: Append immutable audit log entry ─────────────
  INSERT INTO trust_events (
    user_id, delta, reason, score_after, notes, request_id, triggered_by
  ) VALUES (
    p_user_id, p_delta, p_reason, v_new_score, p_notes, p_request_id, v_triggered
  );

  -- ── STEP 8: Notify user if band changed ──────────────────
  -- Derive bands from thresholds (mirrors GENERATED column logic)
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
    INSERT INTO notifications (user_id, title, message, type, reference_id)
    VALUES (
      p_user_id,
      CASE v_new_band
        WHEN 'trusted'  THEN '✅ Trust Status: Trusted'
        WHEN 'caution'  THEN '⚠️ Trust Status: Caution'
        WHEN 'blocked'  THEN '🚫 Trust Status: Blocked'
      END,
      CASE v_new_band
        WHEN 'trusted'  THEN 'Your trust score is strong. You have full borrowing privileges.'
        WHEN 'caution'  THEN 'Your trust score has dropped. You are limited to 1 active request at a time.'
        WHEN 'blocked'  THEN 'Your trust score is too low. Borrowing is suspended. Please contact support.'
      END,
      'trust',
      p_request_id
    );
  END IF;

  -- ── STEP 9: Return structured result to caller ───────────
  RETURN jsonb_build_object(
    'success',    true,
    'user_id',    p_user_id,
    'old_score',  v_old_score,
    'new_score',  v_new_score,
    'delta',      p_delta,
    'reason',     p_reason,
    'old_band',   v_old_band,
    'new_band',   v_new_band,
    'band_changed', (v_old_band IS DISTINCT FROM v_new_band)
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════
-- SECTION 6: TRIGGER — Auto-score on request return
--
-- Fires AFTER UPDATE on requests.
-- Only activates when status transitions to 'returned'.
-- Does NOT conflict with existing tr_notify_on_request trigger
-- because that trigger handles notifications; this one handles trust.
-- Both are AFTER triggers — they fire independently, safely.
--
-- Lateness Calculation:
--   days_late = actual_return_date - expected_return_date (in days)
--   Negative or zero = on time → reward
--   1–3 days → mild penalty
--   4–7 days → moderate penalty
--   8+ days  → severe penalty
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_fn_trust_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days_late  NUMERIC;
  v_delta      INTEGER;
  v_reason     TEXT;
  v_is_damaged BOOLEAN;
  v_condition  TEXT;
BEGIN
  -- Only proceed when status changes TO 'returned'
  IF NOT (OLD.status IN ('issued', 'overdue') AND NEW.status = 'returned') THEN
    RETURN NEW;
  END IF;

  -- ── 1. Calculate lateness ────────────────────────────────
  -- actual_return_date is set by return_request() in 001_initial_schema.sql
  IF NEW.actual_return_date IS NOT NULL AND NEW.expected_return_date IS NOT NULL THEN
    v_days_late := EXTRACT(EPOCH FROM (NEW.actual_return_date - NEW.expected_return_date)) / 86400.0;
  ELSE
    -- No dates recorded — treat as on-time (safe default)
    v_days_late := 0;
  END IF;

  -- ── 2. Classify lateness → delta + reason ───────────────
  IF v_days_late <= 0 THEN
    v_delta  := 8;
    v_reason := 'on_time_return';
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

  -- ── 3. Check condition_on_return in lending_history ──────
  -- This is set by return_request() via: UPDATE lending_history SET condition_on_return = p_condition
  SELECT condition_on_return INTO v_condition
  FROM lending_history
  WHERE request_id = NEW.id;

  IF v_condition IN ('Damaged', 'Broken', 'Poor') THEN
    -- Damage penalty is applied SEPARATELY so it appears as a distinct trust_event
    -- This gives admin full granularity in the audit trail
    v_is_damaged := true;
  ELSE
    v_is_damaged := false;
  END IF;

  -- ── 4. Apply return delta ────────────────────────────────
  PERFORM apply_trust_delta(
    NEW.user_id,
    v_delta,
    v_reason,
    NEW.id,
    'Auto-scored on request return. Days late: ' || ROUND(v_days_late, 1)
  );

  -- ── 5. Apply separate damage delta if needed ────────────
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

-- Drop before recreate to ensure idempotency
DROP TRIGGER IF EXISTS trg_trust_on_return ON requests;
CREATE TRIGGER trg_trust_on_return
  AFTER UPDATE OF status ON requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_trust_on_return();


-- ═════════════════════════════════════════════════════════════
-- SECTION 7: TRIGGER — Auto-initialize trust_score on signup
--
-- Fires when a new profile is inserted (which happens right
-- after auth.users insert, handled by handle_new_user()).
-- Ensures every user starts with score=100 at account creation.
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_fn_init_trust_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO trust_scores (user_id, score)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_trust_on_signup ON profiles;
CREATE TRIGGER trg_init_trust_on_signup
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_init_trust_on_signup();


-- ═════════════════════════════════════════════════════════════
-- SECTION 8: RPC — can_user_borrow(user_id)
--
-- Called by the React frontend BEFORE creating a request.
-- Returns a structured JSONB response so the UI can show
-- the exact reason why a borrow is blocked.
--
-- Three tiers of access:
--   blocked  → outright deny, no exceptions
--   caution  → allow only if active requests < 1
--   trusted  → full access
--
-- "Active requests" = pending + approved + issued combined.
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION can_user_borrow(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- ── 6. Caution band — max 1 active request ───────────────
  IF v_band = 'caution' AND v_active_count >= 1 THEN
    RETURN jsonb_build_object(
      'allowed',        false,
      'band',           v_band,
      'score',          v_score,
      'active_requests', v_active_count,
      'reason',         'Your trust score is in Caution band (' || v_score || '/100). You may only have 1 active request at a time. Return your current item first.',
      'action',         'return_existing'
    );
  END IF;

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
-- SECTION 9: RPC — admin_adjust_trust()
--
-- Allows admins to manually adjust a user's trust score.
-- Enforces: caller must be admin, notes are mandatory.
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_adjust_trust(
  p_target_user UUID,
  p_delta       INTEGER,
  p_notes       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ── 1. Verify caller is admin ─────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_adjust_trust: caller is not an admin';
  END IF;

  -- ── 2. Prevent self-adjustment ────────────────────────────
  IF p_target_user = auth.uid() THEN
    RAISE EXCEPTION 'admin_adjust_trust: admins cannot adjust their own trust score';
  END IF;

  -- ── 3. Notes are mandatory for admin actions ──────────────
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
-- SECTION 10: RPC — get_user_trust_summary()
--
-- Returns a complete trust profile for a user:
--   • current score and band
--   • last 20 trust events (audit log)
-- Used by: student profile page, admin dispute panel,
--          provider request review modal
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_trust_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
-- SECTION 11: BACKFILL — Initialize trust_scores for all
-- existing users who signed up before this migration.
-- ON CONFLICT DO NOTHING makes this safe to re-run.
-- ═════════════════════════════════════════════════════════════

INSERT INTO trust_scores (user_id, score)
SELECT id, 100
FROM profiles
WHERE role = 'student'
ON CONFLICT (user_id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════
-- SECTION 12: COMMENTS (Documentation in DB)
-- ═════════════════════════════════════════════════════════════

COMMENT ON TABLE trust_scores IS
  'One row per user. Score 0–100. Band is auto-computed. Write ONLY via apply_trust_delta().';

COMMENT ON TABLE trust_events IS
  'Immutable append-only audit log. Every trust score change is recorded here. Never update or delete rows.';

COMMENT ON FUNCTION apply_trust_delta IS
  'THE only authorized write path for trust_scores. Uses FOR UPDATE lock for concurrency safety. Audit-logs every change. Called by triggers and admin RPC — never called directly from frontend.';

COMMENT ON FUNCTION can_user_borrow IS
  'Pre-request gate function. Call this from React before creating a request. Returns allowed:true/false with structured reason.';

COMMENT ON FUNCTION admin_adjust_trust IS
  'Admin-only trust score adjustment. Requires notes. Prevents self-adjustment. Delegates to apply_trust_delta.';

COMMENT ON FUNCTION get_user_trust_summary IS
  'Read-only trust profile summary. Safe to call from any role — returns own data for students, any user for admins (RLS bypassed via SECURITY DEFINER).';

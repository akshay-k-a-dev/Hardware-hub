-- ============================================================
-- Real-Time Trust Sync Update
-- Backfills and synchronizes drifted trust counters and sets 
-- real-time aggregation RPCs up so data never mismatches again.
-- ============================================================

-- 1. Mass Backfill any drifted counters in the actual trust_scores table.
UPDATE trust_scores ts
SET 
  total_borrows = COALESCE((SELECT COUNT(*) FROM requests r WHERE r.user_id = ts.user_id AND r.status IN ('issued', 'overdue', 'returned')), 0),
  on_time_returns = COALESCE((SELECT COUNT(*) FROM requests r WHERE r.user_id = ts.user_id AND r.status = 'returned' AND (r.actual_return_date <= r.expected_return_date OR r.expected_return_date IS NULL)), 0),
  late_returns = COALESCE((SELECT COUNT(*) FROM requests r WHERE r.user_id = ts.user_id AND r.status = 'returned' AND r.actual_return_date > r.expected_return_date) + (SELECT COUNT(*) FROM requests r WHERE r.user_id = ts.user_id AND r.status = 'overdue'), 0)
WHERE true;

-- For damages, lending_history has condition_on_return
UPDATE trust_scores ts
SET damages_reported = COALESCE((
  SELECT COUNT(*) 
  FROM lending_history lh
  JOIN requests r ON lh.request_id = r.id
  WHERE r.user_id = ts.user_id AND lh.condition_on_return IN ('Broken', 'Damaged', 'Poor', 'Major Damage')
), 0)
WHERE true;


-- 2. Update get_user_profile to ALWAYS compute in real-time, effectively bypassing cached drift.
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_real_total_borrows INTEGER;
  v_real_on_time INTEGER;
  v_real_late INTEGER;
BEGIN
  -- Aggregate REAL counts instead of relying entirely on triggers hitting edge cases
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('issued', 'overdue', 'returned')),
    COUNT(*) FILTER (WHERE status = 'returned' AND (actual_return_date <= expected_return_date OR expected_return_date IS NULL)),
    COUNT(*) FILTER (WHERE status = 'returned' AND actual_return_date > expected_return_date) + COUNT(*) FILTER (WHERE status = 'overdue')
  INTO 
    v_real_total_borrows,
    v_real_on_time,
    v_real_late
  FROM requests
  WHERE user_id = p_user_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'status', p.status,
    'created_at', p.created_at,
    'avatar_url', p.avatar_url,
    'full_name', p.full_name,
    'name', p.name,
    'bio', p.bio,
    'city', p.city,
    'phone', p.phone,
    'is_verified_email', p.is_verified_email,
    'is_verified_phone', COALESCE(p.phone_verified, p.is_verified_phone, false),
    'tinkerhub_id', p.tinkerhub_id,
    'academic_role', p.academic_role,
    'college_name', p.college_name,
    'lab_name', p.lab_name,
    'profile_completed', p.profile_completed,
    'trust', COALESCE(
      jsonb_build_object(
        'score', t.score,
        'band', t.band,
        'total_borrows', v_real_total_borrows,
        'on_time_returns', v_real_on_time,
        'late_returns', v_real_late
      ), 
      jsonb_build_object(
        'score', 100, 
        'band', 'trusted', 
        'total_borrows', v_real_total_borrows, 
        'on_time_returns', v_real_on_time, 
        'late_returns', v_real_late
      )
    )
  ) INTO v_result
  FROM profiles p
  LEFT JOIN trust_scores t ON t.user_id = p.id
  WHERE p.id = p_user_id;

  RETURN v_result;
END;
$$;


-- 3. Update get_user_trust_summary as well
CREATE OR REPLACE FUNCTION get_user_trust_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trust  trust_scores%ROWTYPE;
  v_events JSONB;
  v_real_total_borrows INTEGER;
  v_real_on_time INTEGER;
  v_real_late INTEGER;
  v_real_damages INTEGER;
BEGIN
  -- Initialize if not exists
  INSERT INTO trust_scores (user_id, score)
  VALUES (p_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_trust FROM trust_scores WHERE user_id = p_user_id;

  SELECT 
    COUNT(*) FILTER (WHERE status IN ('issued', 'overdue', 'returned')),
    COUNT(*) FILTER (WHERE status = 'returned' AND (actual_return_date <= expected_return_date OR expected_return_date IS NULL)),
    COUNT(*) FILTER (WHERE status = 'returned' AND actual_return_date > expected_return_date) + COUNT(*) FILTER (WHERE status = 'overdue')
  INTO 
    v_real_total_borrows,
    v_real_on_time,
    v_real_late
  FROM requests
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_real_damages
  FROM lending_history lh
  JOIN requests r ON lh.request_id = r.id
  WHERE r.user_id = p_user_id AND lh.condition_on_return IN ('Broken', 'Damaged', 'Poor', 'Major Damage');

  -- Last 20 events
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
    'total_borrows',      v_real_total_borrows,
    'on_time_returns',    v_real_on_time,
    'late_returns',       v_real_late,
    'damages_reported',   v_real_damages,
    'manual_adjustments', v_trust.manual_adjustments,
    'last_updated',       v_trust.last_updated,
    'recent_events',      v_events
  );
END;
$$;

-- ============================================================
-- SQL Script: Apply Security Linter Fixes (Idempotent)
-- File: 022_apply_search_path_fixes.sql
-- ============================================================
-- This script contains ONLY the CREATE OR REPLACE definitions
-- to securely apply "SET search_path = public" and "security_invoker = true"
-- on an existing, populated database without causing duplicate entity errors.

-- ═════════════════════════════════════════════════════════════
-- 1. SECURE PUBLIC PROFILE VIEW
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW profile_public WITH (security_invoker = true) AS
SELECT 
  p.id, 
  p.name, 
  p.email, 
  p.role, 
  p.lab_name,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.rating) as total_ratings
FROM profiles p
LEFT JOIN user_ratings r ON p.id = r.ratee_id
GROUP BY p.id, p.name, p.email, p.role, p.lab_name;

GRANT SELECT ON profile_public TO authenticated;
GRANT SELECT ON profile_public TO anon;


-- ═════════════════════════════════════════════════════════════
-- 2. CORE UTILITY FUNCTIONS
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═════════════════════════════════════════════════════════════
-- 3. SIGNUP & PROFILE RPCs (LATEST DEFINITIONS)
-- ═════════════════════════════════════════════════════════════
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


-- ═════════════════════════════════════════════════════════════
-- 4. USER RATINGS FUNCTIONS
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_user_rating(p_user_id UUID)
RETURNS JSONB
SET search_path = public
AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_total_ratings INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*) INTO v_avg_rating, v_total_ratings
  FROM user_ratings
  WHERE ratee_id = p_user_id;

  RETURN jsonb_build_object(
    'average_rating', COALESCE(v_avg_rating, 0),
    'total_ratings', v_total_ratings
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_multiple_user_ratings(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  average_rating NUMERIC,
  total_ratings BIGINT
)
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id, 
    COALESCE(AVG(r.rating), 0) as average_rating,
    COUNT(r.rating) as total_ratings
  FROM profiles p
  LEFT JOIN user_ratings r ON p.id = r.ratee_id
  WHERE p.id = ANY(p_user_ids)
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═════════════════════════════════════════════════════════════
-- 5. NOTIFICATION EVENT HANDLER
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_on_request_event()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_owner_id UUID;
  v_student_name TEXT;
BEGIN
  -- 1. Get references
  SELECT name, owner_id INTO v_item_name, v_owner_id 
  FROM hardware_items WHERE id = NEW.hardware_id;
  
  SELECT name INTO v_student_name FROM profiles WHERE id = NEW.user_id;

  -- 2. CASE: NEW REQUEST (Insert)
  IF (TG_OP = 'INSERT') THEN
    -- Notify the Provider
    INSERT INTO notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_owner_id,
      'New Lab Request',
      v_student_name || ' wants to borrow "' || v_item_name || '" for project: ' || NEW.project_title,
      'request_update',
      NEW.id
    );
  END IF;

  -- 3. CASE: STATUS CHANGE (Update)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Notify the Student
    IF NEW.status = 'approved' THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        NEW.user_id,
        'Request Approved!',
        'Your request for "' || v_item_name || '" has been approved. You can now collect it from the lab.',
        'approval',
        NEW.id
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        NEW.user_id,
        'Request Rejected',
        'Sorry, your request for "' || v_item_name || '" has been rejected. ' || COALESCE(NEW.provider_notes, ''),
        'request_update',
        NEW.id
      );
    ELSIF NEW.status = 'issued' THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        NEW.user_id,
        'Hardware Issued',
        'You have successfully collected "' || v_item_name || '". Please remember to return it by ' || COALESCE(NEW.expected_return_date::text, 'the deadline') || '.',
        'request_update',
        NEW.id
      );
    ELSIF NEW.status = 'returned' THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        NEW.user_id,
        'Hardware Returned',
        'Successfully returned "' || v_item_name || '". Thank you!',
        'request_update',
        NEW.id
      );
    ELSIF NEW.status = 'overdue' THEN
      INSERT INTO notifications (user_id, title, message, type, reference_id)
      VALUES (
        NEW.user_id,
        '🚨 OVERDUE WARNING',
        'The "' || v_item_name || '" is overdue. Please return it immediately to avoid penalties.',
        'reminder',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═════════════════════════════════════════════════════════════
-- 6. REQUEST & LENDING WORKFLOWS
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reject_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_request requests%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Can only reject pending requests'; END IF;

  SELECT * INTO v_hardware FROM hardware_items WHERE id = v_request.hardware_id;
  IF v_hardware.owner_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE requests SET status = 'rejected', provider_notes = COALESCE(p_notes, provider_notes) WHERE id = p_request_id;
  INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (v_request.user_id, 'Request Rejected', 'Your request for "' || v_request.project_title || '" was rejected.', 'request_update', p_request_id);

  RETURN json_build_object('success', true, 'message', 'Request rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION issue_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_condition TEXT DEFAULT 'Good'
)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_request requests%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'approved' THEN RAISE EXCEPTION 'Can only issue approved requests'; END IF;

  SELECT * INTO v_hardware FROM hardware_items WHERE id = v_request.hardware_id;
  IF v_hardware.owner_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE requests SET status = 'issued', issue_date = now(), provider_notes = COALESCE(p_notes, provider_notes) WHERE id = p_request_id;
  UPDATE lending_history SET condition_on_issue = p_condition WHERE request_id = p_request_id;
  INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (v_request.user_id, 'Hardware Issued', 'Hardware for "' || v_request.project_title || '" has been issued to you.', 'request_update', p_request_id);

  RETURN json_build_object('success', true, 'message', 'Hardware issued');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION return_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_condition TEXT DEFAULT 'Good'
)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_request requests%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status NOT IN ('issued', 'overdue') THEN RAISE EXCEPTION 'Can only return issued/overdue requests'; END IF;

  SELECT * INTO v_hardware FROM hardware_items WHERE id = v_request.hardware_id;
  IF v_hardware.owner_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE hardware_items SET quantity_available = quantity_available + v_request.quantity WHERE id = v_hardware.id;
  UPDATE requests SET status = 'returned', actual_return_date = now(), provider_notes = COALESCE(p_notes, provider_notes) WHERE id = p_request_id;
  UPDATE lending_history SET condition_on_return = p_condition, notes = p_notes WHERE request_id = p_request_id;
  INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (v_request.user_id, 'Hardware Returned', 'Hardware for "' || v_request.project_title || '" has been returned. Thank you!', 'request_update', p_request_id);

  RETURN json_build_object('success', true, 'message', 'Hardware returned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_request(p_request_id UUID)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_request requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_request.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'Cannot cancel this request'; END IF;

  IF v_request.status = 'approved' THEN
    UPDATE hardware_items SET quantity_available = quantity_available + v_request.quantity WHERE id = v_request.hardware_id;
  END IF;

  UPDATE requests SET status = 'cancelled' WHERE id = p_request_id;
  RETURN json_build_object('success', true, 'message', 'Request cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═════════════════════════════════════════════════════════════
-- 7. PREBOOK & WAITLIST QUEUE SYSTEM
-- ═════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prebook_item(p_hardware_id UUID)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hardware hardware_items%ROWTYPE;
  v_existing prebook_queue%ROWTYPE;
  v_next_position INTEGER;
  v_new_id UUID;
BEGIN
  -- Verify user is a student
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'student') THEN
    RAISE EXCEPTION 'Only students can pre-book items';
  END IF;

  -- Verify hardware exists
  SELECT * INTO v_hardware FROM hardware_items WHERE id = p_hardware_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hardware item not found';
  END IF;

  -- Must be out of stock to pre-book
  IF v_hardware.quantity_available > 0 THEN
    RAISE EXCEPTION 'Item is currently in stock. You can borrow it directly.';
  END IF;

  -- Check for existing active prebook
  SELECT * INTO v_existing FROM prebook_queue
    WHERE user_id = v_user_id AND hardware_id = p_hardware_id AND status IN ('waiting', 'notified');
  IF FOUND THEN
    RAISE EXCEPTION 'You already have an active pre-book for this item';
  END IF;

  -- Calculate next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
    FROM prebook_queue
    WHERE hardware_id = p_hardware_id AND status IN ('waiting', 'notified');

  -- Insert the prebook entry
  INSERT INTO prebook_queue (user_id, hardware_id, position, status)
    VALUES (v_user_id, p_hardware_id, v_next_position, 'waiting')
    RETURNING id INTO v_new_id;

  -- Notify the user of their queue position
  INSERT INTO notifications (user_id, title, message, type, reference_id)
  VALUES (
    v_user_id,
    'Pre-Book Confirmed',
    'You are #' || v_next_position || ' in the waitlist for "' || v_hardware.name || '". We''ll notify you when it''s available.',
    'prebook',
    v_new_id
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Pre-book confirmed',
    'position', v_next_position,
    'prebook_id', v_new_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_prebook(p_prebook_id UUID)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_prebook prebook_queue%ROWTYPE;
  v_hardware_name TEXT;
BEGIN
  SELECT * INTO v_prebook FROM prebook_queue WHERE id = p_prebook_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-book not found'; END IF;
  IF v_prebook.user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_prebook.status NOT IN ('waiting', 'notified') THEN
    RAISE EXCEPTION 'Can only cancel active pre-books';
  END IF;

  SELECT name INTO v_hardware_name FROM hardware_items WHERE id = v_prebook.hardware_id;

  -- If this user was notified (holding), release the held stock back
  IF v_prebook.status = 'notified' THEN
    UPDATE hardware_items SET quantity_available = quantity_available + 1
      WHERE id = v_prebook.hardware_id;
  END IF;

  -- Cancel and reorder positions
  UPDATE prebook_queue SET status = 'cancelled' WHERE id = p_prebook_id;

  -- Reorder remaining queue positions
  WITH reordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC) AS new_pos
    FROM prebook_queue
    WHERE hardware_id = v_prebook.hardware_id AND status IN ('waiting', 'notified')
  )
  UPDATE prebook_queue pb SET position = r.new_pos
    FROM reordered r WHERE pb.id = r.id;

  -- If was notified, process queue for next person
  IF v_prebook.status = 'notified' THEN
    PERFORM process_prebook_queue(v_prebook.hardware_id);
  END IF;

  RETURN json_build_object('success', true, 'message', 'Pre-book cancelled for "' || v_hardware_name || '"');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION process_prebook_queue(p_hardware_id UUID)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_next prebook_queue%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
  v_hold_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_hardware FROM hardware_items WHERE id = p_hardware_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Hardware not found');
  END IF;

  -- Only process if stock is available
  IF v_hardware.quantity_available <= 0 THEN
    RETURN json_build_object('success', true, 'message', 'No stock available to assign');
  END IF;

  -- Find the next waiting user
  SELECT * INTO v_next FROM prebook_queue
    WHERE hardware_id = p_hardware_id AND status = 'waiting'
    ORDER BY position ASC
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'message', 'No one in the waitlist');
  END IF;

  -- Set 24-hour hold
  v_hold_until := now() + INTERVAL '24 hours';

  -- Update prebook entry to notified with hold window
  UPDATE prebook_queue SET
    status = 'notified',
    notified_at = now(),
    hold_expires_at = v_hold_until
  WHERE id = v_next.id;

  -- Reserve 1 unit from stock
  UPDATE hardware_items SET quantity_available = quantity_available - 1
    WHERE id = p_hardware_id;

  -- Send notification to the user
  INSERT INTO notifications (user_id, title, message, type, reference_id)
  VALUES (
    v_next.user_id,
    '🎉 Your Pre-Booked Item is Available!',
    '"' || v_hardware.name || '" is now available for you! You have 24 hours to claim it before it passes to the next person in the queue.',
    'prebook',
    v_next.id
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Next user notified',
    'user_id', v_next.user_id,
    'hold_expires_at', v_hold_until
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION claim_prebook(
  p_prebook_id UUID,
  p_project_title TEXT DEFAULT 'Pre-Booked Item',
  p_project_description TEXT DEFAULT NULL
)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_prebook prebook_queue%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
  v_request_id UUID;
BEGIN
  SELECT * INTO v_prebook FROM prebook_queue WHERE id = p_prebook_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-book not found'; END IF;
  IF v_prebook.user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_prebook.status != 'notified' THEN RAISE EXCEPTION 'This pre-book is not in a claimable state'; END IF;

  -- Check hold hasn't expired
  IF v_prebook.hold_expires_at < now() THEN
    RAISE EXCEPTION 'Hold period has expired. The item may have been assigned to the next person in queue.';
  END IF;

  SELECT * INTO v_hardware FROM hardware_items WHERE id = v_prebook.hardware_id;

  -- Mark prebook as claimed
  UPDATE prebook_queue SET status = 'claimed' WHERE id = p_prebook_id;

  -- Restore 1 unit (was reserved during notify), then create a real request which will go through normal approval
  UPDATE hardware_items SET quantity_available = quantity_available + 1
    WHERE id = v_prebook.hardware_id;

  -- Create the borrow request
  INSERT INTO requests (user_id, hardware_id, quantity, project_title, project_description)
    VALUES (v_prebook.user_id, v_prebook.hardware_id, 1, p_project_title, p_project_description)
    RETURNING id INTO v_request_id;

  -- Notify user
  INSERT INTO notifications (user_id, title, message, type, reference_id)
  VALUES (
    v_prebook.user_id,
    'Pre-Book Claimed!',
    'Your pre-book for "' || v_hardware.name || '" has been converted to a borrow request. Awaiting lab approval.',
    'prebook',
    v_request_id
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Pre-book claimed and borrow request created',
    'request_id', v_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_stale_prebooks()
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_expired RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_expired IN
    SELECT * FROM prebook_queue
    WHERE status = 'notified' AND hold_expires_at < now()
  LOOP
    -- Re-release the held stock
    UPDATE hardware_items SET quantity_available = quantity_available + 1
      WHERE id = v_expired.hardware_id;

    -- Mark as expired
    UPDATE prebook_queue SET status = 'expired' WHERE id = v_expired.id;

    -- Notify user that their hold expired
    INSERT INTO notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_expired.user_id,
      'Pre-Book Hold Expired',
      'Your 24-hour hold has expired. The item has been passed to the next person in the queue.',
      'prebook',
      v_expired.id
    );

    -- Try to assign to the next person in the queue
    PERFORM process_prebook_queue(v_expired.hardware_id);

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'expired_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION on_stock_increase()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  -- Only fire when quantity_available goes from 0 to > 0
  -- or increases and there are people waiting
  IF NEW.quantity_available > OLD.quantity_available THEN
    -- Check if there's anyone waiting
    IF EXISTS (SELECT 1 FROM prebook_queue WHERE hardware_id = NEW.id AND status = 'waiting') THEN
      PERFORM process_prebook_queue(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_prebook_count(p_hardware_id UUID)
RETURNS INTEGER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM prebook_queue
    WHERE hardware_id = p_hardware_id AND status IN ('waiting', 'notified')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_prebook_position(p_hardware_id UUID, p_user_id UUID)
RETURNS JSON
SET search_path = public
AS $$
DECLARE
  v_prebook prebook_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_prebook FROM prebook_queue
    WHERE hardware_id = p_hardware_id AND user_id = p_user_id AND status IN ('waiting', 'notified')
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('in_queue', false);
  END IF;

  RETURN json_build_object(
    'in_queue', true,
    'prebook_id', v_prebook.id,
    'position', v_prebook.position,
    'status', v_prebook.status,
    'hold_expires_at', v_prebook.hold_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═════════════════════════════════════════════════════════════
-- 8. TRUST ENGINE SUPPORT & UTILITIES
-- ═════════════════════════════════════════════════════════════
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

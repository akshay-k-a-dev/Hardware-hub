-- ============================================================
-- HardwareHub — Pre-Book / Hold Item Queue
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── Pre-Book Queue Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS prebook_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hardware_id UUID NOT NULL REFERENCES hardware_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
    'waiting', 'notified', 'claimed', 'expired', 'cancelled'
  )),
  requested_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate active prebooks per user per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_prebook_active_user_item
  ON prebook_queue (user_id, hardware_id)
  WHERE status IN ('waiting', 'notified');

-- Indexes for fast queue lookups
CREATE INDEX IF NOT EXISTS idx_prebook_hardware_status ON prebook_queue(hardware_id, status);
CREATE INDEX IF NOT EXISTS idx_prebook_user ON prebook_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_prebook_position ON prebook_queue(hardware_id, position) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_prebook_hold_expiry ON prebook_queue(hold_expires_at) WHERE status = 'notified';

-- Updated-at trigger
CREATE TRIGGER trg_prebook_updated_at BEFORE UPDATE ON prebook_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE prebook_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prebooks"
  ON prebook_queue FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM hardware_items WHERE hardware_items.id = prebook_queue.hardware_id AND hardware_items.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students can insert prebooks"
  ON prebook_queue FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Users can update own prebooks"
  ON prebook_queue FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own prebooks"
  ON prebook_queue FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── Add 'prebook' to notifications type constraint ────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('request_update', 'approval', 'reminder', 'system', 'prebook'));


-- ═════════════════════════════════════════════════════════════
-- RPC FUNCTIONS
-- ═════════════════════════════════════════════════════════════

-- ─── Pre-Book an Item ───────────────────────────────────────
CREATE OR REPLACE FUNCTION prebook_item(p_hardware_id UUID)
RETURNS JSON AS $$
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

-- ─── Cancel Pre-Book ────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_prebook(p_prebook_id UUID)
RETURNS JSON AS $$
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

-- ─── Process Pre-Book Queue (notify next user) ─────────────
CREATE OR REPLACE FUNCTION process_prebook_queue(p_hardware_id UUID)
RETURNS JSON AS $$
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

-- ─── Claim Pre-Book (convert to borrow request) ────────────
CREATE OR REPLACE FUNCTION claim_prebook(
  p_prebook_id UUID,
  p_project_title TEXT DEFAULT 'Pre-Booked Item',
  p_project_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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


-- ─── Expire Stale Holds (call periodically or via cron) ────
CREATE OR REPLACE FUNCTION expire_stale_prebooks()
RETURNS JSON AS $$
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


-- ═════════════════════════════════════════════════════════════
-- TRIGGER: Auto-process queue when stock increases
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION on_stock_increase()
RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS trg_stock_increase ON hardware_items;
CREATE TRIGGER trg_stock_increase
  AFTER UPDATE OF quantity_available ON hardware_items
  FOR EACH ROW
  WHEN (NEW.quantity_available > OLD.quantity_available)
  EXECUTE FUNCTION on_stock_increase();

-- ─── Helper: Get queue count for a hardware item ────────────
CREATE OR REPLACE FUNCTION get_prebook_count(p_hardware_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM prebook_queue
    WHERE hardware_id = p_hardware_id AND status IN ('waiting', 'notified')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Helper: Get user's position in queue ───────────────────
CREATE OR REPLACE FUNCTION get_user_prebook_position(p_hardware_id UUID, p_user_id UUID)
RETURNS JSON AS $$
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

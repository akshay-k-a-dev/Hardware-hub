-- ============================================================
-- HardwareHub — Automatic Notification Triggers
-- ============================================================

-- Function to handle request notifications
CREATE OR REPLACE FUNCTION notify_on_request_event()
RETURNS TRIGGER AS $$
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

-- Create the Trigger
DROP TRIGGER IF EXISTS tr_notify_on_request ON requests;
CREATE TRIGGER tr_notify_on_request
  AFTER INSERT OR UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_request_event();

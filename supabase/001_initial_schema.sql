-- ============================================================
-- HardwareHub — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── Profiles (linked to Supabase Auth) ─────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'provider', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    'active'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Hardware Items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hardware_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Microcontroller', 'Single Board Computer', 'Sensor',
    'Motor', 'Motor Driver', 'Display', 'Communication',
    'Power Supply', 'Other'
  )),
  description TEXT,
  specs JSONB DEFAULT '{}',
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity_total INTEGER NOT NULL DEFAULT 1 CHECK (quantity_total >= 1),
  quantity_available INTEGER NOT NULL DEFAULT 1 CHECK (quantity_available >= 0),
  max_lending_days INTEGER NOT NULL DEFAULT 14 CHECK (max_lending_days >= 1),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hardware_id UUID NOT NULL REFERENCES hardware_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  project_title TEXT NOT NULL,
  project_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'issued', 'returned', 'overdue', 'cancelled'
  )),
  request_date TIMESTAMPTZ DEFAULT now(),
  approval_date TIMESTAMPTZ,
  issue_date TIMESTAMPTZ,
  expected_return_date TIMESTAMPTZ,
  actual_return_date TIMESTAMPTZ,
  provider_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Lending History ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lending_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  condition_on_issue TEXT DEFAULT 'Good',
  condition_on_return TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system' CHECK (type IN (
    'request_update', 'approval', 'reminder', 'system'
  )),
  is_read BOOLEAN DEFAULT false,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hardware_category ON hardware_items(category);
CREATE INDEX IF NOT EXISTS idx_hardware_status ON hardware_items(status);
CREATE INDEX IF NOT EXISTS idx_hardware_owner ON hardware_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_hardware ON requests(hardware_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- ─── Updated_at Trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hardware_updated_at BEFORE UPDATE ON hardware_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lending_updated_at BEFORE UPDATE ON lending_history FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ═════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── Profiles ───────────────────────────────────────────────
CREATE POLICY "Anyone authenticated can read profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "System can create profiles during signup"
  ON profiles FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Unauthenticated users and anon key can create profiles"
  ON profiles FOR INSERT TO anon
  WITH CHECK (true);

-- ─── Hardware Items ─────────────────────────────────────────
CREATE POLICY "Anyone authenticated can view hardware"
  ON hardware_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Providers can insert own hardware"
  ON hardware_items FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('provider', 'admin'))
  );

CREATE POLICY "Providers can update own hardware"
  ON hardware_items FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('provider', 'admin'))
  );

CREATE POLICY "Providers can delete own hardware"
  ON hardware_items FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('provider', 'admin'))
  );

-- ─── Requests ───────────────────────────────────────────────
CREATE POLICY "Students can view own requests"
  ON requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM hardware_items WHERE hardware_items.id = requests.hardware_id AND hardware_items.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students can create requests"
  ON requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Providers and admins can update requests"
  ON requests FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM hardware_items WHERE hardware_items.id = requests.hardware_id AND hardware_items.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Lending History ────────────────────────────────────────
CREATE POLICY "Authenticated users can view lending history"
  ON lending_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert lending history"
  ON lending_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Providers can update lending history"
  ON lending_history FOR UPDATE TO authenticated USING (true);

-- ─── Notifications ──────────────────────────────────────────
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════
-- DATABASE FUNCTIONS (RPCs) — Business Logic
-- ═════════════════════════════════════════════════════════════

-- ─── Approve Request ────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_lending_days INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request requests%ROWTYPE;
  v_hardware hardware_items%ROWTYPE;
  v_days INTEGER;
  v_expected_return TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Can only approve pending requests'; END IF;

  SELECT * INTO v_hardware FROM hardware_items WHERE id = v_request.hardware_id;
  IF v_hardware.quantity_available < v_request.quantity THEN
    RAISE EXCEPTION 'Insufficient stock: only % available', v_hardware.quantity_available;
  END IF;

  -- Check caller is the provider
  IF v_hardware.owner_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  v_days := COALESCE(p_lending_days, v_hardware.max_lending_days);
  v_expected_return := now() + (v_days || ' days')::INTERVAL;

  UPDATE hardware_items SET quantity_available = quantity_available - v_request.quantity WHERE id = v_hardware.id;
  UPDATE requests SET status = 'approved', approval_date = now(), expected_return_date = v_expected_return, provider_notes = COALESCE(p_notes, provider_notes) WHERE id = p_request_id;
  INSERT INTO lending_history (request_id, condition_on_issue) VALUES (p_request_id, 'Good');
  INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (v_request.user_id, 'Request Approved', 'Your request for "' || v_request.project_title || '" has been approved.', 'request_update', p_request_id);

  RETURN json_build_object('success', true, 'message', 'Request approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Reject Request ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION reject_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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

-- ─── Issue Request ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION issue_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_condition TEXT DEFAULT 'Good'
)
RETURNS JSON AS $$
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

-- ─── Return Request ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION return_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_condition TEXT DEFAULT 'Good'
)
RETURNS JSON AS $$
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

-- ─── Cancel Request ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_request(p_request_id UUID)
RETURNS JSON AS $$
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

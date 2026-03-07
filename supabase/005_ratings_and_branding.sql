-- ============================================================
-- HardwareHub — Ratings & Community Branding
-- ============================================================

-- 1. Add lab_name to profiles for Providers/Admins
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lab_name TEXT;

-- 2. Create User Ratings table
CREATE TABLE IF NOT EXISTS user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ratee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Function to get average rating for a user
CREATE OR REPLACE FUNCTION get_user_rating(p_user_id UUID)
RETURNS JSONB AS $$
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

-- 4. RLS for Ratings
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON user_ratings FOR SELECT USING (true);
CREATE POLICY "Lenders can rate borrowers of their items" ON user_ratings FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM requests r
    JOIN hardware_items h ON r.hardware_id = h.id
    WHERE r.id = request_id
    AND h.owner_id = auth.uid()
    AND r.status = 'returned'
  )
);

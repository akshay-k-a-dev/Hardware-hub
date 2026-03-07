-- 7. Batch fetch ratings for many users
CREATE OR REPLACE FUNCTION get_multiple_user_ratings(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  average_rating NUMERIC,
  total_ratings BIGINT
) AS $$
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

GRANT EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_multiple_user_ratings(UUID[]) TO anon;

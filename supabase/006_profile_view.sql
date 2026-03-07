-- 5. View for easier profile rating access
CREATE OR REPLACE VIEW profile_public AS
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

-- 6. Grant select access
GRANT SELECT ON profile_public TO authenticated;
GRANT SELECT ON profile_public TO anon;

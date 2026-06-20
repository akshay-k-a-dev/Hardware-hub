-- Fix Supabase Security Linter warning: "View public.profile_public is defined with the SECURITY DEFINER property"
-- We recreate the view with security_invoker = true so that it enforces RLS policies of the calling user.

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

-- Re-grant select access
GRANT SELECT ON profile_public TO authenticated;
GRANT SELECT ON profile_public TO anon;

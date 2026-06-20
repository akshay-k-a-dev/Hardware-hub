-- ============================================================
-- HardwareHub — Storage Setup
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create the bucket for component images
INSERT INTO storage.buckets (id, name, public)
VALUES ('component-images', 'component-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS for Storage (Optional but recommended)
-- The bucket is public, so object URLs remain accessible without broad listing.
-- Restrict metadata listing to owner folders and admins.
CREATE POLICY "Component image metadata access"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'component-images'
  AND (
    name LIKE (auth.uid()::TEXT || '/%')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
);

-- Allow authenticated users with provider/admin role to upload
CREATE POLICY "Provider Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'component-images'
  AND (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('provider', 'admin')
  ))
);

-- Allow owners to delete their own images
CREATE POLICY "Owner Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'component-images'
  AND (name LIKE (auth.uid() || '/%'))
);

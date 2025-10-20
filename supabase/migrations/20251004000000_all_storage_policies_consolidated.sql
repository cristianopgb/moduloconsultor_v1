/*
  # All Storage Policies - Consolidated Migration

  This migration consolidates ALL storage bucket policies into a single source of truth.
  It replaces these previous migrations:
  - Original: 20251004000000_consolidate_storage_policies.sql (references, previews)
  - 20251006175004_add_templates_storage_policies.sql (templates)
  - 20251006175818_fix_templates_storage_policies_conflict.sql (templates conflict fix)
  - 20251010000001_create_datasets_storage_bucket.sql (datasets)

  ## Buckets Managed
  1. **references** - Private bucket for user-uploaded reference files
  2. **previews** - Public bucket for HTML preview files
  3. **templates** - Public bucket for template thumbnails and files
  4. **datasets** - Private bucket for user-uploaded dataset files (CSV, XLSX, JSON)

  ## Security Model
  - Private buckets: Users can only access their own files (path: {user_id}/{filename})
  - Public buckets: Anyone can view, only authenticated users can upload/modify

  ## Idempotency
  - Drops all existing policies before creating new ones
  - Creates buckets if they don't exist
  - Safe to run multiple times
*/

-- ============================================================================
-- STEP 1: Remove ALL existing storage policies to prevent conflicts
-- ============================================================================

DO $$
DECLARE
  pol record;
  total_dropped integer := 0;
BEGIN
  -- Drop all policies from storage.objects table
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    total_dropped := total_dropped + 1;
  END LOOP;

  RAISE NOTICE '✅ Dropped % existing storage policies', total_dropped;
END $$;

-- ============================================================================
-- STEP 2: Ensure all buckets exist with correct settings
-- ============================================================================

-- Create 'references' bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'references',
  'references',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'application/json',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Create 'previews' bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'previews',
  'previews',
  true,
  10485760, -- 10MB
  ARRAY['text/html', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- Create 'templates' bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/html', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- Create 'datasets' bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'datasets',
  'datasets',
  false,
  104857600, -- 100MB
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/json',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600;

-- ============================================================================
-- STEP 3: REFERENCES bucket policies (private)
-- ============================================================================
-- Path pattern: {user_id}/{filename}

CREATE POLICY "references_bucket_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'references'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "references_bucket_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'references'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "references_bucket_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'references'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'references'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "references_bucket_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'references'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- STEP 4: PREVIEWS bucket policies (public read, authenticated write)
-- ============================================================================

CREATE POLICY "previews_bucket_select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'previews');

CREATE POLICY "previews_bucket_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'previews');

CREATE POLICY "previews_bucket_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'previews')
  WITH CHECK (bucket_id = 'previews');

CREATE POLICY "previews_bucket_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'previews');

-- ============================================================================
-- STEP 5: TEMPLATES bucket policies (public read, authenticated write)
-- ============================================================================

CREATE POLICY "templates_bucket_select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'templates');

CREATE POLICY "templates_bucket_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'templates');

CREATE POLICY "templates_bucket_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');

CREATE POLICY "templates_bucket_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'templates');

-- ============================================================================
-- STEP 6: DATASETS bucket policies (private)
-- ============================================================================
-- Path pattern: {user_id}/{filename}

CREATE POLICY "datasets_bucket_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'datasets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "datasets_bucket_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'datasets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "datasets_bucket_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'datasets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'datasets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "datasets_bucket_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'datasets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

-- List all buckets with their settings
SELECT
  id,
  name,
  public,
  file_size_limit / 1048576 AS size_limit_mb,
  array_length(allowed_mime_types, 1) AS mime_type_count
FROM storage.buckets
WHERE id IN ('references', 'previews', 'templates', 'datasets')
ORDER BY id;

-- List all storage policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

/*
  # Consolidated Tags Indexes Migration

  This migration consolidates three previous index-related migrations:
  - 20251006170841_add_tags_index_to_models.sql
  - 20251006174009_fix_tags_index_size_limit.sql
  - 20251006175034_remove_problematic_gin_indexes.sql

  ## Problem
  - Initial GIN index on tags array caused errors when array was too large (>146 items)
  - Error: "index row requires 105496 bytes, maximum size is 8191"
  - HTML templates with many variables exceeded PostgreSQL's index row size limit

  ## Solution
  - Remove all problematic full GIN indexes on tags arrays
  - Create partial GIN index only for reasonably-sized tag arrays (≤20 items)
  - Add supporting indexes on category and preview_image_url
  - This prevents index bloat while maintaining performance for normal use cases

  ## Impact
  - Templates with >20 tags won't be indexed (acceptable tradeoff)
  - Normal templates (5-10 tags) still have fast search performance
  - Search on tags_detectadas remains unindexed (rarely searched)
*/

-- ============================================================================
-- STEP 1: Remove all existing problematic indexes
-- ============================================================================

-- Drop full GIN indexes that cause size errors
DROP INDEX IF EXISTS idx_models_tags;
DROP INDEX IF EXISTS idx_models_tags_gin;
DROP INDEX IF EXISTS models_tags_idx;

-- Drop GIN index on tags_detectadas (not used for search)
DROP INDEX IF EXISTS models_tags_detectadas_idx;

-- ============================================================================
-- STEP 2: Create optimized partial index for tags
-- ============================================================================

-- Create partial GIN index only for reasonably-sized tag arrays
-- This prevents the "index row size" error while keeping performance good
CREATE INDEX IF NOT EXISTS idx_models_tags_small
  ON models USING GIN (tags)
  WHERE array_length(tags, 1) IS NOT NULL
    AND array_length(tags, 1) <= 20;

COMMENT ON INDEX idx_models_tags_small IS 'Partial GIN index on tags for arrays with ≤20 items to avoid index row size limit';

-- ============================================================================
-- STEP 3: Create supporting indexes for template filtering
-- ============================================================================

-- Index on category for combined filtering
CREATE INDEX IF NOT EXISTS idx_models_category
  ON models (category);

COMMENT ON INDEX idx_models_category IS 'B-tree index on category for fast filtering by template category';

-- Index on preview_image_url to quickly filter templates with/without thumbnails
CREATE INDEX IF NOT EXISTS idx_models_has_preview
  ON models (preview_image_url)
  WHERE preview_image_url IS NOT NULL;

COMMENT ON INDEX idx_models_has_preview IS 'Partial index on preview_image_url for templates with thumbnails';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all indexes on models table
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'models'
  AND schemaname = 'public'
  AND (indexname LIKE '%tags%' OR indexname LIKE '%category%' OR indexname LIKE '%preview%')
ORDER BY indexname;

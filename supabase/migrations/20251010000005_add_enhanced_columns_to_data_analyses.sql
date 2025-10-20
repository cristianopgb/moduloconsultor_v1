/*
  # Add Enhanced Analysis Columns

  1. Schema Changes
    - Add `quality_report` (jsonb) - Stores data quality validation results
    - Add `methodology_used` (text) - Describes the analysis approach used
    - Add `iterations_count` (integer) - Number of iterative refinements performed
    - Add `confidence_score` (integer) - Confidence level in results (0-100)
    - Add `visualizations` (jsonb) - Stores chart configurations and insights
    - Add `narrative` (jsonb) - Stores executive narrative structure
    - Add `processing_mode` (text) - Indicates if template, free-form, or hybrid was used

  2. Purpose
    - Support Enhanced Analysis System with full storytelling capabilities
    - Store quality metrics and validation results
    - Enable advanced visualization and narrative generation
    - Track confidence and methodology for transparency

  3. Backward Compatibility
    - All columns are nullable to support existing records
    - No breaking changes to existing queries
*/

-- Add Enhanced Analysis columns
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS quality_report jsonb;
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS methodology_used text;
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS iterations_count integer DEFAULT 1;
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS confidence_score integer;
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS visualizations jsonb;
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS narrative jsonb;
ALTER TABLE data_analyses ADD COLUMN IF NOT EXISTS processing_mode text DEFAULT 'template';

-- Add check constraint for confidence_score
ALTER TABLE data_analyses ADD CONSTRAINT confidence_score_range
  CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

-- Add check constraint for processing_mode
ALTER TABLE data_analyses ADD CONSTRAINT valid_processing_mode
  CHECK (processing_mode IS NULL OR processing_mode IN ('template', 'free-form', 'hybrid', 'enhanced'));

-- Create index for faster filtering by confidence
CREATE INDEX IF NOT EXISTS idx_data_analyses_confidence
  ON data_analyses(confidence_score)
  WHERE confidence_score IS NOT NULL;

-- Create index for filtering by processing mode
CREATE INDEX IF NOT EXISTS idx_data_analyses_processing_mode
  ON data_analyses(processing_mode)
  WHERE processing_mode IS NOT NULL;

-- Add comment explaining Enhanced fields
COMMENT ON COLUMN data_analyses.quality_report IS 'JSON containing data quality validation results from Enhanced Analyzer';
COMMENT ON COLUMN data_analyses.methodology_used IS 'Description of analysis methodology applied (e.g., OTIF Analysis, ABC Curve)';
COMMENT ON COLUMN data_analyses.iterations_count IS 'Number of iterative refinement cycles performed';
COMMENT ON COLUMN data_analyses.confidence_score IS 'Confidence level in results (0-100), based on validation checks';
COMMENT ON COLUMN data_analyses.visualizations IS 'JSON containing chart configurations and insights for frontend rendering';
COMMENT ON COLUMN data_analyses.narrative IS 'JSON containing structured narrative (executive summary, findings, conclusions, recommendations)';
COMMENT ON COLUMN data_analyses.processing_mode IS 'Analysis mode used: template (pre-defined), free-form (domain-specific), hybrid, or enhanced';

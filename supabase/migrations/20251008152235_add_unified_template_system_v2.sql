/*
  # Unified Template System for Analytics and Presentation (v2)
  
  ## Overview
  This migration adds support for a unified template system where:
  - Templates can be either 'analytics' (SQL-based, auto-selected) or 'presentation' (HTML-based, user-selected)
  - Chat conversations have modes: 'analytics' or 'presentation'
  - Messages link to analyses and templates for full persistence
  
  ## Changes
  
  1. **models table** - Add template type differentiation
     - `template_type` (text) - 'analytics' or 'presentation'
     - `sql_template` (text) - SQL query template for analytics
     - `required_columns` (jsonb) - Column mappings for SQL placeholders
     - `semantic_tags` (jsonb) - Tags for automatic template detection
     - Make `file_type` nullable for analytics templates
  
  2. **conversations table** - Add chat mode tracking
     - `chat_mode` (text) - 'analytics' or 'presentation'
  
  3. **messages table** - Enhanced analysis persistence
     - `template_used_id` (uuid) - Which template was used
     - `message_type` (text) - 'text', 'analysis_result', or 'presentation'
  
  4. **Indexes** - Performance optimization
  
  5. **Default Data** - Standard analytics templates
  
  ## Security
  - All tables already have RLS enabled
  - Existing policies continue to work
*/

-- ============================================================================
-- PART 1: EXTEND models TABLE FOR UNIFIED TEMPLATES
-- ============================================================================

-- Make file_type nullable (analytics templates don't need it)
ALTER TABLE models ALTER COLUMN file_type DROP NOT NULL;

-- Add template_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'template_type'
  ) THEN
    ALTER TABLE models ADD COLUMN template_type text NOT NULL DEFAULT 'presentation'
      CHECK (template_type IN ('presentation', 'analytics'));
  END IF;
END $$;

-- Add sql_template column for analytics templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'sql_template'
  ) THEN
    ALTER TABLE models ADD COLUMN sql_template text;
  END IF;
END $$;

-- Add required_columns for SQL placeholder mapping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'required_columns'
  ) THEN
    ALTER TABLE models ADD COLUMN required_columns jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add semantic_tags for automatic template detection
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'semantic_tags'
  ) THEN
    ALTER TABLE models ADD COLUMN semantic_tags jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index on template_type for filtering
CREATE INDEX IF NOT EXISTS models_template_type_idx ON models(template_type);

-- Add comments
COMMENT ON COLUMN models.template_type IS 'Type of template: presentation (HTML, user-selects) or analytics (SQL, auto-selected)';
COMMENT ON COLUMN models.sql_template IS 'Parametrized SQL query for analytics templates with placeholders like {{value_col}}, {{group_col}}';
COMMENT ON COLUMN models.required_columns IS 'Maps SQL placeholders to column requirements: {"value_col": {"type": "numeric", "description": "Column with values to aggregate"}}';
COMMENT ON COLUMN models.semantic_tags IS 'Keywords for automatic template detection: ["vendas", "receita", "ticket", "media"]';

-- ============================================================================
-- PART 2: EXTEND conversations TABLE FOR CHAT MODES
-- ============================================================================

-- Add chat_mode column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'chat_mode'
  ) THEN
    ALTER TABLE conversations ADD COLUMN chat_mode text NOT NULL DEFAULT 'analytics'
      CHECK (chat_mode IN ('analytics', 'presentation'));
  END IF;
END $$;

-- Create index on chat_mode
CREATE INDEX IF NOT EXISTS conversations_chat_mode_idx ON conversations(chat_mode);

-- Add comment
COMMENT ON COLUMN conversations.chat_mode IS 'Current chat mode: analytics (auto template selection) or presentation (manual template selection)';

-- ============================================================================
-- PART 3: EXTEND messages TABLE FOR ENHANCED PERSISTENCE
-- ============================================================================

-- Add template_used_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'template_used_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN template_used_id uuid REFERENCES models(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add message_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type text NOT NULL DEFAULT 'text'
      CHECK (message_type IN ('text', 'analysis_result', 'presentation'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS messages_template_used_id_idx ON messages(template_used_id);
CREATE INDEX IF NOT EXISTS messages_message_type_idx ON messages(message_type);

-- Add comments
COMMENT ON COLUMN messages.template_used_id IS 'Which template was used to generate this message (for analytics or presentation)';
COMMENT ON COLUMN messages.message_type IS 'Type of message: text (normal), analysis_result (contains analysis), presentation (generated document)';

-- ============================================================================
-- PART 4: CREATE DEFAULT ANALYTICS TEMPLATES
-- ============================================================================

-- Insert default analytics templates
INSERT INTO models (
  id,
  name,
  category,
  template_type,
  file_type,
  sql_template,
  required_columns,
  semantic_tags,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'Ticket Médio por Grupo',
  'Analytics',
  'analytics',
  NULL,
  'SELECT {{group_col}} as grupo, AVG({{value_col}}) as ticket_medio, COUNT(*) as quantidade FROM temp_data GROUP BY {{group_col}} ORDER BY ticket_medio DESC',
  '{"group_col": {"type": "text", "description": "Coluna de agrupamento (ex: região, categoria)"}, "value_col": {"type": "numeric", "description": "Coluna com valores para calcular média"}}'::jsonb,
  '["ticket", "média", "medio", "average", "vendas", "valor"]'::jsonb,
  'Calcula o ticket médio agrupado por uma categoria (região, produto, etc)',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM models WHERE name = 'Ticket Médio por Grupo' AND template_type = 'analytics'
);

INSERT INTO models (
  id,
  name,
  category,
  template_type,
  file_type,
  sql_template,
  required_columns,
  semantic_tags,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'Top N Itens',
  'Analytics',
  'analytics',
  NULL,
  'SELECT {{group_col}} as item, SUM({{value_col}}) as total FROM temp_data GROUP BY {{group_col}} ORDER BY total DESC LIMIT {{limit}}',
  '{"group_col": {"type": "text", "description": "Coluna com itens"}, "value_col": {"type": "numeric", "description": "Coluna com valores"}, "limit": {"type": "integer", "description": "Número de itens", "default": 10}}'::jsonb,
  '["top", "maior", "melhor", "ranking", "principal"]'::jsonb,
  'Retorna os N itens com maiores valores',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM models WHERE name = 'Top N Itens' AND template_type = 'analytics'
);

INSERT INTO models (
  id,
  name,
  category,
  template_type,
  file_type,
  sql_template,
  required_columns,
  semantic_tags,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'Soma por Grupo',
  'Analytics',
  'analytics',
  NULL,
  'SELECT {{group_col}} as categoria, SUM({{value_col}}) as total, COUNT(*) as quantidade FROM temp_data GROUP BY {{group_col}} ORDER BY total DESC',
  '{"group_col": {"type": "text", "description": "Coluna de agrupamento"}, "value_col": {"type": "numeric", "description": "Coluna com valores para somar"}}'::jsonb,
  '["soma", "total", "somar", "sum", "agregado"]'::jsonb,
  'Soma valores agrupados por categoria',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM models WHERE name = 'Soma por Grupo' AND template_type = 'analytics'
);

INSERT INTO models (
  id,
  name,
  category,
  template_type,
  file_type,
  sql_template,
  required_columns,
  semantic_tags,
  description,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'Contagem por Categoria',
  'Analytics',
  'analytics',
  NULL,
  'SELECT {{group_col}} as categoria, COUNT(*) as quantidade, COUNT(DISTINCT {{group_col}}) as distintos FROM temp_data GROUP BY {{group_col}} ORDER BY quantidade DESC',
  '{"group_col": {"type": "text", "description": "Coluna para contar"}}'::jsonb,
  '["contagem", "count", "quantidade", "frequencia", "distribuição"]'::jsonb,
  'Conta ocorrências por categoria',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM models WHERE name = 'Contagem por Categoria' AND template_type = 'analytics'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'template_type') THEN
    RAISE EXCEPTION 'Column models.template_type was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'chat_mode') THEN
    RAISE EXCEPTION 'Column conversations.chat_mode was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
    RAISE EXCEPTION 'Column messages.message_type was not created';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully! Unified template system is ready.';
END $$;

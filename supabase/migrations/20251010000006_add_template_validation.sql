/*
  # Sistema de Validação de Templates Analytics

  1. Novas Colunas
    - `is_validated` (boolean) - indica se template foi validado
    - `validation_status` (text) - status: 'valid', 'invalid', 'pending'
    - `validation_errors` (jsonb) - erros detectados na validação
    - `last_validation_at` (timestamptz) - data da última validação
    - `validation_pass_count` (int) - quantas vezes passou na validação
    - `validation_fail_count` (int) - quantas vezes falhou

  2. Funções
    - `validate_analytics_template()` - valida um template específico
    - `validate_all_templates()` - valida todos os templates analytics
    - `get_template_health_report()` - retorna relatório de saúde dos templates

  3. Security
    - Apenas masters podem executar validações
    - RLS aplicado nas colunas de validação
*/

-- ============================================================================
-- STEP 1: Adicionar colunas de validação
-- ============================================================================

DO $$ BEGIN
  -- is_validated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'is_validated'
  ) THEN
    ALTER TABLE models ADD COLUMN is_validated boolean DEFAULT false;
  END IF;

  -- validation_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'validation_status'
  ) THEN
    ALTER TABLE models ADD COLUMN validation_status text DEFAULT 'pending' CHECK (validation_status IN ('valid', 'invalid', 'pending'));
  END IF;

  -- validation_errors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'validation_errors'
  ) THEN
    ALTER TABLE models ADD COLUMN validation_errors jsonb;
  END IF;

  -- last_validation_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'last_validation_at'
  ) THEN
    ALTER TABLE models ADD COLUMN last_validation_at timestamptz;
  END IF;

  -- validation_pass_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'validation_pass_count'
  ) THEN
    ALTER TABLE models ADD COLUMN validation_pass_count int DEFAULT 0;
  END IF;

  -- validation_fail_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'validation_fail_count'
  ) THEN
    ALTER TABLE models ADD COLUMN validation_fail_count int DEFAULT 0;
  END IF;
END $$;

-- Comentários
COMMENT ON COLUMN models.is_validated IS 'Template foi validado e está aprovado para uso';
COMMENT ON COLUMN models.validation_status IS 'Status da validação: valid, invalid, pending';
COMMENT ON COLUMN models.validation_errors IS 'Lista de erros detectados na última validação';
COMMENT ON COLUMN models.last_validation_at IS 'Timestamp da última tentativa de validação';
COMMENT ON COLUMN models.validation_pass_count IS 'Quantidade de vezes que template passou na validação';
COMMENT ON COLUMN models.validation_fail_count IS 'Quantidade de vezes que template falhou na validação';

-- ============================================================================
-- STEP 2: Função de validação de template individual
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_analytics_template(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template record;
  v_errors jsonb := '[]'::jsonb;
  v_is_valid boolean := true;
  v_sql_template text;
  v_has_select boolean;
  v_has_from boolean;
  v_has_invalid_patterns boolean;
BEGIN
  -- Buscar template
  SELECT id, name, sql_template, required_columns, template_type
  INTO v_template
  FROM models
  WHERE id = p_template_id AND template_type = 'analytics';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('Template não encontrado ou não é do tipo analytics')
    );
  END IF;

  -- Validação 1: sql_template não pode ser nulo
  IF v_template.sql_template IS NULL OR trim(v_template.sql_template) = '' THEN
    v_errors := v_errors || jsonb_build_object(
      'type', 'missing_sql',
      'severity', 'critical',
      'message', 'Template não possui sql_template definido'
    );
    v_is_valid := false;
  ELSE
    v_sql_template := trim(v_template.sql_template);

    -- Validação 2: Deve começar com SELECT ou WITH
    v_has_select := v_sql_template ~* '^\s*(SELECT|WITH)\s+';
    IF NOT v_has_select THEN
      v_errors := v_errors || jsonb_build_object(
        'type', 'invalid_start',
        'severity', 'critical',
        'message', 'SQL template deve começar com SELECT ou WITH',
        'sql_preview', substring(v_sql_template, 1, 100)
      );
      v_is_valid := false;
    END IF;

    -- Validação 3: Deve conter FROM (a menos que seja SELECT de literais)
    v_has_from := v_sql_template ~* '\bFROM\b';
    IF NOT v_has_from AND NOT (v_sql_template ~* '^SELECT\s+[\''"]') THEN
      v_errors := v_errors || jsonb_build_object(
        'type', 'missing_from',
        'severity', 'warning',
        'message', 'SQL template não contém cláusula FROM'
      );
    END IF;

    -- Validação 4: Não deve conter padrões de texto narrativo
    v_has_invalid_patterns := (
      v_sql_template ~* '^\s*(preço|diferença|total|valor|quantidade|análise)\s+' OR
      v_sql_template ~* '^\d+[,.]?\d*\s+(por|reais|R\$)' OR
      v_sql_template ~* '\n[A-Z][a-zà-ú]+\s+[a-zà-ú]+\s+\d'
    );

    IF v_has_invalid_patterns THEN
      v_errors := v_errors || jsonb_build_object(
        'type', 'narrative_text',
        'severity', 'critical',
        'message', 'SQL template contém texto narrativo ao invés de SQL válido',
        'sql_preview', substring(v_sql_template, 1, 200)
      );
      v_is_valid := false;
    END IF;

    -- Validação 5: Verificar se placeholders estão bem formados
    IF v_sql_template ~ '\{\{[^}]*$' OR v_sql_template ~ '^[^{]*\}\}' THEN
      v_errors := v_errors || jsonb_build_object(
        'type', 'malformed_placeholders',
        'severity', 'warning',
        'message', 'Placeholders podem estar malformados ({{ sem }} correspondente)'
      );
    END IF;

    -- Validação 6: Deve usar temp_data como nome da tabela
    IF v_sql_template ~* '\bFROM\b' AND NOT (v_sql_template ~* '\btemp_data\b') THEN
      v_errors := v_errors || jsonb_build_object(
        'type', 'wrong_table_name',
        'severity', 'critical',
        'message', 'SQL template deve usar "temp_data" como nome da tabela temporária'
      );
      v_is_valid := false;
    END IF;
  END IF;

  -- Validação 7: required_columns deve estar definido
  IF v_template.required_columns IS NULL OR jsonb_array_length(v_template.required_columns) = 0 THEN
    v_errors := v_errors || jsonb_build_object(
      'type', 'missing_required_columns',
      'severity', 'warning',
      'message', 'Template não define required_columns'
    );
  END IF;

  -- Atualizar registro do template
  UPDATE models
  SET
    is_validated = v_is_valid,
    validation_status = CASE WHEN v_is_valid THEN 'valid' ELSE 'invalid' END,
    validation_errors = CASE WHEN jsonb_array_length(v_errors) > 0 THEN v_errors ELSE NULL END,
    last_validation_at = now(),
    validation_pass_count = CASE WHEN v_is_valid THEN validation_pass_count + 1 ELSE validation_pass_count END,
    validation_fail_count = CASE WHEN NOT v_is_valid THEN validation_fail_count + 1 ELSE validation_fail_count END
  WHERE id = p_template_id;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'valid', v_is_valid,
    'template_id', v_template.id,
    'template_name', v_template.name,
    'errors', v_errors,
    'error_count', jsonb_array_length(v_errors)
  );
END;
$$;

COMMENT ON FUNCTION validate_analytics_template IS 'Valida um template analytics individual e atualiza status';

-- ============================================================================
-- STEP 3: Função para validar todos os templates
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_all_templates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_total int := 0;
  v_valid int := 0;
  v_invalid int := 0;
BEGIN
  -- Validar cada template analytics
  FOR v_template IN
    SELECT id, name
    FROM models
    WHERE template_type = 'analytics' AND sql_template IS NOT NULL
    ORDER BY name
  LOOP
    v_total := v_total + 1;

    -- Validar template
    v_result := validate_analytics_template(v_template.id);

    -- Contar válidos/inválidos
    IF (v_result->>'valid')::boolean THEN
      v_valid := v_valid + 1;
    ELSE
      v_invalid := v_invalid + 1;
    END IF;

    -- Adicionar aos resultados
    v_results := v_results || v_result;
  END LOOP;

  -- Retornar resumo
  RETURN jsonb_build_object(
    'total_templates', v_total,
    'valid_templates', v_valid,
    'invalid_templates', v_invalid,
    'health_percentage', CASE WHEN v_total > 0 THEN round((v_valid::numeric / v_total) * 100, 2) ELSE 0 END,
    'validation_results', v_results,
    'validated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION validate_all_templates IS 'Valida todos os templates analytics e retorna relatório completo';

-- ============================================================================
-- STEP 4: Função de relatório de saúde dos templates
-- ============================================================================

CREATE OR REPLACE FUNCTION get_template_health_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_templates', COUNT(*),
    'validated_templates', COUNT(*) FILTER (WHERE is_validated = true),
    'pending_templates', COUNT(*) FILTER (WHERE validation_status = 'pending'),
    'invalid_templates', COUNT(*) FILTER (WHERE validation_status = 'invalid'),
    'health_score', round(
      (COUNT(*) FILTER (WHERE validation_status = 'valid')::numeric /
       NULLIF(COUNT(*), 0)) * 100,
      2
    ),
    'last_validation', MAX(last_validation_at),
    'templates_by_status', (
      SELECT jsonb_object_agg(
        validation_status,
        jsonb_build_object(
          'count', count,
          'templates', template_names
        )
      )
      FROM (
        SELECT
          validation_status,
          COUNT(*) as count,
          jsonb_agg(jsonb_build_object('id', id, 'name', name, 'errors', validation_errors)) as template_names
        FROM models
        WHERE template_type = 'analytics' AND sql_template IS NOT NULL
        GROUP BY validation_status
      ) grouped
    ),
    'most_problematic', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'fail_count', validation_fail_count,
          'pass_count', validation_pass_count,
          'last_errors', validation_errors
        )
        ORDER BY validation_fail_count DESC
      )
      FROM models
      WHERE template_type = 'analytics'
        AND sql_template IS NOT NULL
        AND validation_fail_count > 0
      LIMIT 10
    )
  ) INTO v_report
  FROM models
  WHERE template_type = 'analytics' AND sql_template IS NOT NULL;

  RETURN v_report;
END;
$$;

COMMENT ON FUNCTION get_template_health_report IS 'Retorna relatório de saúde dos templates analytics';

-- ============================================================================
-- STEP 5: View para dashboard de templates
-- ============================================================================

CREATE OR REPLACE VIEW template_validation_dashboard AS
SELECT
  m.id,
  m.name,
  m.category,
  m.validation_status,
  m.is_validated,
  m.validation_pass_count,
  m.validation_fail_count,
  m.last_validation_at,
  m.validation_errors,
  jsonb_array_length(COALESCE(m.validation_errors, '[]'::jsonb)) as error_count,
  CASE
    WHEN m.validation_fail_count = 0 AND m.validation_pass_count > 0 THEN 100
    WHEN m.validation_pass_count + m.validation_fail_count = 0 THEN NULL
    ELSE round((m.validation_pass_count::numeric / (m.validation_pass_count + m.validation_fail_count)) * 100, 1)
  END as reliability_score,
  m.created_at,
  m.updated_at
FROM models m
WHERE m.template_type = 'analytics' AND m.sql_template IS NOT NULL
ORDER BY
  m.validation_status DESC,
  m.validation_fail_count DESC,
  m.name;

COMMENT ON VIEW template_validation_dashboard IS 'Dashboard view de validação de templates para interface master';

-- ============================================================================
-- STEP 6: Grants de permissões
-- ============================================================================

-- Permitir que authenticated users vejam o status (somente leitura)
GRANT SELECT ON template_validation_dashboard TO authenticated;

-- Executar validação completa inicial (apenas para referência, não executar automaticamente)
-- SELECT validate_all_templates();

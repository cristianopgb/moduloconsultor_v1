/*
  # Expansão da Telemetria do Sistema de Hints

  1. Novas Colunas
    - `acao_density`: Número de ações geradas (alvo 4-8)
    - `how_depth_avg`: Profundidade média do HOW (alvo 7-10)
    - `kpis_count`: Total de KPIs mensuráveis
    - `reissue_count`: Quantas vezes precisou refazer

  2. View Analítica Expandida
    - Métricas de qualidade agregadas
    - Comparação entre grupos A/B
*/

-- Adicionar novas colunas de qualidade
ALTER TABLE proceda_hints_telemetry
ADD COLUMN IF NOT EXISTS acao_density integer,
ADD COLUMN IF NOT EXISTS how_depth_avg numeric,
ADD COLUMN IF NOT EXISTS kpis_count integer,
ADD COLUMN IF NOT EXISTS reissue_count integer DEFAULT 0;

-- Comentários
COMMENT ON COLUMN proceda_hints_telemetry.acao_density IS 'Número de ações geradas no plano (alvo: 4-8)';
COMMENT ON COLUMN proceda_hints_telemetry.how_depth_avg IS 'Profundidade média do HOW em etapas (alvo: 7-10)';
COMMENT ON COLUMN proceda_hints_telemetry.kpis_count IS 'Número total de KPIs mensuráveis identificados';
COMMENT ON COLUMN proceda_hints_telemetry.reissue_count IS 'Quantas vezes foi necessário refazer o plano (qualidade ruim)';

-- View analítica expandida
CREATE OR REPLACE VIEW proceda_hints_quality_metrics AS
SELECT
  grupo_ab,
  COUNT(*) as total_usos,

  -- Densidade de ações
  AVG(acao_density) as avg_acao_density,
  COUNT(*) FILTER (WHERE acao_density >= 4 AND acao_density <= 8) as densidade_ok,
  ROUND(
    COUNT(*) FILTER (WHERE acao_density >= 4 AND acao_density <= 8)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as densidade_ok_pct,

  -- Profundidade do HOW
  AVG(how_depth_avg) as avg_how_depth,
  COUNT(*) FILTER (WHERE how_depth_avg >= 7) as depth_ok,
  ROUND(
    COUNT(*) FILTER (WHERE how_depth_avg >= 7)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as depth_ok_pct,

  -- KPIs
  AVG(kpis_count) as avg_kpis,

  -- Reissues (quanto menor, melhor)
  AVG(reissue_count) as avg_reissues,
  COUNT(*) FILTER (WHERE reissue_count = 0) as zero_reissues,
  ROUND(
    COUNT(*) FILTER (WHERE reissue_count = 0)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as zero_reissues_pct,

  -- Aceitação
  COUNT(*) FILTER (WHERE usado_em_acao = true) as usado_em_acoes,
  COUNT(*) FILTER (WHERE acao_aceita = true) as acoes_aceitas,
  ROUND(
    COUNT(*) FILTER (WHERE acao_aceita = true)::numeric /
    NULLIF(COUNT(*) FILTER (WHERE usado_em_acao = true), 0) * 100,
    2
  ) as taxa_aceite

FROM proceda_hints_telemetry
WHERE acao_density IS NOT NULL
GROUP BY grupo_ab
ORDER BY grupo_ab;

COMMENT ON VIEW proceda_hints_quality_metrics IS 'Métricas de qualidade agregadas por grupo A/B';

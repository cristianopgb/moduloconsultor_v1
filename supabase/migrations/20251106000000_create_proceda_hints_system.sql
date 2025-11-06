/*
  # Sistema de Base Semântica de Situações (Proceda Hints)

  1. Novas Tabelas
    - `proceda_hints`: Base de conhecimento de situações → recomendações
      - Armazena situações comuns por segmento/domínio com recomendações cirúrgicas
      - Score e telemetria para evolução data-driven

    - `proceda_hints_telemetry`: Log de uso e efetividade dos hints
      - Rastreia quais hints foram usados, em quais ações, e se foram aceitas
      - Permite análise de efetividade e deprecação de hints ruins

  2. Segurança
    - RLS habilitado em ambas tabelas
    - Users: read-only nos hints ativos
    - Masters: full access para gerenciar hints
    - Telemetria: insert-only para service role

  3. Índices
    - Full-text search em português para scenario
    - GIN para arrays de segmentos e dominios
    - Índice composto para scoring (prioridade + uso)
*/

-- Extensão para full-text search em português
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Tabela principal de hints
CREATE TABLE IF NOT EXISTS proceda_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  title text NOT NULL,

  -- Segmentação (vocabulário controlado)
  segmentos text[] NOT NULL DEFAULT '{}',
  -- Opções: ecommerce, varejo_online, loja_online, saas, tecnologia, servicos, consultoria, industria, varejo_fisico

  dominios text[] NOT NULL DEFAULT '{}',
  -- Opções: marketing, vendas, operacoes, financeiro, rh, logistica, qualidade, ti

  -- Contexto semântico (rico em sinônimos para matching)
  scenario text NOT NULL,
  -- Ex: "e-commerce, loja online, site de vendas, vende pela internet, sem tráfego pago, sem Ads, só orgânico, sem investimento em marketing digital"

  -- Recomendações (bullets curtos - executor detalha o COMO)
  recommendations text NOT NULL,
  -- Ex: "Estruturar campanhas de mídia paga (Google Ads + Meta Ads) | Criar funil de conversão com landing pages otimizadas | Implementar remarketing para carrinho abandonado"

  -- Priorização e controle
  prioridade integer NOT NULL DEFAULT 5 CHECK (prioridade >= 1 AND prioridade <= 10),
  -- 1 = baixa, 10 = alta prioridade

  ativo boolean NOT NULL DEFAULT true,

  -- Telemetria (atualizado automaticamente)
  uso_count integer NOT NULL DEFAULT 0,
  aceite_count integer NOT NULL DEFAULT 0,
  aceite_rate numeric GENERATED ALWAYS AS (
    CASE
      WHEN uso_count > 0 THEN ROUND((aceite_count::numeric / uso_count::numeric) * 100, 2)
      ELSE 0
    END
  ) STORED,

  ultima_utilizacao timestamptz,

  -- Metadados
  versao integer NOT NULL DEFAULT 1,
  tags text[] DEFAULT '{}',
  notas text,

  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Tabela de telemetria de uso
CREATE TABLE IF NOT EXISTS proceda_hints_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  hint_id uuid NOT NULL REFERENCES proceda_hints(id) ON DELETE CASCADE,
  sessao_id uuid NOT NULL,

  fase text NOT NULL,
  -- Fase em que o hint foi usado (anamnese, mapeamento, etc)

  usado_em_acao boolean NOT NULL DEFAULT false,
  -- Se o hint apareceu no 5W2H/actions gerados

  acao_aceita boolean,
  -- Se o usuário aprovou a ação (null = ainda não decidiu)

  contexto_busca jsonb DEFAULT '{}',
  -- Segmento, dor, achados usados na busca

  score_busca numeric,
  -- Score que esse hint teve na busca (para debug)

  grupo_ab text,
  -- 'control' ou 'test_1_hint', 'test_2_hints' para A/B testing

  created_at timestamptz DEFAULT now()
);

-- Índices para performance

-- Full-text search em português no scenario
CREATE INDEX IF NOT EXISTS idx_proceda_hints_scenario_fts
  ON proceda_hints
  USING gin(to_tsvector('portuguese', unaccent(scenario)));

-- GIN para arrays
CREATE INDEX IF NOT EXISTS idx_proceda_hints_segmentos
  ON proceda_hints
  USING gin(segmentos);

CREATE INDEX IF NOT EXISTS idx_proceda_hints_dominios
  ON proceda_hints
  USING gin(dominios);

-- Índice composto para scoring (mais usados e prioritários primeiro)
CREATE INDEX IF NOT EXISTS idx_proceda_hints_scoring
  ON proceda_hints(prioridade DESC, uso_count DESC, aceite_rate DESC)
  WHERE ativo = true;

-- Índice para lookup rápido de ativos
CREATE INDEX IF NOT EXISTS idx_proceda_hints_ativo
  ON proceda_hints(ativo);

-- Índices para telemetria
CREATE INDEX IF NOT EXISTS idx_proceda_hints_telemetry_hint
  ON proceda_hints_telemetry(hint_id);

CREATE INDEX IF NOT EXISTS idx_proceda_hints_telemetry_sessao
  ON proceda_hints_telemetry(sessao_id);

CREATE INDEX IF NOT EXISTS idx_proceda_hints_telemetry_created
  ON proceda_hints_telemetry(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_proceda_hints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proceda_hints_updated_at
  BEFORE UPDATE ON proceda_hints
  FOR EACH ROW
  EXECUTE FUNCTION update_proceda_hints_updated_at();

-- Trigger para atualizar telemetria do hint quando usado
CREATE OR REPLACE FUNCTION update_hint_telemetry_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrementar uso_count
  UPDATE proceda_hints
  SET
    uso_count = uso_count + 1,
    ultima_utilizacao = now()
  WHERE id = NEW.hint_id;

  -- Se ação foi aceita, incrementar aceite_count
  IF NEW.acao_aceita = true THEN
    UPDATE proceda_hints
    SET aceite_count = aceite_count + 1
    WHERE id = NEW.hint_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hint_stats_on_telemetry
  AFTER INSERT ON proceda_hints_telemetry
  FOR EACH ROW
  EXECUTE FUNCTION update_hint_telemetry_stats();

-- RLS Policies

ALTER TABLE proceda_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE proceda_hints_telemetry ENABLE ROW LEVEL SECURITY;

-- Users podem ler hints ativos
CREATE POLICY "Users can view active hints"
  ON proceda_hints FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Masters podem gerenciar todos os hints
CREATE POLICY "Masters can manage all hints"
  ON proceda_hints FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Service role pode inserir telemetria (Edge Function)
CREATE POLICY "Service role can insert telemetry"
  ON proceda_hints_telemetry FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Users podem ver telemetria de suas sessões
CREATE POLICY "Users can view own session telemetry"
  ON proceda_hints_telemetry FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultor_sessoes
      WHERE consultor_sessoes.id = proceda_hints_telemetry.sessao_id
      AND consultor_sessoes.user_id = auth.uid()
    )
  );

-- Masters podem ver toda telemetria
CREATE POLICY "Masters can view all telemetry"
  ON proceda_hints_telemetry FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- View analítica para efetividade dos hints
CREATE OR REPLACE VIEW proceda_hints_analytics AS
SELECT
  h.id,
  h.title,
  h.segmentos,
  h.dominios,
  h.prioridade,
  h.uso_count,
  h.aceite_count,
  h.aceite_rate,
  h.ultima_utilizacao,
  h.ativo,
  COUNT(t.id) as total_usos_logged,
  COUNT(t.id) FILTER (WHERE t.usado_em_acao = true) as usado_em_acoes,
  COUNT(t.id) FILTER (WHERE t.acao_aceita = true) as acoes_aceitas,
  ROUND(
    COUNT(t.id) FILTER (WHERE t.acao_aceita = true)::numeric /
    NULLIF(COUNT(t.id) FILTER (WHERE t.usado_em_acao = true), 0) * 100,
    2
  ) as taxa_aceite_real
FROM proceda_hints h
LEFT JOIN proceda_hints_telemetry t ON t.hint_id = h.id
GROUP BY h.id
ORDER BY h.aceite_rate DESC, h.uso_count DESC;

-- Comentários para documentação
COMMENT ON TABLE proceda_hints IS 'Base de conhecimento de situações → recomendações para o consultor inteligente';
COMMENT ON COLUMN proceda_hints.scenario IS 'Contexto rico em sinônimos para matching semântico (use linguagem natural do usuário)';
COMMENT ON COLUMN proceda_hints.recommendations IS 'Bullets curtos separados por | (executor LLM detalha o COMO)';
COMMENT ON COLUMN proceda_hints.aceite_rate IS 'Taxa de aceitação calculada automaticamente (aceite_count / uso_count * 100)';

COMMENT ON TABLE proceda_hints_telemetry IS 'Log de uso e efetividade dos hints para otimização data-driven';
COMMENT ON COLUMN proceda_hints_telemetry.grupo_ab IS 'Grupo A/B para testes silenciosos (control, test_1_hint, test_2_hints)';

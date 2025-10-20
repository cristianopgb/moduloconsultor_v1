/*
  # Sistema de Checklist do Framework Proceda com Paralelismo

  1. Novas Tabelas
    - `framework_checklist`: Rastreia fases únicas do framework (anamnese, canvas, cadeia, etc)
      - Campos para cada etapa com timestamps
      - Controle de gamificação (XP concedido)
      - Suporte a escopo (quantos processos mapear)

    - `processo_checklist`: Rastreia cada processo individual no escopo
      - Atributos, BPMN AS-IS, Diagnóstico por processo
      - XP individual por processo
      - Status de conclusão por processo

  2. Funcionalidades
    - Trigger automático para criar checklist quando jornada é criada
    - Função para criar N processo_checklists quando escopo é definido
    - Trigger para detectar quando todos processos foram concluídos

  3. Segurança
    - RLS habilitado em ambas tabelas
    - Políticas permitem apenas usuário dono acessar seus checklists
*/

-- Tabela principal: fases únicas do framework
CREATE TABLE IF NOT EXISTS framework_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id UUID REFERENCES jornadas_consultor(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- FASE 1: ENTENDIMENTO DO NEGÓCIO
  apresentacao_feita BOOLEAN DEFAULT false,
  apresentacao_ts TIMESTAMPTZ,

  anamnese_solicitada BOOLEAN DEFAULT false,
  anamnese_formulario_exibido BOOLEAN DEFAULT false,
  anamnese_preenchida BOOLEAN DEFAULT false,
  anamnese_analisada BOOLEAN DEFAULT false,
  anamnese_ts TIMESTAMPTZ,
  xp_anamnese_concedido BOOLEAN DEFAULT false,

  canvas_solicitado BOOLEAN DEFAULT false,
  canvas_formulario_exibido BOOLEAN DEFAULT false,
  canvas_preenchido BOOLEAN DEFAULT false,
  canvas_entregavel_gerado BOOLEAN DEFAULT false,
  canvas_ts TIMESTAMPTZ,
  xp_canvas_concedido BOOLEAN DEFAULT false,

  -- FASE 2: CADEIA E PROCESSOS
  cadeia_valor_solicitada BOOLEAN DEFAULT false,
  cadeia_valor_formulario_exibida BOOLEAN DEFAULT false,
  cadeia_valor_preenchida BOOLEAN DEFAULT false,
  cadeia_valor_entregavel_gerada BOOLEAN DEFAULT false,
  cadeia_valor_ts TIMESTAMPTZ,
  xp_cadeia_valor_concedido BOOLEAN DEFAULT false,

  processos_identificados BOOLEAN DEFAULT false,
  processos_identificados_ts TIMESTAMPTZ,

  -- ESCOPO: Define QUANTOS processos serão mapeados
  escopo_priorizacao_definido BOOLEAN DEFAULT false,
  escopo_quantidade_processos INT DEFAULT 0,
  escopo_processos_nomes TEXT[],
  escopo_ts TIMESTAMPTZ,

  matriz_priorizacao_solicitada BOOLEAN DEFAULT false,
  matriz_priorizacao_formulario_exibido BOOLEAN DEFAULT false,
  matriz_priorizacao_preenchida BOOLEAN DEFAULT false,
  matriz_priorizacao_entregavel_gerada BOOLEAN DEFAULT false,
  matriz_priorizacao_ts TIMESTAMPTZ,
  xp_matriz_priorizacao_concedido BOOLEAN DEFAULT false,

  -- CONTROLE DE PARALELISMO
  processos_em_analise_count INT DEFAULT 0,
  todos_processos_concluidos BOOLEAN DEFAULT false,

  -- PLANO DE AÇÃO FINAL
  plano_acao_gerado BOOLEAN DEFAULT false,
  plano_acao_ts TIMESTAMPTZ,
  xp_plano_acao_concedido BOOLEAN DEFAULT false,

  framework_completo BOOLEAN DEFAULT false,
  xp_conclusao_concedido BOOLEAN DEFAULT false,

  duvidas_respondidas_count INT DEFAULT 0,
  ultima_interacao TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de processos: rastreamento individual
CREATE TABLE IF NOT EXISTS processo_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_checklist_id UUID REFERENCES framework_checklist(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- IDENTIFICAÇÃO
  processo_nome TEXT NOT NULL,
  processo_ordem INT NOT NULL,

  -- STATUS DO MAPEAMENTO
  atributos_solicitados BOOLEAN DEFAULT false,
  atributos_formulario_exibido BOOLEAN DEFAULT false,
  atributos_preenchidos BOOLEAN DEFAULT false,
  atributos_ts TIMESTAMPTZ,
  xp_atributos_concedido BOOLEAN DEFAULT false,

  bpmn_as_is_solicitado BOOLEAN DEFAULT false,
  bpmn_as_is_mapeado BOOLEAN DEFAULT false,
  bpmn_as_is_entregavel_id UUID,
  bpmn_as_is_ts TIMESTAMPTZ,
  xp_bpmn_concedido BOOLEAN DEFAULT false,

  diagnostico_solicitado BOOLEAN DEFAULT false,
  diagnostico_formulario_exibido BOOLEAN DEFAULT false,
  diagnostico_preenchido BOOLEAN DEFAULT false,
  diagnostico_entregavel_id UUID,
  diagnostico_ts TIMESTAMPTZ,
  xp_diagnostico_concedido BOOLEAN DEFAULT false,

  -- STATUS GERAL
  processo_completo BOOLEAN DEFAULT false,
  processo_completo_ts TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(framework_checklist_id, processo_nome)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_framework_checklist_jornada ON framework_checklist(jornada_id);
CREATE INDEX IF NOT EXISTS idx_framework_checklist_conversation ON framework_checklist(conversation_id);
CREATE INDEX IF NOT EXISTS idx_processo_checklist_framework ON processo_checklist(framework_checklist_id);
CREATE INDEX IF NOT EXISTS idx_processo_checklist_conversation ON processo_checklist(conversation_id);
CREATE INDEX IF NOT EXISTS idx_processo_checklist_ordem ON processo_checklist(processo_ordem);

-- Trigger: criar checklist automaticamente quando jornada é criada
CREATE OR REPLACE FUNCTION create_framework_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO framework_checklist (jornada_id, conversation_id)
  VALUES (NEW.id, NEW.conversation_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_framework_checklist ON jornadas_consultor;
CREATE TRIGGER trigger_create_framework_checklist
  AFTER INSERT ON jornadas_consultor
  FOR EACH ROW
  EXECUTE FUNCTION create_framework_checklist();

-- Função: criar processo_checklists quando escopo é definido
CREATE OR REPLACE FUNCTION create_processo_checklists(
  p_framework_checklist_id UUID,
  p_conversation_id UUID,
  p_processos_nomes TEXT[]
)
RETURNS void AS $$
DECLARE
  processo_nome TEXT;
  ordem INT := 1;
BEGIN
  FOREACH processo_nome IN ARRAY p_processos_nomes
  LOOP
    INSERT INTO processo_checklist (
      framework_checklist_id,
      conversation_id,
      processo_nome,
      processo_ordem
    ) VALUES (
      p_framework_checklist_id,
      p_conversation_id,
      processo_nome,
      ordem
    )
    ON CONFLICT (framework_checklist_id, processo_nome) DO NOTHING;

    ordem := ordem + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função: verificar se todos processos foram concluídos
CREATE OR REPLACE FUNCTION check_all_processos_completed()
RETURNS TRIGGER AS $$
DECLARE
  framework_id UUID;
  total_processos INT;
  processos_completos INT;
BEGIN
  framework_id := NEW.framework_checklist_id;

  -- Conta total e completos
  SELECT COUNT(*) INTO total_processos
  FROM processo_checklist
  WHERE framework_checklist_id = framework_id;

  SELECT COUNT(*) INTO processos_completos
  FROM processo_checklist
  WHERE framework_checklist_id = framework_id
    AND processo_completo = true;

  -- Se todos estão completos, atualiza framework principal
  IF total_processos > 0 AND total_processos = processos_completos THEN
    UPDATE framework_checklist
    SET
      todos_processos_concluidos = true,
      processos_em_analise_count = processos_completos,
      updated_at = now()
    WHERE id = framework_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_all_completed ON processo_checklist;
CREATE TRIGGER trigger_check_all_completed
  AFTER UPDATE OF processo_completo ON processo_checklist
  FOR EACH ROW
  WHEN (NEW.processo_completo = true)
  EXECUTE FUNCTION check_all_processos_completed();

-- RLS
ALTER TABLE framework_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE processo_checklist ENABLE ROW LEVEL SECURITY;

-- Políticas framework_checklist
CREATE POLICY "Users can view own framework checklist"
  ON framework_checklist FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own framework checklist"
  ON framework_checklist FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert framework checklist"
  ON framework_checklist FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Políticas processo_checklist
CREATE POLICY "Users can view own processo checklist"
  ON processo_checklist FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own processo checklist"
  ON processo_checklist FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert processo checklist"
  ON processo_checklist FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own processo checklist"
  ON processo_checklist FOR DELETE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

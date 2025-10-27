/*
  # Schema para Adapters de Setor

  1. Nova Tabela: sector_adapters
    - Armazena KPIs e perguntas específicas por setor
    - Permite personalização da consultoria por segmento

  2. Segurança
    - RLS habilitado
    - Masters podem gerenciar adapters
    - Usuários podem visualizar adapters do seu setor
*/

-- Tabela de adapters por setor
CREATE TABLE IF NOT EXISTS sector_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_nome text NOT NULL,
  setor_descricao text,

  -- KPIs específicos do setor
  kpis jsonb DEFAULT '[]'::jsonb,

  -- Perguntas específicas para anamnese
  perguntas_anamnese jsonb DEFAULT '[]'::jsonb,

  -- Metodologias recomendadas
  metodologias_recomendadas text[] DEFAULT '{}',

  -- Problemas comuns do setor
  problemas_comuns text[] DEFAULT '{}',

  -- Entregáveis típicos
  entregaveis_tipicos text[] DEFAULT '{}',

  -- Metadados
  tags text[] DEFAULT '{}',
  prioridade int DEFAULT 0,
  ativo boolean DEFAULT true,

  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sector_adapters_setor ON sector_adapters(setor_nome);
CREATE INDEX IF NOT EXISTS idx_sector_adapters_ativo ON sector_adapters(ativo);
CREATE INDEX IF NOT EXISTS idx_sector_adapters_tags ON sector_adapters USING gin(tags);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_sector_adapters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sector_adapters_updated_at
  BEFORE UPDATE ON sector_adapters
  FOR EACH ROW
  EXECUTE FUNCTION update_sector_adapters_updated_at();

-- RLS Policies
ALTER TABLE sector_adapters ENABLE ROW LEVEL SECURITY;

-- Masters podem fazer tudo
CREATE POLICY "Masters can manage sector adapters"
  ON sector_adapters
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Usuários podem visualizar adapters ativos
CREATE POLICY "Users can view active sector adapters"
  ON sector_adapters
  FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Adicionar coluna adapter_id nas sessões de consultor
ALTER TABLE consultor_sessoes
ADD COLUMN IF NOT EXISTS adapter_id uuid REFERENCES sector_adapters(id);

CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_adapter ON consultor_sessoes(adapter_id);

-- Seed inicial de adapters comuns
INSERT INTO sector_adapters (setor_nome, setor_descricao, kpis, perguntas_anamnese, metodologias_recomendadas, problemas_comuns, entregaveis_tipicos, tags, prioridade)
VALUES
(
  'Tecnologia',
  'Empresas de software, SaaS, TI, desenvolvimento',
  '[
    {"nome": "Churn Rate", "descricao": "Taxa de cancelamento de clientes", "formula": "(Clientes Perdidos / Total Clientes) * 100", "meta_ideal": "< 5%"},
    {"nome": "MRR", "descricao": "Receita Recorrente Mensal", "formula": "Soma de todas receitas recorrentes mensais", "meta_ideal": "Crescimento > 10% ao mês"},
    {"nome": "Customer Acquisition Cost (CAC)", "descricao": "Custo para adquirir um cliente", "formula": "Investimento em Marketing / Novos Clientes", "meta_ideal": "< 30% do LTV"},
    {"nome": "Net Promoter Score (NPS)", "descricao": "Satisfação do cliente", "formula": "% Promotores - % Detratores", "meta_ideal": "> 50"}
  ]'::jsonb,
  '[
    {"campo": "stack_tecnologico", "pergunta": "Quais tecnologias/linguagens sua empresa utiliza?", "tipo": "text"},
    {"campo": "modelo_negocio", "pergunta": "Qual o modelo de negócio? (SaaS, Licença, Consultoria, etc)", "tipo": "select", "opcoes": ["SaaS", "Licença Perpétua", "Consultoria", "Produto", "Híbrido"]},
    {"campo": "tempo_desenvolvimento", "pergunta": "Qual o tempo médio de desenvolvimento de features?", "tipo": "text"},
    {"campo": "metodologia_dev", "pergunta": "Qual metodologia de desenvolvimento usa? (Scrum, Kanban, etc)", "tipo": "select", "opcoes": ["Scrum", "Kanban", "XP", "Waterfall", "Híbrido", "Nenhuma"]},
    {"campo": "num_desenvolvedores", "pergunta": "Quantos desenvolvedores tem no time?", "tipo": "number"}
  ]'::jsonb,
  ARRAY['Business Model Canvas', 'Cadeia de Valor', 'SIPOC', '5W2H'],
  ARRAY[
    'Alta rotatividade de desenvolvedores',
    'Débito técnico acumulado',
    'Falta de documentação',
    'Escalabilidade da aplicação',
    'Segurança e compliance',
    'Integração entre sistemas',
    'Gestão de releases e deploys'
  ],
  ARRAY['Roadmap de Produto', 'Arquitetura de Software', 'Plano de DevOps', 'Estratégia de Escalabilidade'],
  ARRAY['tecnologia', 'software', 'saas', 'ti', 'desenvolvimento'],
  10
),
(
  'Varejo',
  'Lojas físicas, e-commerce, vendas no varejo',
  '[
    {"nome": "Ticket Médio", "descricao": "Valor médio por venda", "formula": "Faturamento Total / Número de Vendas", "meta_ideal": "Crescimento constante"},
    {"nome": "Taxa de Conversão", "descricao": "% de visitantes que compram", "formula": "(Vendas / Visitantes) * 100", "meta_ideal": "> 3%"},
    {"nome": "Giro de Estoque", "descricao": "Quantas vezes o estoque gira", "formula": "Custo Mercadoria Vendida / Estoque Médio", "meta_ideal": "6-12x por ano"},
    {"nome": "Ruptura de Estoque", "descricao": "% produtos em falta", "formula": "(Produtos em Falta / Total Produtos) * 100", "meta_ideal": "< 5%"}
  ]'::jsonb,
  '[
    {"campo": "canais_venda", "pergunta": "Quais canais de venda utiliza?", "tipo": "multiselect", "opcoes": ["Loja Física", "E-commerce", "Marketplace", "WhatsApp", "Redes Sociais"]},
    {"campo": "num_skus", "pergunta": "Quantos produtos (SKUs) você trabalha?", "tipo": "number"},
    {"campo": "gestao_estoque", "pergunta": "Como gerencia o estoque?", "tipo": "select", "opcoes": ["Sistema ERP", "Planilhas", "Sistema próprio", "Sem controle formal"]},
    {"campo": "logistica", "pergunta": "Como funciona a logística/entrega?", "tipo": "text"},
    {"campo": "ticket_medio_atual", "pergunta": "Qual o ticket médio atual?", "tipo": "number"}
  ]'::jsonb,
  ARRAY['SIPOC', 'Cadeia de Valor', '5W2H', 'Matriz de Priorização'],
  ARRAY[
    'Alto índice de ruptura de estoque',
    'Baixa margem de lucro',
    'Concorrência acirrada',
    'Gestão de fornecedores',
    'Logística e entrega',
    'Experiência do cliente',
    'Controle de perdas e quebras'
  ],
  ARRAY['Plano de Gestão de Estoque', 'Estratégia de Precificação', 'Mapeamento da Jornada do Cliente'],
  ARRAY['varejo', 'loja', 'comercio', 'vendas'],
  9
),
(
  'Serviços',
  'Consultorias, agências, prestadores de serviço',
  '[
    {"nome": "Taxa de Utilização", "descricao": "% do tempo produtivo", "formula": "(Horas Faturáveis / Horas Disponíveis) * 100", "meta_ideal": "> 75%"},
    {"nome": "Margem de Contribuição", "descricao": "Margem por projeto/serviço", "formula": "((Receita - Custos Variáveis) / Receita) * 100", "meta_ideal": "> 40%"},
    {"nome": "Customer Lifetime Value (LTV)", "descricao": "Valor do cliente ao longo do tempo", "formula": "Ticket Médio * Frequência * Tempo de Relacionamento", "meta_ideal": "> 3x CAC"},
    {"nome": "Taxa de Retenção", "descricao": "% clientes que renovam", "formula": "(Clientes Renovados / Total Clientes) * 100", "meta_ideal": "> 80%"}
  ]'::jsonb,
  '[
    {"campo": "tipo_servico", "pergunta": "Qual tipo de serviço oferece?", "tipo": "text"},
    {"campo": "modelo_cobranca", "pergunta": "Como cobra pelos serviços?", "tipo": "select", "opcoes": ["Por Hora", "Por Projeto", "Mensalidade/Retainer", "Performance/Resultado", "Híbrido"]},
    {"campo": "tamanho_time", "pergunta": "Quantas pessoas compõem o time de entrega?", "tipo": "number"},
    {"campo": "capacidade_atual", "pergunta": "Qual a capacidade de atendimento atual? (clientes/projetos simultâneos)", "tipo": "number"},
    {"campo": "processo_entrega", "pergunta": "Como é o processo de entrega do serviço?", "tipo": "text"}
  ]'::jsonb,
  ARRAY['SIPOC', 'Business Model Canvas', '5W2H', 'Matriz de Priorização'],
  ARRAY[
    'Precificação inadequada',
    'Baixa taxa de utilização da equipe',
    'Dificuldade em escalar',
    'Dependência de pessoas-chave',
    'Padronização de processos',
    'Gestão de expectativas do cliente',
    'Fluxo de caixa irregular'
  ],
  ARRAY['Manual de Processos', 'Tabela de Precificação', 'Playbook de Entrega', 'SLA'],
  ARRAY['servicos', 'consultoria', 'agencia', 'prestador'],
  8
)
ON CONFLICT DO NOTHING;

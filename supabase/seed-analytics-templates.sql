/*
  ============================================================================
  CARGA EM LOTE DE TEMPLATES ANALYTICS
  ============================================================================

  Este arquivo permite inserir múltiplos templates analytics de uma vez,
  com verificação automática de duplicatas.

  ## Como Usar

  1. Para inserir templates via psql ou Supabase SQL Editor:
     - Copie o conteúdo deste arquivo
     - Cole no editor SQL do Supabase Dashboard
     - Execute

  2. Para adicionar novos templates:
     - Copie a estrutura de um dos blocos INSERT abaixo
     - Modifique os valores:
       * name: Nome descritivo do template
       * category: Categoria (Analytics, Vendas, Financeiro, etc)
       * description: Descrição clara do que o template faz
       * sql_template: SQL com placeholders {{nome_placeholder}}
       * required_columns: JSON definindo cada placeholder
       * semantic_tags: Array JSON com palavras-chave
     - Adicione ao final do arquivo
     - Execute

  3. Sistema de Verificação de Duplicatas:
     - Verifica se já existe template com mesmo nome
     - Se existir, pula a inserção (não gera erro)
     - Logs indicam quais templates foram inseridos

  ## Estrutura do SQL Template

  Placeholders devem usar formato: {{nome_placeholder}}

  Exemplo:
  SELECT {{group_col}}, SUM({{value_col}})
  FROM temp_data
  GROUP BY {{group_col}}

  ## Estrutura de required_columns

  {
    "placeholder_name": {
      "type": "numeric|text|date|boolean",
      "description": "Descrição do que deve ir neste campo",
      "default": "valor_opcional_padrao"
    }
  }

  ## Semantic Tags

  Tags são usadas para detecção automática. Use palavras-chave que
  usuários provavelmente mencionarão ao fazer perguntas.

  Exemplo: ["vendas", "receita", "faturamento", "ticket", "média"]

  ============================================================================
*/

-- ============================================================================
-- FUNÇÃO HELPER: Inserir template se não existir
-- ============================================================================

CREATE OR REPLACE FUNCTION insert_template_if_not_exists(
  p_name text,
  p_category text,
  p_description text,
  p_sql_template text,
  p_required_columns jsonb,
  p_semantic_tags jsonb
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM models
    WHERE name = p_name
    AND template_type = 'analytics'
  ) THEN
    INSERT INTO models (
      name,
      category,
      description,
      template_type,
      file_type,
      sql_template,
      required_columns,
      semantic_tags,
      created_at,
      updated_at
    ) VALUES (
      p_name,
      p_category,
      p_description,
      'analytics',
      NULL,
      p_sql_template,
      p_required_columns,
      p_semantic_tags,
      now(),
      now()
    );
    RAISE NOTICE 'Template inserido: %', p_name;
  ELSE
    RAISE NOTICE 'Template já existe (pulado): %', p_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEMPLATES BÁSICOS (já inseridos pela migration, mas aqui como referência)
-- ============================================================================

SELECT insert_template_if_not_exists(
  'Ticket Médio por Grupo',
  'Analytics',
  'Calcula o ticket médio agrupado por uma categoria (região, produto, etc)',
  'SELECT {{group_col}} as grupo, AVG({{value_col}}) as ticket_medio, COUNT(*) as quantidade FROM temp_data GROUP BY {{group_col}} ORDER BY ticket_medio DESC',
  '{"group_col": {"type": "text", "description": "Coluna de agrupamento (ex: região, categoria)"}, "value_col": {"type": "numeric", "description": "Coluna com valores para calcular média"}}'::jsonb,
  '["ticket", "média", "medio", "average", "vendas", "valor"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Top N Itens',
  'Analytics',
  'Retorna os N itens com maiores valores',
  'SELECT {{group_col}} as item, SUM({{value_col}}) as total FROM temp_data GROUP BY {{group_col}} ORDER BY total DESC LIMIT {{limit}}',
  '{"group_col": {"type": "text", "description": "Coluna com itens"}, "value_col": {"type": "numeric", "description": "Coluna com valores"}, "limit": {"type": "integer", "description": "Número de itens", "default": 10}}'::jsonb,
  '["top", "maior", "melhor", "ranking", "principal"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Soma por Grupo',
  'Analytics',
  'Soma valores agrupados por categoria',
  'SELECT {{group_col}} as categoria, SUM({{value_col}}) as total, COUNT(*) as quantidade FROM temp_data GROUP BY {{group_col}} ORDER BY total DESC',
  '{"group_col": {"type": "text", "description": "Coluna de agrupamento"}, "value_col": {"type": "numeric", "description": "Coluna com valores para somar"}}'::jsonb,
  '["soma", "total", "somar", "sum", "agregado"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Contagem por Categoria',
  'Analytics',
  'Conta ocorrências por categoria',
  'SELECT {{group_col}} as categoria, COUNT(*) as quantidade, COUNT(DISTINCT {{group_col}}) as distintos FROM temp_data GROUP BY {{group_col}} ORDER BY quantidade DESC',
  '{"group_col": {"type": "text", "description": "Coluna para contar"}}'::jsonb,
  '["contagem", "count", "quantidade", "frequencia", "distribuição"]'::jsonb
);

-- ============================================================================
-- TEMPLATES AVANÇADOS DE VENDAS
-- ============================================================================

SELECT insert_template_if_not_exists(
  'Giro de Estoque',
  'Vendas',
  'Calcula o giro de estoque (quantidade vendida / estoque médio) por produto',
  'WITH vendas AS (
    SELECT {{product_col}} as produto, SUM({{qty_sold_col}}) as qtd_vendida
    FROM temp_data
    WHERE {{date_col}} >= CURRENT_DATE - INTERVAL ''90 days''
    GROUP BY {{product_col}}
  ),
  estoque AS (
    SELECT {{product_col}} as produto, AVG({{stock_col}}) as estoque_medio
    FROM temp_data
    GROUP BY {{product_col}}
  )
  SELECT
    v.produto,
    v.qtd_vendida,
    e.estoque_medio,
    CASE
      WHEN e.estoque_medio > 0 THEN ROUND((v.qtd_vendida / e.estoque_medio)::numeric, 2)
      ELSE 0
    END as giro_estoque
  FROM vendas v
  INNER JOIN estoque e ON v.produto = e.produto
  ORDER BY giro_estoque DESC',
  '{"product_col": {"type": "text", "description": "Coluna com nome do produto"}, "qty_sold_col": {"type": "numeric", "description": "Coluna com quantidade vendida"}, "stock_col": {"type": "numeric", "description": "Coluna com estoque"}, "date_col": {"type": "date", "description": "Coluna com data da venda"}}'::jsonb,
  '["giro", "estoque", "rotatividade", "turnover", "produto"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Curva ABC de Produtos',
  'Vendas',
  'Classifica produtos em categorias A (80% faturamento), B (15%), C (5%)',
  'WITH vendas_produto AS (
    SELECT
      {{product_col}} as produto,
      SUM({{value_col}}) as faturamento
    FROM temp_data
    GROUP BY {{product_col}}
  ),
  ranked AS (
    SELECT
      produto,
      faturamento,
      SUM(faturamento) OVER () as faturamento_total,
      SUM(faturamento) OVER (ORDER BY faturamento DESC) as faturamento_acumulado
    FROM vendas_produto
  )
  SELECT
    produto,
    faturamento,
    ROUND((faturamento / faturamento_total * 100)::numeric, 2) as percentual,
    ROUND((faturamento_acumulado / faturamento_total * 100)::numeric, 2) as percentual_acumulado,
    CASE
      WHEN faturamento_acumulado / faturamento_total <= 0.80 THEN ''A''
      WHEN faturamento_acumulado / faturamento_total <= 0.95 THEN ''B''
      ELSE ''C''
    END as classe_abc
  FROM ranked
  ORDER BY faturamento DESC',
  '{"product_col": {"type": "text", "description": "Coluna com nome do produto"}, "value_col": {"type": "numeric", "description": "Coluna com valor de venda"}}'::jsonb,
  '["curva abc", "pareto", "classificação", "80/20", "produtos"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Análise de Sazonalidade',
  'Vendas',
  'Identifica padrões sazonais de vendas por mês',
  'SELECT
    DATE_TRUNC(''month'', {{date_col}}) as mes,
    SUM({{value_col}}) as faturamento,
    COUNT(*) as num_vendas,
    AVG({{value_col}}) as ticket_medio,
    EXTRACT(MONTH FROM {{date_col}}) as numero_mes,
    TO_CHAR({{date_col}}, ''Month'') as nome_mes
  FROM temp_data
  GROUP BY DATE_TRUNC(''month'', {{date_col}}), EXTRACT(MONTH FROM {{date_col}}), TO_CHAR({{date_col}}, ''Month'')
  ORDER BY mes',
  '{"date_col": {"type": "date", "description": "Coluna com data da venda"}, "value_col": {"type": "numeric", "description": "Coluna com valor da venda"}}'::jsonb,
  '["sazonalidade", "mês", "mensal", "tendência", "temporal"]'::jsonb
);

-- ============================================================================
-- TEMPLATES FINANCEIROS
-- ============================================================================

SELECT insert_template_if_not_exists(
  'Contas a Receber por Vencimento',
  'Financeiro',
  'Agrupa contas a receber por faixa de vencimento',
  'SELECT
    CASE
      WHEN {{due_date_col}} < CURRENT_DATE THEN ''Vencidas''
      WHEN {{due_date_col}} <= CURRENT_DATE + INTERVAL ''7 days'' THEN ''Próximos 7 dias''
      WHEN {{due_date_col}} <= CURRENT_DATE + INTERVAL ''30 days'' THEN ''Próximos 30 dias''
      ELSE ''Mais de 30 dias''
    END as faixa_vencimento,
    COUNT(*) as quantidade,
    SUM({{value_col}}) as valor_total,
    AVG({{value_col}}) as valor_medio
  FROM temp_data
  WHERE {{status_col}} != ''Pago''
  GROUP BY faixa_vencimento
  ORDER BY
    CASE faixa_vencimento
      WHEN ''Vencidas'' THEN 1
      WHEN ''Próximos 7 dias'' THEN 2
      WHEN ''Próximos 30 dias'' THEN 3
      ELSE 4
    END',
  '{"due_date_col": {"type": "date", "description": "Coluna com data de vencimento"}, "value_col": {"type": "numeric", "description": "Coluna com valor da conta"}, "status_col": {"type": "text", "description": "Coluna com status (Pago/Pendente/etc)"}}'::jsonb,
  '["receber", "vencimento", "contas", "inadimplência", "pagamento"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Fluxo de Caixa Projetado',
  'Financeiro',
  'Projeta entradas e saídas futuras por período',
  'WITH entradas AS (
    SELECT DATE_TRUNC(''month'', {{date_col}}) as periodo, SUM({{value_col}}) as total
    FROM temp_data
    WHERE {{type_col}} = ''Entrada''
    GROUP BY DATE_TRUNC(''month'', {{date_col}})
  ),
  saidas AS (
    SELECT DATE_TRUNC(''month'', {{date_col}}) as periodo, SUM({{value_col}}) as total
    FROM temp_data
    WHERE {{type_col}} = ''Saída''
    GROUP BY DATE_TRUNC(''month'', {{date_col}})
  )
  SELECT
    COALESCE(e.periodo, s.periodo) as periodo,
    COALESCE(e.total, 0) as entradas,
    COALESCE(s.total, 0) as saidas,
    COALESCE(e.total, 0) - COALESCE(s.total, 0) as saldo
  FROM entradas e
  FULL OUTER JOIN saidas s ON e.periodo = s.periodo
  ORDER BY periodo',
  '{"date_col": {"type": "date", "description": "Coluna com data da transação"}, "value_col": {"type": "numeric", "description": "Coluna com valor"}, "type_col": {"type": "text", "description": "Coluna com tipo (Entrada/Saída)"}}'::jsonb,
  '["fluxo", "caixa", "projeção", "entradas", "saídas"]'::jsonb
);

-- ============================================================================
-- TEMPLATES DE RH
-- ============================================================================

SELECT insert_template_if_not_exists(
  'Análise de Turnover',
  'RH',
  'Calcula taxa de rotatividade de funcionários por departamento',
  'WITH base AS (
    SELECT
      {{department_col}} as departamento,
      COUNT(*) as total_funcionarios,
      SUM(CASE WHEN {{exit_date_col}} IS NOT NULL THEN 1 ELSE 0 END) as saidas
    FROM temp_data
    GROUP BY {{department_col}}
  )
  SELECT
    departamento,
    total_funcionarios,
    saidas,
    ROUND((saidas::numeric / NULLIF(total_funcionarios, 0) * 100)::numeric, 2) as taxa_turnover
  FROM base
  ORDER BY taxa_turnover DESC',
  '{"department_col": {"type": "text", "description": "Coluna com departamento"}, "exit_date_col": {"type": "date", "description": "Coluna com data de saída (NULL se ativo)"}}'::jsonb,
  '["turnover", "rotatividade", "desligamento", "retenção", "rh"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Distribuição Salarial por Cargo',
  'RH',
  'Analisa faixas salariais, médias e medianas por cargo',
  'SELECT
    {{position_col}} as cargo,
    COUNT(*) as funcionarios,
    MIN({{salary_col}}) as salario_minimo,
    MAX({{salary_col}}) as salario_maximo,
    AVG({{salary_col}}) as salario_medio,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {{salary_col}}) as mediana
  FROM temp_data
  GROUP BY {{position_col}}
  ORDER BY salario_medio DESC',
  '{"position_col": {"type": "text", "description": "Coluna com cargo/função"}, "salary_col": {"type": "numeric", "description": "Coluna com salário"}}'::jsonb,
  '["salário", "remuneração", "cargo", "faixa salarial", "rh"]'::jsonb
);

-- ============================================================================
-- TEMPLATES DE MARKETING
-- ============================================================================

SELECT insert_template_if_not_exists(
  'ROI de Campanhas',
  'Marketing',
  'Calcula retorno sobre investimento de campanhas de marketing',
  'SELECT
    {{campaign_col}} as campanha,
    SUM({{cost_col}}) as investimento,
    SUM({{revenue_col}}) as receita_gerada,
    SUM({{revenue_col}}) - SUM({{cost_col}}) as lucro,
    ROUND(((SUM({{revenue_col}}) - SUM({{cost_col}})) / NULLIF(SUM({{cost_col}}), 0) * 100)::numeric, 2) as roi_percentual
  FROM temp_data
  GROUP BY {{campaign_col}}
  ORDER BY roi_percentual DESC',
  '{"campaign_col": {"type": "text", "description": "Coluna com nome da campanha"}, "cost_col": {"type": "numeric", "description": "Coluna com custo investido"}, "revenue_col": {"type": "numeric", "description": "Coluna com receita gerada"}}'::jsonb,
  '["roi", "retorno", "campanha", "marketing", "investimento"]'::jsonb
);

SELECT insert_template_if_not_exists(
  'Funil de Conversão',
  'Marketing',
  'Analisa taxa de conversão em cada etapa do funil',
  'WITH etapas AS (
    SELECT
      {{stage_col}} as etapa,
      COUNT(*) as quantidade,
      ROW_NUMBER() OVER (ORDER BY MIN({{order_col}})) as ordem
    FROM temp_data
    GROUP BY {{stage_col}}
  ),
  conversao AS (
    SELECT
      etapa,
      quantidade,
      ordem,
      LAG(quantidade) OVER (ORDER BY ordem) as quantidade_anterior
    FROM etapas
  )
  SELECT
    etapa,
    quantidade,
    CASE
      WHEN quantidade_anterior IS NOT NULL
      THEN ROUND((quantidade::numeric / quantidade_anterior * 100)::numeric, 2)
      ELSE 100.00
    END as taxa_conversao
  FROM conversao
  ORDER BY ordem',
  '{"stage_col": {"type": "text", "description": "Coluna com etapa do funil"}, "order_col": {"type": "numeric", "description": "Coluna com ordem da etapa (1, 2, 3...)"}}'::jsonb,
  '["funil", "conversão", "etapa", "pipeline", "marketing"]'::jsonb
);

-- ============================================================================
-- TEMPLATES DE LOGÍSTICA
-- ============================================================================

SELECT insert_template_if_not_exists(
  'Tempo Médio de Entrega por Região',
  'Logística',
  'Calcula tempo médio de entrega e identifica gargalos por região',
  'SELECT
    {{region_col}} as regiao,
    COUNT(*) as total_entregas,
    AVG({{delivery_date_col}} - {{order_date_col}}) as dias_medio_entrega,
    MIN({{delivery_date_col}} - {{order_date_col}}) as melhor_tempo,
    MAX({{delivery_date_col}} - {{order_date_col}}) as pior_tempo,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {{delivery_date_col}} - {{order_date_col}}) as mediana_dias
  FROM temp_data
  WHERE {{delivery_date_col}} IS NOT NULL
  GROUP BY {{region_col}}
  ORDER BY dias_medio_entrega DESC',
  '{"region_col": {"type": "text", "description": "Coluna com região"}, "order_date_col": {"type": "date", "description": "Coluna com data do pedido"}, "delivery_date_col": {"type": "date", "description": "Coluna com data da entrega"}}'::jsonb,
  '["entrega", "logística", "prazo", "tempo", "região"]'::jsonb
);

-- ============================================================================
-- RESULTADO FINAL
-- ============================================================================

DO $$
DECLARE
  v_total_templates integer;
BEGIN
  SELECT COUNT(*) INTO v_total_templates
  FROM models
  WHERE template_type = 'analytics';

  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Carga de templates analytics concluída!';
  RAISE NOTICE '📊 Total de templates analytics no sistema: %', v_total_templates;
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Para adicionar novos templates:';
  RAISE NOTICE '   1. Copie a estrutura de um bloco SELECT insert_template_if_not_exists(...)';
  RAISE NOTICE '   2. Modifique os valores conforme sua necessidade';
  RAISE NOTICE '   3. Execute o SQL no Supabase SQL Editor';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Para verificar duplicatas antes de inserir:';
  RAISE NOTICE '   SELECT * FROM models WHERE name = ''Nome do Seu Template''';
  RAISE NOTICE '';
END $$;
-- =========================================================
-- PACOTÃO DE TEMPLATES ANALYTICS — PROCEDa IA
-- Data: 2025-10-08
-- Observação: sempre use temp_data no motor de execução
-- =========================================================

/* =========================
   1) COMERCIAL & VENDAS
   ========================= */

-- 1.1 Ticket Médio por Período
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Ticket Médio por Período','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{value_col}}) AS receita,
        COUNT(*) AS pedidos,
        CASE WHEN COUNT(*)>0 THEN SUM({{value_col}})/COUNT(*) ELSE 0 END AS ticket_medio
 FROM temp_data
 GROUP BY 1
 ORDER BY 1',
'{"date_col":{"type":"date","description":"Data de referência"},
  "value_col":{"type":"numeric","description":"Valor do pedido"},
  "periodo":{"type":"text","description":"day|week|month|year","default":"month"}}'::jsonb,
'["vendas","ticket","aov","avg order value","tendência"]'::jsonb,
'Calcula ticket médio por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Ticket Médio por Período' AND template_type='analytics');

-- 1.2 Top N Itens por Valor
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Top N Itens por Valor','Analytics','analytics',NULL,
'SELECT {{item_col}} AS item, SUM({{value_col}}) AS total_valor, COUNT(*) AS qtd
 FROM temp_data
 GROUP BY {{item_col}}
 ORDER BY total_valor DESC
 LIMIT {{limit}}',
'{"item_col":{"type":"text","description":"Produto/serviço"},
  "value_col":{"type":"numeric","description":"Valor"},
  "limit":{"type":"numeric","description":"Linhas","default":10}}'::jsonb,
'["ranking","top","itens","produtos","bestsellers"]'::jsonb,
'Ranking de itens por valor agregado.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Top N Itens por Valor' AND template_type='analytics');

-- 1.3 Curva ABC (Valor)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Curva ABC (Valor)','Analytics','analytics',NULL,
'WITH base AS (
   SELECT {{item_col}} AS item, SUM({{value_col}}) AS valor
   FROM temp_data GROUP BY {{item_col}}
 ), ord AS (
   SELECT item, valor,
          SUM(valor) OVER () AS total,
          SUM(valor) OVER (ORDER BY valor DESC) AS acum
   FROM base
 )
 SELECT item, valor, acum/total AS perc_acum,
        CASE WHEN acum/total<=0.8 THEN ''A''
             WHEN acum/total<=0.95 THEN ''B''
             ELSE ''C'' END AS classe
 FROM ord
 ORDER BY valor DESC',
'{"item_col":{"type":"text","description":"SKU/serviço"},
  "value_col":{"type":"numeric","description":"Valor monetário"}}'::jsonb,
'["abc","pareto","curva","mix"]'::jsonb,
'Classifica itens em A/B/C por valor.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Curva ABC (Valor)' AND template_type='analytics');

-- 1.4 Margem por Produto
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Margem por Produto','Analytics','analytics',NULL,
'SELECT {{item_col}} AS item,
        SUM({{revenue_col}}) AS receita,
        SUM({{cost_col}}) AS custo,
        SUM({{revenue_col}})-SUM({{cost_col}}) AS margem_abs,
        CASE WHEN SUM({{revenue_col}})>0 THEN (SUM({{revenue_col}})-SUM({{cost_col}}))/SUM({{revenue_col}}) END AS margem_pct
 FROM temp_data
 GROUP BY {{item_col}}
 ORDER BY margem_abs DESC',
'{"item_col":{"type":"text","description":"Produto/serviço"},
  "revenue_col":{"type":"numeric","description":"Receita"},
  "cost_col":{"type":"numeric","description":"Custo"}}'::jsonb,
'["margem","profit","cmv","cpv"]'::jsonb,
'Apura margem por item.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Margem por Produto' AND template_type='analytics');

-- 1.5 Desconto Médio por Vendedor
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Desconto Médio por Vendedor','Analytics','analytics',NULL,
'SELECT {{seller_col}} AS vendedor,
        AVG({{discount_col}}) AS desconto_medio,
        SUM({{value_col}}) AS receita
 FROM temp_data
 GROUP BY {{seller_col}}
 ORDER BY desconto_medio DESC NULLS LAST',
'{"seller_col":{"type":"text","description":"Vendedor"},
  "discount_col":{"type":"numeric","description":"% desconto ou valor"},
  "value_col":{"type":"numeric","description":"Valor de venda"}}'::jsonb,
'["desconto","vendas","pricing"]'::jsonb,
'Mede desconto médio por vendedor.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Desconto Médio por Vendedor' AND template_type='analytics');

-- 1.6 Sazonalidade (Média por Mês)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Sazonalidade (Média por Mês)','Analytics','analytics',NULL,
'SELECT EXTRACT(MONTH FROM {{date_col}})::int AS mes,
        AVG({{value_col}}) AS media
 FROM temp_data
 GROUP BY 1
 ORDER BY 1',
'{"date_col":{"type":"date","description":"Data"},
  "value_col":{"type":"numeric","description":"Valor"}}'::jsonb,
'["sazonalidade","seasonality","mês","tendência"]'::jsonb,
'Média mensal para avaliar sazonalidade.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Sazonalidade (Média por Mês)' AND template_type='analytics');

-- 1.7 Forecast Simples (Média Móvel)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Forecast Simples (Média Móvel)','Analytics','analytics',NULL,
'WITH serie AS (
  SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS per,
         SUM({{value_col}}) AS valor
  FROM temp_data
  GROUP BY 1
),
mm AS (
  SELECT per, valor,
         AVG(valor) OVER (ORDER BY per ROWS BETWEEN {{janela}} PRECEDING AND CURRENT ROW) AS media_movel
  FROM serie
)
SELECT * FROM mm ORDER BY per',
'{"date_col":{"type":"date","description":"Data"},
  "value_col":{"type":"numeric","description":"Valor"},
  "periodo":{"type":"text","description":"day|week|month|year","default":"month"},
  "janela":{"type":"numeric","description":"Janela de médias móveis","default":2}}'::jsonb,
'["forecast","média móvel","tendência"]'::jsonb,
'Projeção simples via média móvel.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Forecast Simples (Média Móvel)' AND template_type='analytics');

-- 1.8 Win-Rate por Vendedor
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Win-Rate por Vendedor','Analytics','analytics',NULL,
'SELECT {{seller_col}} AS vendedor,
        SUM(CASE WHEN {{stage_col}}=''ganho'' THEN 1 ELSE 0 END) AS ganhos,
        COUNT(*) AS oportunidades,
        CASE WHEN COUNT(*)>0 THEN SUM(CASE WHEN {{stage_col}}=''ganho'' THEN 1 ELSE 0 END)::numeric/COUNT(*) END AS win_rate
 FROM temp_data
 GROUP BY {{seller_col}}
 ORDER BY win_rate DESC NULLS LAST',
'{"seller_col":{"type":"text","description":"Vendedor"},
  "stage_col":{"type":"text","description":"Status/etapa (ganho/perdido/outros)"}}'::jsonb,
'["win rate","conversão","vendas"]'::jsonb,
'Taxa de ganho por vendedor.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Win-Rate por Vendedor' AND template_type='analytics');

-- 1.9 Ciclo Médio de Vendas (dias)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Ciclo Médio de Vendas (dias)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{start_date_col}}) AS periodo,
        AVG(EXTRACT(EPOCH FROM ({{close_date_col}}-{{start_date_col}}))/86400) AS ciclo_dias
 FROM temp_data
 WHERE {{close_date_col}} IS NOT NULL AND {{start_date_col}} IS NOT NULL
 GROUP BY 1
 ORDER BY 1',
'{"start_date_col":{"type":"date","description":"Data de início/opportunity"},
  "close_date_col":{"type":"date","description":"Data de fechamento"},
  "periodo":{"type":"text","description":"day|week|month|year","default":"month"}}'::jsonb,
'["ciclo","lead time","vendas","pipeline"]'::jsonb,
'Tempo médio de lead→fechamento.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Ciclo Médio de Vendas (dias)' AND template_type='analytics');

-- 1.10 Pareto de Clientes (Valor)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Pareto de Clientes (Valor)','Analytics','analytics',NULL,
'WITH base AS (
  SELECT {{client_col}} AS cliente, SUM({{value_col}}) AS valor
  FROM temp_data GROUP BY {{client_col}}
), ord AS (
  SELECT cliente, valor,
         SUM(valor) OVER () AS total,
         SUM(valor) OVER (ORDER BY valor DESC) AS acum
  FROM base
)
SELECT cliente, valor, acum/total AS perc_acum
FROM ord
ORDER BY valor DESC',
'{"client_col":{"type":"text","description":"Cliente"},
  "value_col":{"type":"numeric","description":"Valor monetário"}}'::jsonb,
'["pareto","clientes","abc","concentração"]'::jsonb,
'Concentração de receita por cliente.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Pareto de Clientes (Valor)' AND template_type='analytics');

-- 1.11 Inadimplência (Rate)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Inadimplência (Rate)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{ref_date_col}}) AS periodo,
        SUM(CASE WHEN {{days_overdue_col}}>0 THEN {{value_col}} ELSE 0 END) AS vencido,
        SUM({{value_col}}) AS carteira,
        CASE WHEN SUM({{value_col}})>0 THEN SUM(CASE WHEN {{days_overdue_col}}>0 THEN {{value_col}} ELSE 0 END)::numeric/SUM({{value_col}}) END AS inadimplencia_pct
 FROM temp_data
 GROUP BY 1
 ORDER BY 1',
'{"ref_date_col":{"type":"date","description":"Data de referência"},
  "days_overdue_col":{"type":"numeric","description":"Dias em atraso"},
  "value_col":{"type":"numeric","description":"Valor do título"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["inadimplência","carteira","recebíveis","aging"]'::jsonb,
'Taxa de inadimplência por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Inadimplência (Rate)' AND template_type='analytics');

-- 1.12 Recompra (Recorrência de Clientes)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Recompra (Recorrência de Clientes)','Analytics','analytics',NULL,
'WITH c AS (
  SELECT {{client_col}} AS cliente, COUNT(*) AS compras
  FROM temp_data GROUP BY {{client_col}}
)
SELECT compras, COUNT(*) AS clientes
FROM c
GROUP BY compras
ORDER BY compras',
'{"client_col":{"type":"text","description":"Cliente"}}'::jsonb,
'["recorrência","recompra","repeat rate"]'::jsonb,
'Distribuição de frequência de compra.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Recompra (Recorrência de Clientes)' AND template_type='analytics');


/* =========================
   2) MARKETING & GROWTH
   ========================= */

-- 2.1 CAC por Canal
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'CAC por Canal','Analytics','analytics',NULL,
'WITH base AS (
  SELECT {{channel_col}} AS canal,
         SUM({{spend_col}}) AS custo,
         SUM(CASE WHEN {{event_col}}=''cliente'' THEN 1 ELSE 0 END) AS novos_clientes
  FROM temp_data GROUP BY {{channel_col}}
)
SELECT canal, custo, novos_clientes,
       CASE WHEN novos_clientes>0 THEN custo/novos_clientes END AS cac
FROM base
ORDER BY cac NULLS LAST',
'{"channel_col":{"type":"text","description":"Canal/mídia"},
  "spend_col":{"type":"numeric","description":"Custo de mídia"},
  "event_col":{"type":"text","description":"Evento (lead, mql, cliente)"}}'::jsonb,
'["cac","aquisição","marketing"]'::jsonb,
'CAC por canal.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='CAC por Canal' AND template_type='analytics');

-- 2.2 LTV x CAC por Canal
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'LTV x CAC por Canal','Analytics','analytics',NULL,
'WITH base AS (
  SELECT {{channel_col}} AS canal,
         AVG({{ltv_col}}) AS ltv_medio,
         AVG({{cac_col}}) AS cac_medio
  FROM temp_data GROUP BY {{channel_col}}
)
SELECT canal, ltv_medio, cac_medio,
       CASE WHEN cac_medio>0 THEN ltv_medio/cac_medio END AS ltv_cac_ratio
FROM base
ORDER BY ltv_cac_ratio DESC NULLS LAST',
'{"channel_col":{"type":"text"},
  "ltv_col":{"type":"numeric"},
  "cac_col":{"type":"numeric"}}'::jsonb,
'["ltv","cac","ratio","payback"]'::jsonb,
'Compara retorno versus custo por canal.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='LTV x CAC por Canal' AND template_type='analytics');

-- 2.3 ROAS por Campanha
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'ROAS por Campanha','Analytics','analytics',NULL,
'SELECT {{campaign_col}} AS campanha,
        SUM({{revenue_col}}) AS receita,
        SUM({{spend_col}}) AS custo_midia,
        CASE WHEN SUM({{spend_col}})>0 THEN SUM({{revenue_col}})/SUM({{spend_col}}) END AS roas
FROM temp_data
GROUP BY {{campaign_col}}
ORDER BY roas DESC NULLS LAST',
'{"campaign_col":{"type":"text"},
  "revenue_col":{"type":"numeric"},
  "spend_col":{"type":"numeric"}}'::jsonb,
'["roas","ads","campanha","retorno"]'::jsonb,
'Retorno sobre gasto em anúncios (ROAS).',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='ROAS por Campanha' AND template_type='analytics');

-- 2.4 CTR/CPC/CPM por Campanha
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'CTR/CPC/CPM por Campanha','Analytics','analytics',NULL,
'SELECT {{campaign_col}} AS campanha,
        SUM({{impr_col}}) AS impressoes,
        SUM({{click_col}}) AS cliques,
        SUM({{spend_col}}) AS gasto,
        CASE WHEN SUM({{impr_col}})>0 THEN 100.0*SUM({{click_col}})/SUM({{impr_col}}) END AS ctr_pct,
        CASE WHEN SUM({{click_col}})>0 THEN SUM({{spend_col}})/SUM({{click_col}}) END AS cpc,
        CASE WHEN SUM({{impr_col}})>0 THEN 1000.0*SUM({{spend_col}})/SUM({{impr_col}}) END AS cpm
FROM temp_data
GROUP BY {{campaign_col}}
ORDER BY gasto DESC',
'{"campaign_col":{"type":"text"},
  "impr_col":{"type":"numeric"},
  "click_col":{"type":"numeric"},
  "spend_col":{"type":"numeric"}}'::jsonb,
'["ctr","cpc","cpm","ads","mídia"]'::jsonb,
'KPIs básicos de mídia por campanha.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='CTR/CPC/CPM por Campanha' AND template_type='analytics');

-- 2.5 Conversão do Funil (Visita→Cliente)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Conversão do Funil (Visita→Cliente)','Analytics','analytics',NULL,
'SELECT {{stage_col}} AS etapa,
        COUNT(*) AS total,
        100.0*COUNT(*)/NULLIF(SUM(COUNT(*)) OVER (),0) AS perc
FROM temp_data
GROUP BY {{stage_col}}
ORDER BY perc DESC',
'{"stage_col":{"type":"text","description":"Etapa do funil"}}'::jsonb,
'["funnel","conversão","etapa"]'::jsonb,
'Distribuição por etapa do funil.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Conversão do Funil (Visita→Cliente)' AND template_type='analytics');

-- 2.6 MER (Marketing Efficiency Ratio)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'MER (Marketing Efficiency Ratio)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{revenue_col}}) AS receita,
        SUM({{spend_col}}) AS gasto_midia,
        CASE WHEN SUM({{spend_col}})>0 THEN SUM({{revenue_col}})/SUM({{spend_col}}) END AS mer
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "revenue_col":{"type":"numeric"},
  "spend_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["mer","eficiência","marketing"]'::jsonb,
'Receita/Gasto total de marketing.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='MER (Marketing Efficiency Ratio)' AND template_type='analytics');

-- 2.7 Cohort de Aquisição (Retenção)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Cohort de Aquisição (Retenção)','Analytics','analytics',NULL,
'WITH first_seen AS (
  SELECT {{customer_id_col}} AS cliente,
         MIN(DATE_TRUNC(''month'', {{acq_date_col}})) AS cohort
  FROM temp_data GROUP BY 1
),
activity AS (
  SELECT f.cohort, DATE_TRUNC(''month'', t.{{activity_date_col}}) AS mes, t.{{customer_id_col}} AS cliente
  FROM temp_data t JOIN first_seen f ON f.cliente=t.{{customer_id_col}}
)
SELECT cohort, mes, COUNT(DISTINCT cliente) AS ativos
FROM activity
GROUP BY cohort, mes
ORDER BY cohort, mes',
'{"customer_id_col":{"type":"text"},
  "acq_date_col":{"type":"date"},
  "activity_date_col":{"type":"date"}}'::jsonb,
'["cohort","aquisição","retenção"]'::jsonb,
'Retenção por mês de aquisição.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Cohort de Aquisição (Retenção)' AND template_type='analytics');


/* =========================
   3) CUSTOMER SUCCESS & SUPORTE
   ========================= */

-- 3.1 Churn Mensal (Clientes)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Churn Mensal (Clientes)','Analytics','analytics',NULL,
'WITH base AS (
  SELECT DATE_TRUNC(''month'', {{date_col}}) AS mes,
         {{customer_id_col}} AS cliente,
         MAX(CASE WHEN {{status_col}}=''ativo'' THEN 1 ELSE 0 END) AS ativo
  FROM temp_data GROUP BY 1,2
), agg AS (
  SELECT mes, SUM(ativo) AS base_ativa, SUM(CASE WHEN ativo=0 THEN 1 ELSE 0 END) AS churners
  FROM base GROUP BY mes
)
SELECT mes, base_ativa, churners,
       CASE WHEN base_ativa>0 THEN churners::numeric/base_ativa END AS churn_rate
FROM agg ORDER BY mes',
'{"date_col":{"type":"date"},
  "customer_id_col":{"type":"text"},
  "status_col":{"type":"text"}}'::jsonb,
'["churn","retenção","cs"]'::jsonb,
'Churn mensal em clientes.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Churn Mensal (Clientes)' AND template_type='analytics');

-- 3.2 NRR/GRR Mensal
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'NRR/GRR Mensal','Analytics','analytics',NULL,
'WITH mens AS (
  SELECT DATE_TRUNC(''month'', {{date_col}}) AS mes,
         SUM({{mrr_new_col}}) AS mrr_new,
         SUM({{mrr_expansion_col}}) AS mrr_exp,
         SUM({{mrr_contraction_col}}) AS mrr_cont,
         SUM({{mrr_churn_col}}) AS mrr_churn,
         SUM({{mrr_start_col}}) AS mrr_inicio
  FROM temp_data GROUP BY 1
)
SELECT mes, mrr_inicio, mrr_new, mrr_exp, mrr_cont, mrr_churn,
       CASE WHEN mrr_inicio>0 THEN (mrr_inicio - mrr_churn + mrr_exp)::numeric/mrr_inicio END AS nrr,
       CASE WHEN mrr_inicio>0 THEN (mrr_inicio - mrr_churn)::numeric/mrr_inicio END AS grr
FROM mens ORDER BY mes',
'{"date_col":{"type":"date"},
  "mrr_new_col":{"type":"numeric"},
  "mrr_expansion_col":{"type":"numeric"},
  "mrr_contraction_col":{"type":"numeric"},
  "mrr_churn_col":{"type":"numeric"},
  "mrr_start_col":{"type":"numeric"}}'::jsonb,
'["nrr","grr","mrr","saas","retenção"]'::jsonb,
'Apura NRR/GRR por mês.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='NRR/GRR Mensal' AND template_type='analytics');

-- 3.3 SLA de Atendimento
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'SLA de Atendimento','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{open_date_col}}) AS periodo,
        COUNT(*) AS tickets,
        SUM(CASE WHEN {{sla_met_col}}=TRUE THEN 1 ELSE 0 END) AS sla_ok,
        CASE WHEN COUNT(*)>0 THEN SUM(CASE WHEN {{sla_met_col}}=TRUE THEN 1 ELSE 0 END)::numeric/COUNT(*) END AS sla_pct
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"open_date_col":{"type":"date"},
  "sla_met_col":{"type":"boolean"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["sla","suporte","cs","atendimento"]'::jsonb,
'% de tickets dentro do SLA.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='SLA de Atendimento' AND template_type='analytics');

-- 3.4 Tempo de Primeira Resposta (min)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Tempo de Primeira Resposta (min)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{open_date_col}}) AS periodo,
        AVG(EXTRACT(EPOCH FROM ({{first_resp_col}}-{{open_date_col}}))/60) AS tpr_min
FROM temp_data
WHERE {{first_resp_col}} IS NOT NULL AND {{open_date_col}} IS NOT NULL
GROUP BY 1
ORDER BY 1',
'{"open_date_col":{"type":"date"},
  "first_resp_col":{"type":"date"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["primeira resposta","tpr","sla"]'::jsonb,
'TMP méd. até primeira resposta.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Tempo de Primeira Resposta (min)' AND template_type='analytics');

-- 3.5 NPS por Período
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'NPS por Período','Analytics','analytics',NULL,
'WITH base AS (
  SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
         CASE WHEN {{score_col}}>=9 THEN 1 WHEN {{score_col}}<=6 THEN -1 ELSE 0 END AS cls
  FROM temp_data
)
SELECT periodo,
       100.0*SUM(CASE WHEN cls=1 THEN 1 ELSE 0 END)/COUNT(*) AS pct_promoters,
       100.0*SUM(CASE WHEN cls=-1 THEN 1 ELSE 0 END)/COUNT(*) AS pct_detractors,
       (100.0*SUM(CASE WHEN cls=1 THEN 1 ELSE 0 END)/COUNT(*)) - (100.0*SUM(CASE WHEN cls=-1 THEN 1 ELSE 0 END)/COUNT(*)) AS nps
FROM base
GROUP BY periodo
ORDER BY periodo',
'{"date_col":{"type":"date"},
  "score_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["nps","csat","satisfação","customer success"]'::jsonb,
'Apura NPS por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='NPS por Período' AND template_type='analytics');


/* =========================
   4) FINANÇAS & CONTROLADORIA
   ========================= */

-- 4.1 DRE Sintético Mensal
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'DRE Sintético Mensal','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{revenue_col}}) AS receita,
        SUM({{cogs_col}}) AS cmv_cpv,
        SUM({{op_expen_col}}) AS despesas_oper,
        (SUM({{revenue_col}})-SUM({{cogs_col}})) AS margem_bruta,
        (SUM({{revenue_col}})-SUM({{cogs_col}})-SUM({{op_expen_col}})) AS ebitda
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "revenue_col":{"type":"numeric"},
  "cogs_col":{"type":"numeric"},
  "op_expen_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["dre","ebitda","financeiro","resultado"]'::jsonb,
'DRE sintético por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='DRE Sintético Mensal' AND template_type='analytics');

-- 4.2 Ponto de Equilíbrio Mensal
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Ponto de Equilíbrio Mensal','Analytics','analytics',NULL,
'WITH mens AS (
  SELECT DATE_TRUNC(''month'', {{date_col}}) AS mes,
         SUM({{revenue_col}}) AS receita,
         SUM({{var_cost_col}}) AS custo_variavel,
         SUM({{fix_cost_col}}) AS custo_fixo
  FROM temp_data GROUP BY 1
)
SELECT mes, receita, custo_variavel, custo_fixo,
       CASE WHEN receita>0 THEN 1 - (custo_variavel/receita) END AS margem_contrib,
       CASE WHEN (1-(custo_variavel/NULLIF(receita,0)))>0
            THEN custo_fixo/(1-(custo_variavel/NULLIF(receita,0)))
            ELSE NULL END AS pe_receita
FROM mens ORDER BY mes',
'{"date_col":{"type":"date"},
  "revenue_col":{"type":"numeric"},
  "var_cost_col":{"type":"numeric"},
  "fix_cost_col":{"type":"numeric"}}'::jsonb,
'["break-even","equilíbrio","margem contribuição"]'::jsonb,
'Apura PE por mês.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Ponto de Equilíbrio Mensal' AND template_type='analytics');

-- 4.3 Ciclo Financeiro (PMR/PMP/PMS)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Ciclo Financeiro (PMR/PMP/PMS)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        AVG({{pmr_col}}) AS pmr,
        AVG({{pmp_col}}) AS pmp,
        AVG({{pms_col}}) AS pms,
        (AVG({{pmr_col}})+AVG({{pms_col}})-AVG({{pmp_col}})) AS ciclo_financeiro
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "pmr_col":{"type":"numeric","description":"Prazo médio de recebimento (dias)"},
  "pmp_col":{"type":"numeric","description":"Prazo médio de pagamento (dias)"},
  "pms_col":{"type":"numeric","description":"Prazo médio de estocagem (dias)"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["ciclo financeiro","pmr","pmp","pms"]'::jsonb,
'Calcula ciclo financeiro.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Ciclo Financeiro (PMR/PMP/PMS)' AND template_type='analytics');

-- 4.4 Aging de Contas a Receber
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Aging de Contas a Receber','Analytics','analytics',NULL,
'SELECT {{customer_col}} AS cliente,
        SUM(CASE WHEN {{days_overdue_col}}<=0 THEN {{value_col}} ELSE 0 END) AS a_vencer,
        SUM(CASE WHEN {{days_overdue_col}} BETWEEN 1 AND 30 THEN {{value_col}} ELSE 0 END) AS d1_30,
        SUM(CASE WHEN {{days_overdue_col}} BETWEEN 31 AND 60 THEN {{value_col}} ELSE 0 END) AS d31_60,
        SUM(CASE WHEN {{days_overdue_col}} BETWEEN 61 AND 90 THEN {{value_col}} ELSE 0 END) AS d61_90,
        SUM(CASE WHEN {{days_overdue_col}}>90 THEN {{value_col}} ELSE 0 END) AS d90_plus
FROM temp_data
GROUP BY {{customer_col}}
ORDER BY d90_plus DESC',
'{"customer_col":{"type":"text"},
  "days_overdue_col":{"type":"numeric"},
  "value_col":{"type":"numeric"}}'::jsonb,
'["aging","contas a receber","inadimplência"]'::jsonb,
'Carteira por faixas de atraso.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Aging de Contas a Receber' AND template_type='analytics');

-- 4.5 Aging de Contas a Pagar
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Aging de Contas a Pagar','Analytics','analytics',NULL,
'SELECT {{supplier_col}} AS fornecedor,
        SUM(CASE WHEN {{days_overdue_col}}<=0 THEN {{value_col}} ELSE 0 END) AS a_vencer,
        SUM(CASE WHEN {{days_overdue_col}} BETWEEN 1 AND 30 THEN {{value_col}} ELSE 0 END) AS d1_30,
        SUM(CASE WHEN {{days_overdue_col}} BETWEEN 31 AND 60 THEN {{value_col}} ELSE 0 END) AS d31_60,
        SUM(CASE WHEN {{days_overdue_col}} BETWEEN 61 AND 90 THEN {{value_col}} ELSE 0 END) AS d61_90,
        SUM(CASE WHEN {{days_overdue_col}}>90 THEN {{value_col}} ELSE 0 END) AS d90_plus
FROM temp_data
GROUP BY {{supplier_col}}
ORDER BY d90_plus DESC',
'{"supplier_col":{"type":"text"},
  "days_overdue_col":{"type":"numeric"},
  "value_col":{"type":"numeric"}}'::jsonb,
'["aging","contas a pagar","fornecedores"]'::jsonb,
'Fornecedores por faixas de atraso.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Aging de Contas a Pagar' AND template_type='analytics');

-- 4.6 Orçado vs Realizado (Variação %)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Orçado vs Realizado (Variação %)','Analytics','analytics',NULL,
'SELECT {{cc_col}} AS centro_custo,
        SUM({{budget_col}}) AS orcado,
        SUM({{actual_col}}) AS realizado,
        CASE WHEN SUM({{budget_col}})<>0 THEN (SUM({{actual_col}})-SUM({{budget_col}}))/SUM({{budget_col}}) END AS variacao_pct
FROM temp_data
GROUP BY {{cc_col}}
ORDER BY variacao_pct DESC NULLS LAST',
'{"cc_col":{"type":"text","description":"Centro de custo"},
  "budget_col":{"type":"numeric"},
  "actual_col":{"type":"numeric"}}'::jsonb,
'["budget","forecast","variação","controladoria"]'::jsonb,
'Compara orçado vs realizado.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Orçado vs Realizado (Variação %)' AND template_type='analytics');


/* =========================
   5) COMPRAS & SUPRIMENTOS
   ========================= */

-- 5.1 Lead Time de Compra
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Lead Time de Compra','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{order_date_col}}) AS periodo,
        AVG(EXTRACT(EPOCH FROM ({{receive_date_col}}-{{order_date_col}}))/86400) AS lead_time_dias
FROM temp_data
WHERE {{receive_date_col}} IS NOT NULL AND {{order_date_col}} IS NOT NULL
GROUP BY 1
ORDER BY 1',
'{"order_date_col":{"type":"date"},
  "receive_date_col":{"type":"date"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["lead time","compras","supply"]'::jsonb,
'Tempo de pedido→recebimento.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Lead Time de Compra' AND template_type='analytics');

-- 5.2 Variação de Preço por Item
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Variação de Preço por Item','Analytics','analytics',NULL,
'SELECT {{item_col}} AS item,
        MIN({{price_col}}) AS preco_min,
        MAX({{price_col}}) AS preco_max,
        AVG({{price_col}}) AS preco_medio
FROM temp_data
GROUP BY {{item_col}}
ORDER BY preco_medio DESC',
'{"item_col":{"type":"text"},
  "price_col":{"type":"numeric"}}'::jsonb,
'["preço","variação","compras"]'::jsonb,
'Estatísticas de preço por item.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Variação de Preço por Item' AND template_type='analytics');

-- 5.3 Concentração por Fornecedor
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Concentração por Fornecedor','Analytics','analytics',NULL,
'WITH base AS (
  SELECT {{supplier_col}} AS fornecedor, SUM({{value_col}}) AS valor
  FROM temp_data GROUP BY {{supplier_col}}
), share AS (
  SELECT fornecedor, valor, SUM(valor) OVER () AS total,
         valor/SUM(valor) OVER () AS pct
  FROM base
)
SELECT fornecedor, valor, pct
FROM share
ORDER BY pct DESC',
'{"supplier_col":{"type":"text"},
  "value_col":{"type":"numeric"}}'::jsonb,
'["fornecedor","concentração","supply"]'::jsonb,
'Participação de gastos por fornecedor.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Concentração por Fornecedor' AND template_type='analytics');


/* =========================
   6) LOGÍSTICA & TRANSPORTE
   ========================= */

-- 6.1 Custo por Km
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Custo por Km','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{cost_col}}) AS custo_total,
        SUM({{km_col}}) AS km_total,
        CASE WHEN SUM({{km_col}})>0 THEN SUM({{cost_col}})/SUM({{km_col}}) END AS r$/km
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "cost_col":{"type":"numeric"},
  "km_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["frete","km","r$/km","logística"]'::jsonb,
'Apura R$/km por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Custo por Km' AND template_type='analytics');

-- 6.2 Custo por Tonelada
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Custo por Tonelada','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{cost_col}}) AS custo_total,
        SUM({{weight_col}}) AS peso_ton,
        CASE WHEN SUM({{weight_col}})>0 THEN SUM({{cost_col}})/SUM({{weight_col}}) END AS r$/ton
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "cost_col":{"type":"numeric"},
  "weight_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["r$/ton","peso","logística","frete"]'::jsonb,
'Apura R$/ton por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Custo por Tonelada' AND template_type='analytics');

-- 6.3 Atingimento do Frete Mínimo
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Atingimento do Frete Mínimo','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        COUNT(*) AS viagens,
        SUM(CASE WHEN {{revenue_freight_col}}>= {{min_freight_col}} THEN 1 ELSE 0 END) AS atingiu,
        CASE WHEN COUNT(*)>0 THEN SUM(CASE WHEN {{revenue_freight_col}}>= {{min_freight_col}} THEN 1 ELSE 0 END)::numeric/COUNT(*) END AS ating_pct
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "revenue_freight_col":{"type":"numeric"},
  "min_freight_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["frete mínimo","atingimento","rendimento","logística"]'::jsonb,
'% de viagens que atingem o mínimo.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Atingimento do Frete Mínimo' AND template_type='analytics');

-- 6.4 OTIF (On Time In Full)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'OTIF (On Time In Full)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{delivery_date_col}}) AS periodo,
        COUNT(*) AS entregas,
        SUM(CASE WHEN {{on_time_col}}=TRUE AND {{in_full_col}}=TRUE THEN 1 ELSE 0 END) AS otif_ok,
        CASE WHEN COUNT(*)>0 THEN SUM(CASE WHEN {{on_time_col}} AND {{in_full_col}} THEN 1 ELSE 0 END)::numeric/COUNT(*) END AS otif_pct
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"delivery_date_col":{"type":"date"},
  "on_time_col":{"type":"boolean"},
  "in_full_col":{"type":"boolean"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["otif","sla","entrega","prazo"]'::jsonb,
'Mede OTIF por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='OTIF (On Time In Full)' AND template_type='analytics');

-- 6.5 Lead Time Pedido→Entrega
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Lead Time Pedido→Entrega','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{order_date_col}}) AS periodo,
        AVG(EXTRACT(EPOCH FROM ({{delivery_date_col}}-{{order_date_col}}))/86400) AS lead_time_dias
FROM temp_data
WHERE {{delivery_date_col}} IS NOT NULL AND {{order_date_col}} IS NOT NULL
GROUP BY 1
ORDER BY 1',
'{"order_date_col":{"type":"date"},
  "delivery_date_col":{"type":"date"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["lead time","entrega","logística"]'::jsonb,
'Tempo médio pedido→entrega.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Lead Time Pedido→Entrega' AND template_type='analytics');

-- 6.6 Ocupação de Carga (Peso/Capacidade)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Ocupação de Carga (Peso/Capacidade)','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{weight_col}}) AS peso_total,
        SUM({{capacity_col}}) AS capacidade_total,
        CASE WHEN SUM({{capacity_col}})>0 THEN SUM({{weight_col}})/SUM({{capacity_col}}) END AS ocupacao
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "weight_col":{"type":"numeric","description":"Peso transportado"},
  "capacity_col":{"type":"numeric","description":"Capacidade do veículo"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["ocupação","carga","capacidade"]'::jsonb,
'Ocupação agregada por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Ocupação de Carga (Peso/Capacidade)' AND template_type='analytics');

-- 6.7 Custo por Parada
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Custo por Parada','Analytics','analytics',NULL,
'SELECT {{stop_id_col}} AS parada,
        SUM({{cost_col}}) AS custo_total,
        COUNT(*) AS ocorrencias,
        CASE WHEN COUNT(*)>0 THEN SUM({{cost_col}})/COUNT(*) END AS custo_medio
FROM temp_data
GROUP BY {{stop_id_col}}
ORDER BY custo_medio DESC NULLS LAST',
'{"stop_id_col":{"type":"text"},
  "cost_col":{"type":"numeric"}}'::jsonb,
'["paradas","rota","custo","logística"]'::jsonb,
'Custo médio por parada.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Custo por Parada' AND template_type='analytics');


/* =========================
   7) ESTOQUES & FULFILLMENT
   ========================= */

-- 7.1 Giro de Estoque
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Giro de Estoque','Analytics','analytics',NULL,
'WITH mov AS (
  SELECT {{sku_col}} AS sku,
         SUM({{sales_qty_col}}) AS saidas,
         AVG({{stock_avg_col}}) AS estoque_medio
  FROM temp_data GROUP BY {{sku_col}}
)
SELECT sku, saidas, estoque_medio,
       CASE WHEN estoque_medio>0 THEN saidas/estoque_medio END AS giro
FROM mov
ORDER BY giro DESC NULLS LAST',
'{"sku_col":{"type":"text"},
  "sales_qty_col":{"type":"numeric"},
  "stock_avg_col":{"type":"numeric"}}'::jsonb,
'["giro","inventário","estoque"]'::jsonb,
'Giro de estoque por SKU.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Giro de Estoque' AND template_type='analytics');

-- 7.2 Cobertura de Estoque (dias)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Cobertura de Estoque (dias)','Analytics','analytics',NULL,
'SELECT {{sku_col}} AS sku,
        SUM({{stock_qty_col}}) AS estoque_total,
        SUM({{daily_out_col}}) AS saida_diaria,
        CASE WHEN SUM({{daily_out_col}})>0 THEN SUM({{stock_qty_col}})/SUM({{daily_out_col}}) END AS cobertura_dias
FROM temp_data
GROUP BY {{sku_col}}
ORDER BY cobertura_dias ASC NULLS LAST',
'{"sku_col":{"type":"text"},
  "stock_qty_col":{"type":"numeric"},
  "daily_out_col":{"type":"numeric","description":"Consumo/dia"}}'::jsonb,
'["cobertura","dias","estoque"]'::jsonb,
'Quantos dias o estoque cobre.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Cobertura de Estoque (dias)' AND template_type='analytics');

-- 7.3 Ruptura por SKU
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Ruptura por SKU','Analytics','analytics',NULL,
'SELECT {{sku_col}} AS sku,
        SUM(CASE WHEN {{stock_qty_col}}<=0 THEN 1 ELSE 0 END) AS dias_sem_estoque,
        COUNT(*) AS dias_total,
        CASE WHEN COUNT(*)>0 THEN SUM(CASE WHEN {{stock_qty_col}}<=0 THEN 1 ELSE 0 END)::numeric/COUNT(*) END AS ruptura_pct
FROM temp_data
GROUP BY {{sku_col}}
ORDER BY ruptura_pct DESC',
'{"sku_col":{"type":"text"},
  "stock_qty_col":{"type":"numeric"}}'::jsonb,
'["ruptura","stockout","oos","varejo"]'::jsonb,
'% dias sem estoque por SKU.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Ruptura por SKU' AND template_type='analytics');

-- 7.4 Idade do Estoque (Aging)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Idade do Estoque (Aging)','Analytics','analytics',NULL,
'SELECT {{sku_col}} AS sku,
        SUM(CASE WHEN {{age_days_col}}<=30 THEN {{qty_col}} ELSE 0 END) AS d0_30,
        SUM(CASE WHEN {{age_days_col}} BETWEEN 31 AND 60 THEN {{qty_col}} ELSE 0 END) AS d31_60,
        SUM(CASE WHEN {{age_days_col}} BETWEEN 61 AND 90 THEN {{qty_col}} ELSE 0 END) AS d61_90,
        SUM(CASE WHEN {{age_days_col}}>90 THEN {{qty_col}} ELSE 0 END) AS d90_plus
FROM temp_data
GROUP BY {{sku_col}}
ORDER BY d90_plus DESC',
'{"sku_col":{"type":"text"},
  "age_days_col":{"type":"numeric","description":"Dias em estoque"},
  "qty_col":{"type":"numeric"}}'::jsonb,
'["aging","obsolescência","estoque"]'::jsonb,
'Faixas de idade de estoque por SKU.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Idade do Estoque (Aging)' AND template_type='analytics');


/* =========================
   8) RH & PEOPLE ANALYTICS
   ========================= */

-- 8.1 Turnover Mensal
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Turnover Mensal','Analytics','analytics',NULL,
'WITH mov AS (
  SELECT DATE_TRUNC(''month'', {{date_col}}) AS mes,
         SUM(CASE WHEN {{event_col}}=''admissao'' THEN 1 ELSE 0 END) AS adm,
         SUM(CASE WHEN {{event_col}}=''desligamento'' THEN 1 ELSE 0 END) AS deslig,
         AVG({{headcount_col}}) AS headcount_medio
  FROM temp_data GROUP BY 1
)
SELECT mes, adm, deslig, headcount_medio,
       CASE WHEN headcount_medio>0 THEN deslig::numeric/headcount_medio END AS turnover
FROM mov ORDER BY mes',
'{"date_col":{"type":"date"},
  "event_col":{"type":"text"},
  "headcount_col":{"type":"numeric"}}'::jsonb,
'["turnover","rh","people"]'::jsonb,
'Turnover mensal.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Turnover Mensal' AND template_type='analytics');

-- 8.2 Absenteísmo por Área
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Absenteísmo por Área','Analytics','analytics',NULL,
'SELECT {{dept_col}} AS area,
        SUM({{absent_hours_col}}) AS horas_ausentes,
        SUM({{work_hours_col}}) AS horas_trabalhaveis,
        CASE WHEN SUM({{work_hours_col}})>0 THEN SUM({{absent_hours_col}})/SUM({{work_hours_col}}) END AS absenteismo_pct
FROM temp_data
GROUP BY {{dept_col}}
ORDER BY absenteismo_pct DESC NULLS LAST',
'{"dept_col":{"type":"text"},
  "absent_hours_col":{"type":"numeric"},
  "work_hours_col":{"type":"numeric"}}'::jsonb,
'["absenteismo","rh","presença"]'::jsonb,
'Taxa de absenteísmo por área.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Absenteísmo por Área' AND template_type='analytics');

-- 8.3 Custo por Colaborador (Mês)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Custo por Colaborador (Mês)','Analytics','analytics',NULL,
'SELECT {{employee_col}} AS colaborador,
        DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{comp_cost_col}}) AS custo_total
FROM temp_data
GROUP BY {{employee_col}}, 2
ORDER BY custo_total DESC',
'{"employee_col":{"type":"text"},
  "date_col":{"type":"date"},
  "comp_cost_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["custo","colaborador","rh"]'::jsonb,
'Custo consolidado por colaborador e mês.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Custo por Colaborador (Mês)' AND template_type='analytics');


/* =========================
   9) PRODUTO & TECNOLOGIA (SaaS)
   ========================= */

-- 9.1 DAU/MAU & Stickiness
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'DAU/MAU & Stickiness','Analytics','analytics',NULL,
'WITH daily AS (
  SELECT DATE_TRUNC(''day'', {{event_date_col}}) AS d, COUNT(DISTINCT {{user_id_col}}) AS dau
  FROM temp_data GROUP BY 1
), monthly AS (
  SELECT DATE_TRUNC(''month'', {{event_date_col}}) AS m, COUNT(DISTINCT {{user_id_col}}) AS mau
  FROM temp_data GROUP BY 1
)
SELECT m.m AS mes, COALESCE(AVG(d.dau) FILTER (WHERE DATE_TRUNC(''month'', d.d)=m.m),0) AS dau_medio,
       m.mau,
       CASE WHEN m.mau>0 THEN COALESCE(AVG(d.dau) FILTER (WHERE DATE_TRUNC(''month'', d.d)=m.m),0)::numeric/m.mau END AS stickiness
FROM monthly m
LEFT JOIN daily d ON DATE_TRUNC(''month'', d.d)=m.m
GROUP BY m.m, m.mau
ORDER BY m.m',
'{"event_date_col":{"type":"date"},
  "user_id_col":{"type":"text"}}'::jsonb,
'["dau","mau","stickiness","produto","engajamento"]'::jsonb,
'Engajamento (DAU/MAU).',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='DAU/MAU & Stickiness' AND template_type='analytics');

-- 9.2 Adoção de Features
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Adoção de Features','Analytics','analytics',NULL,
'SELECT {{feature_col}} AS feature,
        COUNT(DISTINCT {{user_id_col}}) AS usuarios,
        COUNT(*) AS eventos
FROM temp_data
GROUP BY {{feature_col}}
ORDER BY usuarios DESC',
'{"feature_col":{"type":"text"},
  "user_id_col":{"type":"text"}}'::jsonb,
'["feature","adoção","produto"]'::jsonb,
'Quais features mais usadas.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Adoção de Features' AND template_type='analytics');

-- 9.3 Incidentes: MTTR
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Incidentes: MTTR','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{open_date_col}}) AS periodo,
        AVG(EXTRACT(EPOCH FROM ({{close_date_col}}-{{open_date_col}}))/3600) AS mttr_horas
FROM temp_data
WHERE {{close_date_col}} IS NOT NULL AND {{open_date_col}} IS NOT NULL
GROUP BY 1
ORDER BY 1',
'{"open_date_col":{"type":"date"},
  "close_date_col":{"type":"date"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["mttr","incidentes","suporte","devops"]'::jsonb,
'Tempo médio para restaurar.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Incidentes: MTTR' AND template_type='analytics');


/* =========================
   10) E-COMMERCE
   ========================= */

-- 10.1 Conversão por Sessão
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Conversão por Sessão','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{session_date_col}}) AS periodo,
        SUM({{sessions_col}}) AS sessoes,
        SUM({{orders_col}}) AS pedidos,
        CASE WHEN SUM({{sessions_col}})>0 THEN 100.0*SUM({{orders_col}})/SUM({{sessions_col}}) END AS conv_pct
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"session_date_col":{"type":"date"},
  "sessions_col":{"type":"numeric"},
  "orders_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["conversão","sessões","ecommerce"]'::jsonb,
'Taxa de conversão por período.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Conversão por Sessão' AND template_type='analytics');

-- 10.2 Abandono de Carrinho
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Abandono de Carrinho','Analytics','analytics',NULL,
'SELECT DATE_TRUNC(''{{periodo}}'', {{date_col}}) AS periodo,
        SUM({{cart_starts_col}}) AS inicio_carrinho,
        SUM({{checkout_col}}) AS checkouts,
        CASE WHEN SUM({{cart_starts_col}})>0 THEN 100.0*(SUM({{cart_starts_col}})-SUM({{checkout_col}}))/SUM({{cart_starts_col}}) END AS abandono_pct
FROM temp_data
GROUP BY 1
ORDER BY 1',
'{"date_col":{"type":"date"},
  "cart_starts_col":{"type":"numeric"},
  "checkout_col":{"type":"numeric"},
  "periodo":{"type":"text","default":"month"}}'::jsonb,
'["abandono","carrinho","checkout","ecommerce"]'::jsonb,
'% de abandono do carrinho.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Abandono de Carrinho' AND template_type='analytics');


/* =========================
   11) PROJETOS & PMO
   ========================= */

-- 11.1 Prazo Planejado x Realizado (Variação)
INSERT INTO models (id,name,category,template_type,file_type,sql_template,required_columns,semantic_tags,description,created_at,updated_at)
SELECT gen_random_uuid(),'Prazo Planejado x Realizado (Variação)','Analytics','analytics',NULL,
'SELECT {{project_col}} AS projeto,
        AVG(EXTRACT(EPOCH FROM ({{real_end_col}}-{{real_start_col}}))/86400) AS dias_real,
        AVG(EXTRACT(EPOCH FROM ({{plan_end_col}}-{{plan_start_col}}))/86400) AS dias_planejado,
        CASE WHEN AVG(EXTRACT(EPOCH FROM ({{plan_end_col}}-{{plan_start_col}}))/86400)>0
             THEN (AVG(EXTRACT(EPOCH FROM ({{real_end_col}}-{{real_start_col}}))/86400)/
                   AVG(EXTRACT(EPOCH FROM ({{plan_end_col}}-{{plan_start_col}}))/86400) - 1)
        END AS variacao_pct
FROM temp_data
GROUP BY {{project_col}}
ORDER BY variacao_pct DESC NULLS LAST',
'{"project_col":{"type":"text"},
  "real_start_col":{"type":"date"},
  "real_end_col":{"type":"date"},
  "plan_start_col":{"type":"date"},
  "plan_end_col":{"type":"date"}}'::jsonb,
'["pmo","prazo","cronograma","projetos"]'::jsonb,
'Compara prazos real vs planejado.',
now(),now()
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name='Prazo Planejado x Realizado (Variação)' AND template_type='analytics');

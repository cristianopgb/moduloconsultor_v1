-- ===================================================================
-- SEED DATA FOR ANALYTICS GOVERNANCE SYSTEM
-- ===================================================================
-- Populates semantic_dictionary and metrics_registry with standard
-- entities and metrics for common business domains
-- ===================================================================

-- ===================== SEMANTIC DICTIONARY - SYSTEM-WIDE ENTITIES =====================

-- Dimensions (common entities across domains)

-- Salesperson/Vendor/Rep
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Vendedor',
  '["salesperson", "rep", "representante", "vendedor", "seller", "sales_rep", "agent"]'::jsonb,
  'Pessoa ou entidade responsável por realizar vendas',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Product/SKU/Item
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Produto',
  '["product", "item", "sku", "produto", "artigo", "merchandise", "goods"]'::jsonb,
  'Item comercializado ou gerenciado no sistema',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Customer/Client
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Cliente',
  '["customer", "client", "cliente", "buyer", "account", "consumidor"]'::jsonb,
  'Pessoa ou empresa que adquire produtos/serviços',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Date/Period/Time
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Data',
  '["date", "data", "period", "periodo", "time", "tempo", "day", "dia", "month", "mes"]'::jsonb,
  'Dimensão temporal dos dados',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Category
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Categoria',
  '["category", "categoria", "class", "classe", "type", "tipo", "group", "grupo"]'::jsonb,
  'Classificação ou agrupamento de itens',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Region/Territory
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Região',
  '["region", "regiao", "territory", "territorio", "area", "zone", "zona", "location", "local"]'::jsonb,
  'Área geográfica ou território de atuação',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Carrier/Transporter
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'dimension',
  'Transportadora',
  '["carrier", "transportadora", "transporter", "shipping_company", "courier", "logistics_provider"]'::jsonb,
  'Empresa responsável pelo transporte/entrega',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Measures (metrics/values)

-- Price/Value
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'measure',
  'Preço',
  '["price", "preco", "valor", "value", "amount", "unit_price", "preco_unit"]'::jsonb,
  'Valor monetário de venda',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Cost
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'measure',
  'Custo',
  '["cost", "custo", "expense", "despesa", "unit_cost", "custo_unit"]'::jsonb,
  'Valor de custo ou despesa',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Quantity/Volume
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'measure',
  'Quantidade',
  '["quantity", "quantidade", "volume", "qty", "units", "unidades", "count", "contagem"]'::jsonb,
  'Quantidade ou volume de itens',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- Revenue/Sales
INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version)
VALUES (
  NULL,
  'measure',
  'Receita',
  '["revenue", "receita", "sales", "vendas", "faturamento", "income"]'::jsonb,
  'Valor total de receitas/vendas',
  1
) ON CONFLICT (tenant_id, canonical_name, entity_type) DO NOTHING;

-- ===================== METRICS REGISTRY - STANDARD METRICS =====================

-- Revenue (Receita)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'revenue',
  'Receita',
  'SUM(price * quantity)',
  '["price", "quantity"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'generic',
  'R$',
  'currency'
) ON CONFLICT (name) DO NOTHING;

-- Cost (Custo)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'cost',
  'Custo Total',
  'SUM(cost * quantity)',
  '["cost", "quantity"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'generic',
  'R$',
  'currency'
) ON CONFLICT (name) DO NOTHING;

-- Margin (Margem)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'margin',
  'Margem',
  'SUM(price * quantity) - SUM(cost * quantity)',
  '["price", "quantity", "cost"]'::jsonb,
  '["revenue", "cost"]'::jsonb,
  '[{"condition": "cost_missing", "fallback_metric_id": null, "warning_message": "Custo ausente - margem não calculável"}]'::jsonb,
  'aggregate',
  'generic',
  'R$',
  'currency'
) ON CONFLICT (name) DO NOTHING;

-- Margin % (Margem Percentual)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'margin_pct',
  'Margem %',
  '((SUM(price * quantity) - SUM(cost * quantity)) / NULLIF(SUM(price * quantity), 0)) * 100',
  '["price", "quantity", "cost"]'::jsonb,
  '["revenue", "cost"]'::jsonb,
  '[{"condition": "cost_missing", "fallback_metric_id": null, "warning_message": "Custo ausente - apenas registros com custo serão considerados"}]'::jsonb,
  'aggregate',
  'financial',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- ROI (Return on Investment)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'roi',
  'ROI (Retorno sobre Investimento)',
  '((SUM(revenue) - SUM(investment)) / NULLIF(SUM(investment), 0)) * 100',
  '["revenue", "investment"]'::jsonb,
  '["revenue"]'::jsonb,
  '[{"condition": "investment_missing", "fallback_metric_id": "margin_pct", "warning_message": "Investimento ausente - ROI omitido, utilize Margem% como alternativa"}]'::jsonb,
  'aggregate',
  'financial',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- ROAS (Return on Ad Spend)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'roas',
  'ROAS (Retorno sobre Investimento em Mídia)',
  '(SUM(revenue) / NULLIF(SUM(ad_spend), 0))',
  '["revenue", "ad_spend"]'::jsonb,
  '["revenue"]'::jsonb,
  '[{"condition": "ad_spend_missing", "fallback_metric_id": null, "warning_message": "Investimento em mídia ausente - ROAS não calculável"}]'::jsonb,
  'aggregate',
  'sales',
  'x',
  'number'
) ON CONFLICT (name) DO NOTHING;

-- Average Ticket (Ticket Médio)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'avg_ticket',
  'Ticket Médio',
  'SUM(revenue) / NULLIF(COUNT(DISTINCT order_id), 0)',
  '["revenue", "order_id"]'::jsonb,
  '["revenue"]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'sales',
  'R$',
  'currency'
) ON CONFLICT (name) DO NOTHING;

-- OTIF (On Time In Full)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'otif',
  'OTIF (On Time In Full)',
  '(COUNT(CASE WHEN on_time = 1 AND in_full = 1 THEN 1 END) / NULLIF(COUNT(*), 0)) * 100',
  '["on_time", "in_full"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'logistics',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- On Time %
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'on_time_pct',
  'On Time %',
  '(COUNT(CASE WHEN on_time = 1 THEN 1 END) / NULLIF(COUNT(*), 0)) * 100',
  '["on_time"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'logistics',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- In Full %
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'in_full_pct',
  'In Full %',
  '(COUNT(CASE WHEN in_full = 1 THEN 1 END) / NULLIF(COUNT(*), 0)) * 100',
  '["in_full"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'logistics',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- Conversion Rate (Taxa de Conversão)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'conversion_rate',
  'Taxa de Conversão',
  '(COUNT(CASE WHEN converted = 1 THEN 1 END) / NULLIF(COUNT(*), 0)) * 100',
  '["converted"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'sales',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- LTV (Lifetime Value)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'ltv',
  'LTV (Valor de Vida do Cliente)',
  'SUM(revenue) / NULLIF(COUNT(DISTINCT customer_id), 0)',
  '["revenue", "customer_id"]'::jsonb,
  '["revenue"]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'sales',
  'R$',
  'currency'
) ON CONFLICT (name) DO NOTHING;

-- CAC (Customer Acquisition Cost)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'cac',
  'CAC (Custo de Aquisição de Cliente)',
  'SUM(marketing_cost) / NULLIF(COUNT(DISTINCT new_customer_id), 0)',
  '["marketing_cost", "new_customer_id"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'sales',
  'R$',
  'currency'
) ON CONFLICT (name) DO NOTHING;

-- Churn Rate (Taxa de Cancelamento)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'churn_rate',
  'Taxa de Cancelamento (Churn)',
  '(COUNT(CASE WHEN churned = 1 THEN 1 END) / NULLIF(COUNT(*), 0)) * 100',
  '["churned"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'sales',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

-- Turnover Rate (Taxa de Rotatividade - RH)
INSERT INTO metrics_registry (name, display_name, formula_template, required_columns, dependencies, fallback_rules, granularity, domain, unit, format)
VALUES (
  'turnover_rate',
  'Taxa de Rotatividade (Turnover)',
  '(COUNT(CASE WHEN left_company = 1 THEN 1 END) / NULLIF(COUNT(*), 0)) * 100',
  '["left_company"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'aggregate',
  'hr',
  '%',
  'percentage'
) ON CONFLICT (name) DO NOTHING;

/*
  # Seed Semantic Dictionary - Complete Business Domains

  Populates semantic_dictionary with canonical names and synonyms for:
  - Commercial dimensions (customer, product, order, invoice, channel)
  - Logistics (carrier, warehouse, route, delivery)
  - Time dimensions (dates)
  - Quantities & measures
  - Financial values
  - KPIs and metrics
  - Inventory/WMS
  - Services
  - Industrial/Manufacturing
  - Retail/PDV

  Format: entity_type = 'column' for dimensions, 'metric' for KPIs
*/

-- Clear existing data (optional - comment out if you want to preserve existing entries)
TRUNCATE semantic_dictionary;

-- ==================== COMMERCIAL DIMENSIONS ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'customer', '["cliente","clientes","cli","sacado","tomador","comprador","destinatario"]'::jsonb, 'Pessoa/empresa que compra/recebe', 1),
(NULL, 'column', 'customer_id', '["id_cliente","cod_cliente","codigo_cliente","cnpj_cpf_cliente","doc_cliente"]'::jsonb, 'Identificador do cliente', 1),
(NULL, 'column', 'customer_segment', '["segmento_cliente","classe_cliente","tipo_cliente","perfil_cliente"]'::jsonb, 'Segmentação de clientes', 1),
(NULL, 'column', 'salesperson', '["vendedor","rep","representante","consultor_vendas"]'::jsonb, 'Responsável pela venda', 1),
(NULL, 'column', 'salesperson_id', '["id_vendedor","cod_vendedor"]'::jsonb, 'Identificador do vendedor', 1),
(NULL, 'column', 'product', '["produto","item","mercadoria"]'::jsonb, 'Nome comercial do produto', 1),
(NULL, 'column', 'sku', '["sku","cod_produto","codigo_item","ref","referencia","ean","gtin","barra"]'::jsonb, 'Identificador do item', 1),
(NULL, 'column', 'brand', '["marca","fabricante"]'::jsonb, 'Marca do produto', 1),
(NULL, 'column', 'category', '["categoria","classe_produto","linha_produto"]'::jsonb, 'Categoria principal', 1),
(NULL, 'column', 'subcategory', '["subcategoria","familia_produto"]'::jsonb, 'Categoria secundária', 1),
(NULL, 'column', 'model', '["modelo","variante","versao"]'::jsonb, 'Modelo/variação', 1),
(NULL, 'column', 'color', '["cor","tonalidade"]'::jsonb, 'Atributo de cor', 1),
(NULL, 'column', 'size', '["tamanho","medida","porte"]'::jsonb, 'Atributo de tamanho', 1),
(NULL, 'column', 'lot', '["lote","batch"]'::jsonb, 'Rastreabilidade por lote', 1),
(NULL, 'column', 'serial_number', '["numero_serie","serie"]'::jsonb, 'Rastreabilidade por série', 1),
(NULL, 'column', 'expiration_date', '["validade","data_validade"]'::jsonb, 'Data de vencimento', 1),
(NULL, 'column', 'supplier', '["fornecedor","provedor","vendor"]'::jsonb, 'Fornecedor', 1),
(NULL, 'column', 'supplier_id', '["id_fornecedor","cod_fornecedor"]'::jsonb, 'Identificador do fornecedor', 1),
(NULL, 'column', 'company', '["empresa","filial_matriz","unidade_negocio"]'::jsonb, 'Empresa/unidade', 1),
(NULL, 'column', 'branch', '["filial","unidade","loja","cd"]'::jsonb, 'Local físico/comercial', 1),
(NULL, 'column', 'warehouse', '["armazem","deposito","cd","centro_distribuicao"]'::jsonb, 'Estoque físico', 1),
(NULL, 'column', 'bin_location', '["endereco_estoque","rua_box","prateleira","posicao"]'::jsonb, 'Endereço no estoque', 1),
(NULL, 'column', 'order', '["pedido","ped","ordem_venda","ov"]'::jsonb, 'Pedido de venda', 1),
(NULL, 'column', 'order_id', '["id_pedido","numero_pedido","doc_pedido"]'::jsonb, 'Chave do pedido', 1),
(NULL, 'column', 'invoice', '["nota_fiscal","nf","nfe","nf_e"]'::jsonb, 'Documento fiscal', 1),
(NULL, 'column', 'invoice_number', '["numero_nota","nr_nf","nr_nfe"]'::jsonb, 'Número da NF', 1),
(NULL, 'column', 'invoice_series', '["serie_nota","serie"]'::jsonb, 'Série fiscal', 1),
(NULL, 'column', 'fiscal_cfop', '["cfop","natureza_operacao"]'::jsonb, 'Código fiscal CFOP (BR)', 1),
(NULL, 'column', 'document_type', '["tipo_documento","natureza","doc_tipo"]'::jsonb, 'Tipo de documento', 1),
(NULL, 'column', 'payment_method', '["meio_pagamento","forma_pagamento","condicao_pagamento","gateway","cartao","pix","boleto","transferencia"]'::jsonb, 'Método de pagamento', 1),
(NULL, 'column', 'payment_status', '["status_pagamento","liquidacao","quitado","pendente","em_aberto"]'::jsonb, 'Situação do pagamento', 1),
(NULL, 'column', 'installments', '["parcelas","qtd_parcelas"]'::jsonb, 'Número de parcelas', 1),
(NULL, 'column', 'pix_txid', '["pix","txid","end_to_end_id"]'::jsonb, 'Identificador PIX', 1),
(NULL, 'column', 'card_brand', '["bandeira_cartao","visa","master","elo","amex"]'::jsonb, 'Bandeira do cartão', 1),
(NULL, 'column', 'campaign', '["campanha","promocao","cupom","voucher"]'::jsonb, 'Ações de marketing', 1),
(NULL, 'column', 'channel', '["canal","canal_venda","marketplace","ecommerce","loja_fisica","app"]'::jsonb, 'Origem comercial', 1),
(NULL, 'column', 'source_medium', '["origem_midias","source","medium","utm_source","utm_medium"]'::jsonb, 'Marketing digital', 1);

-- ==================== LOGISTICS ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'carrier', '["transportadora","parceiro_logistico","operador_logistico"]'::jsonb, 'Transportadora', 1),
(NULL, 'column', 'carrier_id', '["id_transportadora","cod_transportadora"]'::jsonb, 'Identificador da transportadora', 1),
(NULL, 'column', 'vehicle_plate', '["placa","placa_veiculo"]'::jsonb, 'Placa do veículo', 1),
(NULL, 'column', 'driver', '["motorista","condutor"]'::jsonb, 'Motorista', 1),
(NULL, 'column', 'route', '["rota","roteiro","percurso"]'::jsonb, 'Rota de entrega', 1),
(NULL, 'column', 'city', '["cidade","municipio"]'::jsonb, 'Cidade', 1),
(NULL, 'column', 'state', '["estado","uf","unidade_federativa"]'::jsonb, 'Estado (UF)', 1),
(NULL, 'column', 'country', '["pais"]'::jsonb, 'País', 1),
(NULL, 'column', 'zipcode', '["cep","codigo_postal"]'::jsonb, 'CEP', 1),
(NULL, 'column', 'region', '["regiao","macro_regiao"]'::jsonb, 'Região', 1),
(NULL, 'column', 'incoterm', '["incoterm","frete_regra"]'::jsonb, 'Incoterm (FOB, CIF)', 1),
(NULL, 'column', 'order_status', '["status_pedido","situacao_pedido"]'::jsonb, 'Status do pedido', 1),
(NULL, 'column', 'shipment_status', '["status_envio","status_entrega"]'::jsonb, 'Status de envio', 1),
(NULL, 'column', 'return_reason', '["motivo_devolucao","motivo_troca"]'::jsonb, 'Motivo de devolução', 1),
(NULL, 'column', 'cancellation_reason', '["motivo_cancelamento"]'::jsonb, 'Motivo de cancelamento', 1);

-- ==================== TIME DIMENSIONS ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'order_date', '["data_pedido","dt_pedido","criacao_pedido"]'::jsonb, 'Data do pedido', 1),
(NULL, 'column', 'issue_date', '["data_emissao","emissao","dt_emissao"]'::jsonb, 'Data de emissão', 1),
(NULL, 'column', 'shipment_date', '["data_despacho","dt_envio","saida_cd"]'::jsonb, 'Data de despacho', 1),
(NULL, 'column', 'delivery_date', '["data_entrega","dt_entregue","comprovacao_entrega"]'::jsonb, 'Data de entrega', 1),
(NULL, 'column', 'due_date', '["data_vencimento","dt_venc","vencimento"]'::jsonb, 'Data de vencimento', 1),
(NULL, 'column', 'payment_date', '["data_pagamento","dt_pagto","liquidacao"]'::jsonb, 'Data de pagamento', 1),
(NULL, 'column', 'return_date', '["data_devolucao","dt_retorno"]'::jsonb, 'Data de devolução', 1),
(NULL, 'column', 'month', '["mes","competencia_mes"]'::jsonb, 'Mês', 1),
(NULL, 'column', 'year', '["ano","competencia_ano"]'::jsonb, 'Ano', 1),
(NULL, 'column', 'week', '["semana","iso_week"]'::jsonb, 'Semana do ano', 1),
(NULL, 'column', 'quarter', '["trimestre","qtr"]'::jsonb, 'Trimestre', 1);

-- ==================== QUANTITIES & MEASURES ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'quantity', '["quantidade","qtd","qtde"]'::jsonb, 'Quantidade pedida', 1),
(NULL, 'column', 'qty_delivered', '["qtd_entregue","entregue","qtde_ent"]'::jsonb, 'Quantidade entregue', 1),
(NULL, 'column', 'qty_invoiced', '["qtd_faturada","faturado"]'::jsonb, 'Quantidade faturada', 1),
(NULL, 'column', 'qty_returned', '["qtd_devolvida","devolvido"]'::jsonb, 'Quantidade devolvida', 1),
(NULL, 'column', 'qty_canceled', '["qtd_cancelada"]'::jsonb, 'Quantidade cancelada', 1),
(NULL, 'column', 'weight', '["peso","peso_kg"]'::jsonb, 'Peso total (kg)', 1),
(NULL, 'column', 'net_weight', '["peso_liquido"]'::jsonb, 'Peso líquido', 1),
(NULL, 'column', 'gross_weight', '["peso_bruto"]'::jsonb, 'Peso bruto', 1),
(NULL, 'column', 'volume', '["volume","m3","cubagem"]'::jsonb, 'Volume total', 1),
(NULL, 'column', 'packages', '["volumes","pacotes","embalagens","colli"]'::jsonb, 'Número de volumes', 1);

-- ==================== FINANCIAL VALUES ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'unit_price', '["preco_unitario","vl_unit","prc_unit"]'::jsonb, 'Preço unitário', 1),
(NULL, 'column', 'list_price', '["preco_tabela","preco_lista"]'::jsonb, 'Preço de tabela', 1),
(NULL, 'column', 'cost', '["custo","custo_unitario","cmv","cpv"]'::jsonb, 'Custo', 1),
(NULL, 'column', 'revenue', '["receita","faturamento","valor_faturado","vl_total"]'::jsonb, 'Receita bruta', 1),
(NULL, 'column', 'net_revenue', '["receita_liquida","vl_liquido"]'::jsonb, 'Receita líquida', 1),
(NULL, 'column', 'discount_value', '["desconto","vl_desconto"]'::jsonb, 'Valor de desconto', 1),
(NULL, 'column', 'freight_value', '["frete","vl_frete","tarifa"]'::jsonb, 'Valor de frete', 1),
(NULL, 'column', 'tax_value', '["impostos","tributos","vl_imposto","icms","pis","cofins","iss"]'::jsonb, 'Carga tributária', 1),
(NULL, 'column', 'surcharge_value', '["adicional","taxa_extra"]'::jsonb, 'Valores adicionais', 1),
(NULL, 'column', 'total_value', '["valor_total","vl_total_nf","total_nota"]'::jsonb, 'Valor total do documento', 1),
(NULL, 'column', 'profit', '["lucro","resultado"]'::jsonb, 'Lucro', 1),
(NULL, 'column', 'contribution_margin', '["margem_contribuicao"]'::jsonb, 'Margem de contribuição', 1),
(NULL, 'column', 'average_ticket', '["ticket_medio","tm"]'::jsonb, 'Ticket médio', 1),
(NULL, 'column', 'ltv_value', '["ltv","lifetime_value","valor_vida_cliente"]'::jsonb, 'Lifetime Value', 1),
(NULL, 'column', 'cac_value', '["cac","custo_aquisicao_cliente"]'::jsonb, 'Custo de Aquisição de Cliente', 1);

-- ==================== LOGISTICS & OPERATIONS KPIs (METRICS) ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'metric', 'profit_margin_pct', '["margem","margem_percentual","margem_%"]'::jsonb, 'Margem de lucro percentual', 1),
(NULL, 'metric', 'markup_pct', '["markup","markup_%"]'::jsonb, 'Markup percentual', 1),
(NULL, 'metric', 'lead_time_days', '["lead_time","tempo_ciclo","tempo_total"]'::jsonb, 'Lead time em dias', 1),
(NULL, 'metric', 'picking_time_days', '["tempo_separacao","picking_time"]'::jsonb, 'Tempo de separação', 1),
(NULL, 'metric', 'shipping_time_days', '["tempo_transporte","transit_time"]'::jsonb, 'Tempo de transporte', 1),
(NULL, 'metric', 'delivery_delay_days', '["atraso_entrega_dias","delay_dias"]'::jsonb, 'Atraso de entrega', 1),
(NULL, 'metric', 'on_time_flag', '["entregue_no_prazo","on_time","no_prazo"]'::jsonb, 'Entregue no prazo (boolean)', 1),
(NULL, 'metric', 'in_full_flag', '["entregue_completo","in_full"]'::jsonb, 'Entregue completo (boolean)', 1),
(NULL, 'metric', 'otif_flag', '["otif","otif_ok"]'::jsonb, 'On Time In Full (boolean)', 1),
(NULL, 'metric', 'otif_reason', '["motivo_nao_otif","causa_otif"]'::jsonb, 'Motivo de falha OTIF', 1),
(NULL, 'metric', 'sla_target_days', '["sla_dias","prazo_acordado"]'::jsonb, 'SLA em dias', 1),
(NULL, 'metric', 'otif_rate_pct', '["otif_%"]'::jsonb, 'Taxa OTIF percentual', 1),
(NULL, 'metric', 'on_time_rate_pct', '["taxa_prazo","on_time_%"]'::jsonb, 'Taxa de entregas no prazo', 1),
(NULL, 'metric', 'fill_rate_pct', '["fill_rate","atendimento_pedido_%"]'::jsonb, 'Taxa de atendimento', 1),
(NULL, 'metric', 'returns_rate_pct', '["taxa_devolucao","%devolucao"]'::jsonb, 'Taxa de devolução', 1),
(NULL, 'metric', 'cancel_rate_pct', '["taxa_cancelamento"]'::jsonb, 'Taxa de cancelamento', 1);

-- ==================== E-COMMERCE & MARKETING ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'device', '["dispositivo","device","mobile","desktop"]'::jsonb, 'Dispositivo de origem', 1),
(NULL, 'column', 'new_customer_flag', '["cliente_novo","first_purchase","primeira_compra"]'::jsonb, 'Cliente novo (boolean)', 1),
(NULL, 'column', 'churn_flag', '["churn","inativo","perdido"]'::jsonb, 'Cliente em churn (boolean)', 1),
(NULL, 'column', 'nps_score', '["nps","satisfacao","avaliacao"]'::jsonb, 'NPS Score', 1),
(NULL, 'metric', 'conversion_rate_pct', '["taxa_conversao"]'::jsonb, 'Taxa de conversão', 1),
(NULL, 'metric', 'retention_rate_pct', '["taxa_retencao"]'::jsonb, 'Taxa de retenção', 1);

-- ==================== FISCAL (BRAZIL-SPECIFIC) ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'cnpj_cpf', '["documento","cnpj","cpf","doc","doc_fiscal"]'::jsonb, 'Documento fiscal (CNPJ/CPF)', 1),
(NULL, 'column', 'state_registration', '["ie","inscricao_estadual"]'::jsonb, 'Inscrição Estadual', 1),
(NULL, 'column', 'municipal_registration', '["im","inscricao_municipal"]'::jsonb, 'Inscrição Municipal', 1),
(NULL, 'column', 'fiscal_nfe_key', '["chave_nfe","chave_acesso"]'::jsonb, 'Chave NFe (44 dígitos)', 1),
(NULL, 'column', 'danfe_number', '["danfe","danfe_numero"]'::jsonb, 'Número DANFE', 1);

-- ==================== INVENTORY / WMS ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'on_hand_qty', '["qtd_estoque","saldo","on_hand"]'::jsonb, 'Quantidade em estoque', 1),
(NULL, 'column', 'available_qty', '["qtd_disponivel","disponivel"]'::jsonb, 'Quantidade disponível', 1),
(NULL, 'column', 'allocated_qty', '["qtd_alocada","reservado"]'::jsonb, 'Quantidade alocada', 1),
(NULL, 'column', 'backorder_qty', '["qtd_backorder","em_falta"]'::jsonb, 'Quantidade em backorder', 1),
(NULL, 'column', 'min_stock_qty', '["estoque_minimo","min"]'::jsonb, 'Estoque mínimo', 1),
(NULL, 'column', 'max_stock_qty', '["estoque_maximo","max"]'::jsonb, 'Estoque máximo', 1),
(NULL, 'column', 'safety_stock_qty', '["estoque_seguranca","safety_stock"]'::jsonb, 'Estoque de segurança', 1),
(NULL, 'column', 'reorder_point_qty', '["ponto_pedido","reorder_point"]'::jsonb, 'Ponto de pedido', 1),
(NULL, 'column', 'reorder_qty', '["qtd_reposicao","reorder_qty"]'::jsonb, 'Quantidade de reposição', 1),
(NULL, 'column', 'unit_cost', '["custo_unit","custo_padrao"]'::jsonb, 'Custo unitário', 1),
(NULL, 'column', 'average_cost', '["custo_medio","cm"]'::jsonb, 'Custo médio', 1),
(NULL, 'column', 'inventory_value', '["valor_estoque","estoque_valor"]'::jsonb, 'Valor do estoque', 1),
(NULL, 'metric', 'inventory_turnover', '["giro_estoque","turnover_%"]'::jsonb, 'Giro de estoque', 1),
(NULL, 'metric', 'days_on_hand', '["dias_estoque","doh"]'::jsonb, 'Dias de estoque', 1),
(NULL, 'metric', 'stockout_rate_pct', '["ruptura_%","falta_%","stockout_%"]'::jsonb, 'Taxa de ruptura', 1),
(NULL, 'metric', 'shrinkage_rate_pct', '["quebra_%","perdas_%"]'::jsonb, 'Taxa de quebra/perdas', 1);

-- ==================== SERVICES (CONSULTING, CLINICS, ACCOUNTING) ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'service_line', '["linha_servico","tipo_servico","especialidade"]'::jsonb, 'Linha de serviço', 1),
(NULL, 'column', 'engagement', '["projeto","contrato","os","ordem_servico"]'::jsonb, 'Contrato/projeto', 1),
(NULL, 'column', 'professional', '["consultor","medico","contador","analista"]'::jsonb, 'Profissional responsável', 1),
(NULL, 'column', 'appointment', '["consulta","sessao","atendimento"]'::jsonb, 'Atendimento/consulta', 1),
(NULL, 'column', 'billable_hours', '["horas_faturaveis","horas_billable"]'::jsonb, 'Horas faturáveis', 1),
(NULL, 'column', 'nonbillable_hours', '["horas_nao_faturaveis","horas_internas"]'::jsonb, 'Horas não faturáveis', 1),
(NULL, 'column', 'sessions_count', '["qtde_sessoes","atendimentos"]'::jsonb, 'Quantidade de sessões', 1),
(NULL, 'column', 'no_show_count', '["faltas","no_show"]'::jsonb, 'Faltas', 1),
(NULL, 'metric', 'utilization_pct', '["utilizacao_%","ocupacao_%"]'::jsonb, 'Taxa de utilização', 1),
(NULL, 'metric', 'no_show_rate_pct', '["taxa_falta_%"]'::jsonb, 'Taxa de falta', 1);

-- ==================== INDUSTRIAL / MANUFACTURING ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'plant', '["planta","fabrica","unidade_industrial"]'::jsonb, 'Planta industrial', 1),
(NULL, 'column', 'work_center', '["centro_trabalho","ct","estacao"]'::jsonb, 'Centro de trabalho', 1),
(NULL, 'column', 'production_line', '["linha_producao","linha"]'::jsonb, 'Linha de produção', 1),
(NULL, 'column', 'mo', '["ordem_producao","op","production_order"]'::jsonb, 'Ordem de produção', 1),
(NULL, 'column', 'shift', '["turno","jornada"]'::jsonb, 'Turno', 1),
(NULL, 'column', 'produced_qty', '["qtd_produzida","output"]'::jsonb, 'Quantidade produzida', 1),
(NULL, 'column', 'scrap_qty', '["qtd_sucata","refugos"]'::jsonb, 'Quantidade refugada', 1),
(NULL, 'column', 'rework_qty', '["qtd_retrabalho"]'::jsonb, 'Quantidade retrabalhada', 1),
(NULL, 'column', 'cycle_time_min', '["tempo_ciclo_min","t_ciclo"]'::jsonb, 'Tempo de ciclo (minutos)', 1),
(NULL, 'column', 'setup_time_min', '["tempo_setup_min","t_setup"]'::jsonb, 'Tempo de setup (minutos)', 1),
(NULL, 'column', 'downtime_min', '["parada_min","downtime"]'::jsonb, 'Tempo de parada (minutos)', 1),
(NULL, 'metric', 'oee_pct', '["oee_%"]'::jsonb, 'Overall Equipment Effectiveness', 1),
(NULL, 'metric', 'quality_yield_pct', '["rendimento_qualidade_%","yield_%"]'::jsonb, 'Rendimento de qualidade', 1),
(NULL, 'metric', 'ppm_defects', '["ppm","defeitos_milhao"]'::jsonb, 'Defeitos por milhão (PPM)', 1);

-- ==================== RETAIL / PDV ====================

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
(NULL, 'column', 'store', '["loja","filial","pdv_unidade"]'::jsonb, 'Loja/PDV', 1),
(NULL, 'column', 'pos_terminal', '["pdv","caixa","terminal"]'::jsonb, 'Terminal de caixa', 1),
(NULL, 'column', 'cashier', '["operador_caixa","caixa_operador"]'::jsonb, 'Operador de caixa', 1),
(NULL, 'column', 'transactions_count', '["qtd_transacoes","cupons"]'::jsonb, 'Quantidade de transações', 1),
(NULL, 'column', 'footfall_count', '["fluxo_pessoas","contagem_clientes"]'::jsonb, 'Fluxo de pessoas', 1),
(NULL, 'column', 'queue_time_min', '["tempo_fila_min"]'::jsonb, 'Tempo de fila (minutos)', 1),
(NULL, 'column', 'service_time_min', '["tempo_atendimento_min"]'::jsonb, 'Tempo de atendimento (minutos)', 1),
(NULL, 'metric', 'gmv_value', '["gmv","gross_merchandise_value"]'::jsonb, 'Gross Merchandise Value', 1);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_semantic_dictionary_synonyms ON semantic_dictionary USING gin (synonyms);
CREATE INDEX IF NOT EXISTS idx_semantic_dictionary_canonical ON semantic_dictionary (canonical_name);
CREATE INDEX IF NOT EXISTS idx_semantic_dictionary_entity_type ON semantic_dictionary (entity_type);

-- Verify data
SELECT
  entity_type,
  COUNT(*) as qty,
  COUNT(DISTINCT canonical_name) as unique_entities
FROM semantic_dictionary
GROUP BY entity_type
ORDER BY entity_type;

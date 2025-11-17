-- Seed semantic dictionary with core business terms
-- Using correct entity_type: 'dimension' for columns, 'measure' for metrics

INSERT INTO semantic_dictionary (tenant_id, entity_type, canonical_name, synonyms, description, version) VALUES
-- COMMERCIAL DIMENSIONS
(NULL, 'dimension', 'customer', '["cliente","clientes","cli","sacado","tomador","comprador","destinatario"]'::jsonb, 'Pessoa/empresa que compra/recebe', 1),
(NULL, 'dimension', 'customer_id', '["id_cliente","cod_cliente","codigo_cliente","cnpj_cpf_cliente","doc_cliente"]'::jsonb, 'Identificador do cliente', 1),
(NULL, 'dimension', 'salesperson', '["vendedor","rep","representante","consultor_vendas"]'::jsonb, 'Responsável pela venda', 1),
(NULL, 'dimension', 'product', '["produto","item","mercadoria"]'::jsonb, 'Nome comercial do produto', 1),
(NULL, 'dimension', 'sku', '["sku","cod_produto","codigo_item","ref","referencia","ean","gtin","barra"]'::jsonb, 'Identificador do item', 1),
(NULL, 'dimension', 'brand', '["marca","fabricante"]'::jsonb, 'Marca do produto', 1),
(NULL, 'dimension', 'category', '["categoria","classe_produto","linha_produto"]'::jsonb, 'Categoria principal', 1),
(NULL, 'dimension', 'subcategory', '["subcategoria","familia_produto"]'::jsonb, 'Categoria secundária', 1),
(NULL, 'dimension', 'order', '["pedido","ped","ordem_venda","ov"]'::jsonb, 'Pedido de venda', 1),
(NULL, 'dimension', 'order_id', '["id_pedido","numero_pedido","doc_pedido"]'::jsonb, 'Chave do pedido', 1),
(NULL, 'dimension', 'invoice', '["nota_fiscal","nf","nfe","nf_e"]'::jsonb, 'Documento fiscal', 1),
(NULL, 'dimension', 'invoice_number', '["numero_nota","nr_nf","nr_nfe"]'::jsonb, 'Número da NF', 1),
(NULL, 'dimension', 'channel', '["canal","canal_venda","marketplace","ecommerce","loja_fisica","app"]'::jsonb, 'Origem comercial', 1),
(NULL, 'dimension', 'payment_method', '["meio_pagamento","forma_pagamento","condicao_pagamento","gateway","cartao","pix","boleto"]'::jsonb, 'Método de pagamento', 1),

-- LOGISTICS
(NULL, 'dimension', 'carrier', '["transportadora","parceiro_logistico","operador_logistico"]'::jsonb, 'Transportadora', 1),
(NULL, 'dimension', 'city', '["cidade","municipio"]'::jsonb, 'Cidade', 1),
(NULL, 'dimension', 'state', '["estado","uf","unidade_federativa"]'::jsonb, 'Estado (UF)', 1),
(NULL, 'dimension', 'country', '["pais"]'::jsonb, 'País', 1),
(NULL, 'dimension', 'warehouse', '["armazem","deposito","cd","centro_distribuicao"]'::jsonb, 'Estoque físico', 1),
(NULL, 'dimension', 'branch', '["filial","unidade","loja"]'::jsonb, 'Local físico/comercial', 1),
(NULL, 'dimension', 'order_status', '["status_pedido","situacao_pedido"]'::jsonb, 'Status do pedido', 1),
(NULL, 'dimension', 'shipment_status', '["status_envio","status_entrega"]'::jsonb, 'Status de envio', 1),

-- TIME DIMENSIONS
(NULL, 'dimension', 'order_date', '["data_pedido","dt_pedido","criacao_pedido"]'::jsonb, 'Data do pedido', 1),
(NULL, 'dimension', 'issue_date', '["data_emissao","emissao","dt_emissao"]'::jsonb, 'Data de emissão', 1),
(NULL, 'dimension', 'shipment_date', '["data_despacho","dt_envio","saida_cd"]'::jsonb, 'Data de despacho', 1),
(NULL, 'dimension', 'delivery_date', '["data_entrega","dt_entregue","comprovacao_entrega"]'::jsonb, 'Data de entrega', 1),
(NULL, 'dimension', 'payment_date', '["data_pagamento","dt_pagto","liquidacao"]'::jsonb, 'Data de pagamento', 1),
(NULL, 'dimension', 'month', '["mes","competencia_mes"]'::jsonb, 'Mês', 1),
(NULL, 'dimension', 'year', '["ano","competencia_ano"]'::jsonb, 'Ano', 1),

-- MEASURES (QUANTITIES)
(NULL, 'measure', 'quantity', '["quantidade","qtd","qtde"]'::jsonb, 'Quantidade pedida', 1),
(NULL, 'measure', 'qty_delivered', '["qtd_entregue","entregue","qtde_ent"]'::jsonb, 'Quantidade entregue', 1),
(NULL, 'measure', 'qty_returned', '["qtd_devolvida","devolvido"]'::jsonb, 'Quantidade devolvida', 1),
(NULL, 'measure', 'weight', '["peso","peso_kg"]'::jsonb, 'Peso total (kg)', 1),
(NULL, 'measure', 'volume', '["volume","m3","cubagem"]'::jsonb, 'Volume total', 1),
(NULL, 'measure', 'packages', '["volumes","pacotes","embalagens","colli"]'::jsonb, 'Número de volumes', 1),

-- MEASURES (FINANCIAL)
(NULL, 'measure', 'unit_price', '["preco_unitario","vl_unit","prc_unit"]'::jsonb, 'Preço unitário', 1),
(NULL, 'measure', 'cost', '["custo","custo_unitario","cmv","cpv"]'::jsonb, 'Custo', 1),
(NULL, 'measure', 'revenue', '["receita","faturamento","valor_faturado","vl_total"]'::jsonb, 'Receita bruta', 1),
(NULL, 'measure', 'net_revenue', '["receita_liquida","vl_liquido"]'::jsonb, 'Receita líquida', 1),
(NULL, 'measure', 'discount_value', '["desconto","vl_desconto"]'::jsonb, 'Valor de desconto', 1),
(NULL, 'measure', 'freight_value', '["frete","vl_frete","tarifa"]'::jsonb, 'Valor de frete', 1),
(NULL, 'measure', 'tax_value', '["impostos","tributos","vl_imposto","icms","pis","cofins"]'::jsonb, 'Carga tributária', 1),
(NULL, 'measure', 'total_value', '["valor_total","vl_total_nf","total_nota"]'::jsonb, 'Valor total', 1),
(NULL, 'measure', 'profit', '["lucro","resultado"]'::jsonb, 'Lucro', 1),

-- MEASURES (KPIs / CALCULATED METRICS)
(NULL, 'measure', 'profit_margin_pct', '["margem","margem_percentual","margem_%"]'::jsonb, 'Margem de lucro %', 1),
(NULL, 'measure', 'markup_pct', '["markup","markup_%"]'::jsonb, 'Markup %', 1),
(NULL, 'measure', 'lead_time_days', '["lead_time","tempo_ciclo","tempo_total"]'::jsonb, 'Lead time em dias', 1),
(NULL, 'measure', 'delivery_delay_days', '["atraso_entrega_dias","delay_dias"]'::jsonb, 'Atraso de entrega', 1),
(NULL, 'measure', 'otif_flag', '["otif","otif_ok"]'::jsonb, 'On Time In Full', 1),
(NULL, 'measure', 'otif_rate_pct', '["otif_%","taxa_otif"]'::jsonb, 'Taxa OTIF %', 1),
(NULL, 'measure', 'fill_rate_pct', '["fill_rate","atendimento_pedido_%"]'::jsonb, 'Taxa de atendimento %', 1),
(NULL, 'measure', 'on_time_rate_pct', '["taxa_prazo","on_time_%"]'::jsonb, 'Taxa no prazo %', 1),
(NULL, 'measure', 'returns_rate_pct', '["taxa_devolucao","%devolucao"]'::jsonb, 'Taxa de devolução %', 1),
(NULL, 'measure', 'average_ticket', '["ticket_medio","tm"]'::jsonb, 'Ticket médio', 1),

-- INVENTORY
(NULL, 'measure', 'on_hand_qty', '["qtd_estoque","saldo","on_hand"]'::jsonb, 'Quantidade em estoque', 1),
(NULL, 'measure', 'available_qty', '["qtd_disponivel","disponivel"]'::jsonb, 'Quantidade disponível', 1),
(NULL, 'measure', 'inventory_turnover', '["giro_estoque","turnover"]'::jsonb, 'Giro de estoque', 1),
(NULL, 'measure', 'days_on_hand', '["dias_estoque","doh"]'::jsonb, 'Dias de estoque', 1);

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_semantic_dictionary_synonyms ON semantic_dictionary USING gin (synonyms);
CREATE INDEX IF NOT EXISTS idx_semantic_dictionary_canonical ON semantic_dictionary (canonical_name);
CREATE INDEX IF NOT EXISTS idx_semantic_dictionary_entity_type ON semantic_dictionary (entity_type);

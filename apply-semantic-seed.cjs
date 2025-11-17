#!/usr/bin/env node
/**
 * Apply semantic dictionary seed to Supabase
 * Reads the SQL file and executes it using Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function applySeed() {
  console.log('[Seed] Starting semantic dictionary seed...');

  // Clear existing
  console.log('[Seed] Clearing existing data...');
  const { error: deleteError } = await supabase
    .from('semantic_dictionary')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.warn('[Seed] Error clearing:', deleteError.message);
  }

  // Define all entries
  const entries = [
    // COMMERCIAL
    { entity_type: 'column', canonical_name: 'customer', synonyms: ["cliente","clientes","cli","sacado","tomador","comprador","destinatario"], description: 'Pessoa/empresa que compra/recebe', version: 1 },
    { entity_type: 'column', canonical_name: 'customer_id', synonyms: ["id_cliente","cod_cliente","codigo_cliente","cnpj_cpf_cliente","doc_cliente"], description: 'Identificador do cliente', version: 1 },
    { entity_type: 'column', canonical_name: 'customer_segment', synonyms: ["segmento_cliente","classe_cliente","tipo_cliente","perfil_cliente"], description: 'Segmentação de clientes', version: 1 },
    { entity_type: 'column', canonical_name: 'salesperson', synonyms: ["vendedor","rep","representante","consultor_vendas"], description: 'Responsável pela venda', version: 1 },
    { entity_type: 'column', canonical_name: 'salesperson_id', synonyms: ["id_vendedor","cod_vendedor"], description: 'Identificador do vendedor', version: 1 },
    { entity_type: 'column', canonical_name: 'product', synonyms: ["produto","item","mercadoria"], description: 'Nome comercial do produto', version: 1 },
    { entity_type: 'column', canonical_name: 'sku', synonyms: ["sku","cod_produto","codigo_item","ref","referencia","ean","gtin","barra"], description: 'Identificador do item', version: 1 },
    { entity_type: 'column', canonical_name: 'brand', synonyms: ["marca","fabricante"], description: 'Marca do produto', version: 1 },
    { entity_type: 'column', canonical_name: 'category', synonyms: ["categoria","classe_produto","linha_produto"], description: 'Categoria principal', version: 1 },
    { entity_type: 'column', canonical_name: 'subcategory', synonyms: ["subcategoria","familia_produto"], description: 'Categoria secundária', version: 1 },
    { entity_type: 'column', canonical_name: 'model', synonyms: ["modelo","variante","versao"], description: 'Modelo/variação', version: 1 },
    { entity_type: 'column', canonical_name: 'order', synonyms: ["pedido","ped","ordem_venda","ov"], description: 'Pedido de venda', version: 1 },
    { entity_type: 'column', canonical_name: 'order_id', synonyms: ["id_pedido","numero_pedido","doc_pedido"], description: 'Chave do pedido', version: 1 },
    { entity_type: 'column', canonical_name: 'invoice', synonyms: ["nota_fiscal","nf","nfe","nf_e"], description: 'Documento fiscal', version: 1 },
    { entity_type: 'column', canonical_name: 'invoice_number', synonyms: ["numero_nota","nr_nf","nr_nfe"], description: 'Número da NF', version: 1 },
    { entity_type: 'column', canonical_name: 'channel', synonyms: ["canal","canal_venda","marketplace","ecommerce","loja_fisica","app"], description: 'Origem comercial', version: 1 },

    // LOGISTICS
    { entity_type: 'column', canonical_name: 'carrier', synonyms: ["transportadora","parceiro_logistico","operador_logistico"], description: 'Transportadora', version: 1 },
    { entity_type: 'column', canonical_name: 'city', synonyms: ["cidade","municipio"], description: 'Cidade', version: 1 },
    { entity_type: 'column', canonical_name: 'state', synonyms: ["estado","uf","unidade_federativa"], description: 'Estado (UF)', version: 1 },
    { entity_type: 'column', canonical_name: 'warehouse', synonyms: ["armazem","deposito","cd","centro_distribuicao"], description: 'Estoque físico', version: 1 },
    { entity_type: 'column', canonical_name: 'branch', synonyms: ["filial","unidade","loja","cd"], description: 'Local físico/comercial', version: 1 },

    // TIME
    { entity_type: 'column', canonical_name: 'order_date', synonyms: ["data_pedido","dt_pedido","criacao_pedido"], description: 'Data do pedido', version: 1 },
    { entity_type: 'column', canonical_name: 'issue_date', synonyms: ["data_emissao","emissao","dt_emissao"], description: 'Data de emissão', version: 1 },
    { entity_type: 'column', canonical_name: 'shipment_date', synonyms: ["data_despacho","dt_envio","saida_cd"], description: 'Data de despacho', version: 1 },
    { entity_type: 'column', canonical_name: 'delivery_date', synonyms: ["data_entrega","dt_entregue","comprovacao_entrega"], description: 'Data de entrega', version: 1 },
    { entity_type: 'column', canonical_name: 'payment_date', synonyms: ["data_pagamento","dt_pagto","liquidacao"], description: 'Data de pagamento', version: 1 },

    // QUANTITIES
    { entity_type: 'column', canonical_name: 'quantity', synonyms: ["quantidade","qtd","qtde"], description: 'Quantidade pedida', version: 1 },
    { entity_type: 'column', canonical_name: 'qty_delivered', synonyms: ["qtd_entregue","entregue","qtde_ent"], description: 'Quantidade entregue', version: 1 },
    { entity_type: 'column', canonical_name: 'weight', synonyms: ["peso","peso_kg"], description: 'Peso total (kg)', version: 1 },
    { entity_type: 'column', canonical_name: 'volume', synonyms: ["volume","m3","cubagem"], description: 'Volume total', version: 1 },

    // FINANCIAL
    { entity_type: 'column', canonical_name: 'unit_price', synonyms: ["preco_unitario","vl_unit","prc_unit"], description: 'Preço unitário', version: 1 },
    { entity_type: 'column', canonical_name: 'cost', synonyms: ["custo","custo_unitario","cmv","cpv"], description: 'Custo', version: 1 },
    { entity_type: 'column', canonical_name: 'revenue', synonyms: ["receita","faturamento","valor_faturado","vl_total"], description: 'Receita bruta', version: 1 },
    { entity_type: 'column', canonical_name: 'discount_value', synonyms: ["desconto","vl_desconto"], description: 'Valor de desconto', version: 1 },
    { entity_type: 'column', canonical_name: 'freight_value', synonyms: ["frete","vl_frete","tarifa"], description: 'Valor de frete', version: 1 },
    { entity_type: 'column', canonical_name: 'total_value', synonyms: ["valor_total","vl_total_nf","total_nota"], description: 'Valor total do documento', version: 1 },
    { entity_type: 'column', canonical_name: 'profit', synonyms: ["lucro","resultado"], description: 'Lucro', version: 1 },

    // METRICS
    { entity_type: 'metric', canonical_name: 'profit_margin_pct', synonyms: ["margem","margem_percentual","margem_%"], description: 'Margem de lucro percentual', version: 1 },
    { entity_type: 'metric', canonical_name: 'lead_time_days', synonyms: ["lead_time","tempo_ciclo","tempo_total"], description: 'Lead time em dias', version: 1 },
    { entity_type: 'metric', canonical_name: 'otif_flag', synonyms: ["otif","otif_ok"], description: 'On Time In Full (boolean)', version: 1 },
    { entity_type: 'metric', canonical_name: 'otif_rate_pct', synonyms: ["otif_%"], description: 'Taxa OTIF percentual', version: 1 },
    { entity_type: 'metric', canonical_name: 'fill_rate_pct', synonyms: ["fill_rate","atendimento_pedido_%"], description: 'Taxa de atendimento', version: 1 },
    { entity_type: 'metric', canonical_name: 'on_time_rate_pct', synonyms: ["taxa_prazo","on_time_%"], description: 'Taxa de entregas no prazo', version: 1 },
  ];

  console.log(`[Seed] Inserting ${entries.length} entries...`);

  const { data, error } = await supabase
    .from('semantic_dictionary')
    .insert(entries);

  if (error) {
    console.error('[Seed] Error inserting:', error);
    process.exit(1);
  }

  console.log('[Seed] Successfully inserted entries!');

  // Verify
  const { data: verifyData, error: verifyError } = await supabase
    .from('semantic_dictionary')
    .select('entity_type, canonical_name')
    .limit(10);

  if (verifyError) {
    console.error('[Seed] Error verifying:', verifyError);
  } else {
    console.log('[Seed] Sample of inserted data:');
    console.table(verifyData);
  }

  // Count
  const { count, error: countError } = await supabase
    .from('semantic_dictionary')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`[Seed] Total entries in dictionary: ${count}`);
  }

  console.log('[Seed] Done!');
}

applySeed().catch(console.error);

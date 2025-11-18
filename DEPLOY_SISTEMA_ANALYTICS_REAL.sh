#!/bin/bash

# ===================================================================
# DEPLOY DO SISTEMA DE ANALYTICS 100% FUNCIONAL
# ===================================================================
#
# Este script faz deploy da Edge Function analyze-file com o
# PlaybookExecutor integrado para executar análises REAIS.
#
# Pré-requisitos:
# - Estar logado no Supabase CLI (supabase login)
# - Ter as credenciais corretas configuradas
# ===================================================================

echo "🚀 DEPLOY DO SISTEMA DE ANALYTICS 100% FUNCIONAL"
echo "=================================================="
echo ""

echo "📋 Verificando arquivos modificados..."
echo ""

# Verificar se os arquivos existem
if [ ! -f "supabase/functions/_shared/playbook-executor.ts" ]; then
    echo "❌ ERRO: playbook-executor.ts não encontrado!"
    exit 1
fi

if [ ! -f "supabase/functions/analyze-file/index.ts" ]; then
    echo "❌ ERRO: analyze-file/index.ts não encontrado!"
    exit 1
fi

if [ ! -f "supabase/functions/_shared/narrative-adapter.ts" ]; then
    echo "❌ ERRO: narrative-adapter.ts não encontrado!"
    exit 1
fi

echo "✅ Todos os arquivos encontrados!"
echo ""

echo "🔨 Fazendo build do projeto frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ ERRO: Build falhou!"
    exit 1
fi

echo "✅ Build OK!"
echo ""

echo "📤 Fazendo deploy da Edge Function analyze-file..."
echo ""

npx supabase functions deploy analyze-file

if [ $? -ne 0 ]; then
    echo "❌ ERRO: Deploy falhou!"
    echo ""
    echo "💡 Certifique-se de estar logado:"
    echo "   supabase login"
    echo ""
    echo "💡 Ou configure o token:"
    echo "   export SUPABASE_ACCESS_TOKEN=seu_token_aqui"
    exit 1
fi

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""
echo "=================================================="
echo "🎉 SISTEMA DE ANALYTICS 100% FUNCIONAL DEPLOYED!"
echo "=================================================="
echo ""
echo "📊 O que foi deployado:"
echo "  ✅ playbook-executor.ts (NOVO)"
echo "  ✅ analyze-file/index.ts (atualizado)"
echo "  ✅ narrative-adapter.ts (atualizado)"
echo ""
echo "🧪 Como testar:"
echo "  1. Acesse o sistema no navegador"
echo "  2. Faça upload do arquivo estoque_inventario_ficticio_500_linhas.xlsx"
echo "  3. No modo Analytics, envie qualquer pergunta"
echo "  4. Aguarde a análise REAL (não mais mock!)"
echo "  5. Veja os insights com dados reais do Excel"
echo ""
echo "📝 Log esperado:"
echo "  [PlaybookExecutor] Executing playbook: pb_estoque_divergencias_v1"
echo "  [PlaybookExecutor] Computing metric: qtd_esperada"
echo "  [PlaybookExecutor] Computing metric: divergencia"
echo "  [PlaybookExecutor] Computing metric: div_abs"
echo "  [PlaybookExecutor] Computing metric: taxa_div"
echo "  [PlaybookExecutor] Execution complete in Xms"
echo ""
echo "🎯 Resultado:"
echo "  Narrativa com métricas REAIS calculadas:"
echo "  - Divergência média: valor real"
echo "  - Divergência por categoria: valores reais"
echo "  - Divergência por localização: valores reais"
echo ""
echo "=================================================="

#!/bin/bash

# 🚀 Script de Deploy do Sistema Kanban Avançado
# Execute este script após aplicar a migração SQL no Supabase Dashboard

echo "=================================================="
echo "🚀 Deploy do Sistema Kanban Avançado"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: Execute este script no diretório raiz do projeto${NC}"
    exit 1
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Erro: Arquivo .env não encontrado${NC}"
    exit 1
fi

echo "📋 Checklist de Deploy:"
echo ""
echo "[ ] 1. Migração SQL aplicada no Supabase Dashboard"
echo "[ ] 2. Edge Function será deployada agora"
echo "[ ] 3. OpenAI API Key será configurada (se necessário)"
echo ""
read -p "Você já aplicou a migração SQL no Dashboard? (s/N): " confirm

if [[ ! $confirm =~ ^[Ss]$ ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  ATENÇÃO: Você precisa aplicar a migração primeiro!${NC}"
    echo ""
    echo "Passos:"
    echo "1. Acesse https://supabase.com/dashboard"
    echo "2. Vá em SQL Editor → New Query"
    echo "3. Copie o conteúdo de: supabase/migrations/20251105000000_expand_kanban_system.sql"
    echo "4. Cole no editor e clique em Run"
    echo "5. Execute este script novamente"
    echo ""
    exit 1
fi

echo ""
echo "1️⃣  Fazendo deploy da Edge Function agente-execucao..."
echo ""

# Deploy da função
npx supabase functions deploy agente-execucao

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao fazer deploy da função${NC}"
    echo "Tente manualmente: npx supabase functions deploy agente-execucao"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Edge function deployada com sucesso!${NC}"
echo ""

# Verificar se OPENAI_API_KEY está configurada
read -p "Você já configurou a OPENAI_API_KEY? (s/N): " has_key

if [[ ! $has_key =~ ^[Ss]$ ]]; then
    echo ""
    read -p "Digite sua OpenAI API Key (ou deixe em branco para configurar depois): " openai_key

    if [ ! -z "$openai_key" ]; then
        echo ""
        echo "2️⃣  Configurando OPENAI_API_KEY..."
        npx supabase secrets set OPENAI_API_KEY="$openai_key"

        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Erro ao configurar API Key${NC}"
            echo "Configure manualmente: npx supabase secrets set OPENAI_API_KEY=sua-chave"
        else
            echo -e "${GREEN}✅ API Key configurada!${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Lembre-se de configurar depois:${NC}"
        echo "   npx supabase secrets set OPENAI_API_KEY=sua-chave"
    fi
fi

echo ""
echo "3️⃣  Verificando deployment..."
echo ""

# Executar script de verificação
node verify-kanban-deployment.cjs

echo ""
echo "=================================================="
echo "🎉 Deploy Concluído!"
echo "=================================================="
echo ""
echo "📖 Próximos Passos:"
echo ""
echo "1. Acesse seu aplicativo"
echo "2. Vá no chat do consultor"
echo "3. Clique na aba 'Kanban'"
echo "4. Clique em 'Abrir Gestão de Projetos'"
echo "5. Explore todas as funcionalidades!"
echo ""
echo "📚 Documentação completa: DEPLOY_KANBAN_SYSTEM.md"
echo ""

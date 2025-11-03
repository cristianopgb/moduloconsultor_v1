#!/bin/bash

# ============================================================================
# DEPLOY DAS CORREÇÕES DO SISTEMA CONSULTOR RAG
# Data: 03/11/2025
# Versão: 2.1
# ============================================================================

set -e  # Exit on error

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 DEPLOY DAS CORREÇÕES - SISTEMA CONSULTOR RAG          ║"
echo "║  Versão 2.1 - 03/11/2025                                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções helper
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    error "Execute este script na raiz do projeto!"
    exit 1
fi

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    error "Supabase CLI não encontrado!"
    echo ""
    info "Instale com: npm install -g supabase"
    exit 1
fi

success "Supabase CLI encontrado"

# ============================================================================
# ETAPA 1: BACKUP (Segurança)
# ============================================================================

echo ""
info "Etapa 1/5: Criando backup..."

# Fazer backup da função atual (se existir)
BACKUP_DIR="backups/pre_fix_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "supabase/functions/consultor-rag" ]; then
    cp -r supabase/functions/consultor-rag "$BACKUP_DIR/"
    success "Backup da função criado em: $BACKUP_DIR"
else
    warning "Função consultor-rag não encontrada (pode ser primeira instalação)"
fi

# ============================================================================
# ETAPA 2: APLICAR MIGRAÇÃO
# ============================================================================

echo ""
info "Etapa 2/5: Aplicando migração do banco de dados..."

if [ -f "supabase/migrations/20251103000000_fix_consultor_rag_issues.sql" ]; then
    echo ""
    info "Migração encontrada: 20251103000000_fix_consultor_rag_issues.sql"
    echo ""
    warning "Esta migração vai:"
    echo "  • Adicionar/corrigir colunas em consultor_sessoes"
    echo "  • Adicionar/corrigir colunas em entregaveis_consultor"
    echo "  • Adicionar/corrigir colunas em timeline_consultor"
    echo "  • Fazer backfill de dados antigos"
    echo "  • Criar triggers automáticos"
    echo "  • Criar views de debug"
    echo ""
    read -p "Continuar com a migração? (s/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Ss]$ ]]; then
        if supabase db push; then
            success "Migração aplicada com sucesso!"
        else
            error "Falha ao aplicar migração"
            echo ""
            warning "Você pode aplicar manualmente:"
            echo "  1. Acesse: https://supabase.com/dashboard"
            echo "  2. Vá em: SQL Editor → New Query"
            echo "  3. Copie o conteúdo de: supabase/migrations/20251103000000_fix_consultor_rag_issues.sql"
            echo "  4. Cole e execute"
            exit 1
        fi
    else
        warning "Migração cancelada pelo usuário"
        echo ""
        info "Para aplicar manualmente:"
        echo "  supabase db push"
        exit 0
    fi
else
    error "Arquivo de migração não encontrado!"
    echo "Esperado: supabase/migrations/20251103000000_fix_consultor_rag_issues.sql"
    exit 1
fi

# ============================================================================
# ETAPA 3: DEPLOY DA EDGE FUNCTION
# ============================================================================

echo ""
info "Etapa 3/5: Fazendo deploy da Edge Function..."

if [ -d "supabase/functions/consultor-rag" ]; then
    echo ""
    info "Função encontrada: consultor-rag"
    echo ""
    info "Esta versão inclui correções para:"
    echo "  • Loop após priorização (aguardando_validacao)"
    echo "  • Entregáveis invisíveis (jornada_id + tipo)"
    echo "  • Parser mais robusto"
    echo "  • Logs melhorados"
    echo ""

    if supabase functions deploy consultor-rag; then
        success "Edge function deployada com sucesso!"
    else
        error "Falha ao deployar edge function"
        exit 1
    fi
else
    error "Diretório supabase/functions/consultor-rag não encontrado!"
    exit 1
fi

# ============================================================================
# ETAPA 4: VALIDAÇÃO
# ============================================================================

echo ""
info "Etapa 4/5: Executando testes de validação..."

if [ -f "test-correcoes-consultor.cjs" ]; then
    echo ""
    if node test-correcoes-consultor.cjs; then
        success "Todos os testes passaram!"
    else
        warning "Alguns testes falharam, mas deploy foi concluído"
        echo ""
        info "Verifique os erros acima e corrija manualmente se necessário"
    fi
else
    warning "Script de teste não encontrado (test-correcoes-consultor.cjs)"
    echo ""
    info "Validação manual recomendada:"
    echo "  • Verifique schema das tabelas no SQL Editor"
    echo "  • Teste uma jornada completa no frontend"
fi

# ============================================================================
# ETAPA 5: INSTRUÇÕES FINAIS
# ============================================================================

echo ""
success "Deploy concluído!"
echo ""
info "Etapa 5/5: Próximos passos..."
echo ""
echo "📋 VALIDAÇÃO PÓS-DEPLOY:"
echo ""
echo "1️⃣  Verificar logs da função:"
echo "   supabase functions logs consultor-rag --tail"
echo ""
echo "2️⃣  Testar fluxo completo:"
echo "   • Acesse o frontend"
echo "   • Inicie nova jornada"
echo "   • Complete anamnese → mapeamento → priorização"
echo "   • Aprove o escopo (diga 'sim' ou 'bora')"
echo "   • Verifique que NÃO ENTRA EM LOOP"
echo "   • Verifique que entregáveis aparecem"
echo "   • Verifique que timeline atualiza"
echo ""
echo "3️⃣  Verificar dados no banco:"
echo "   SELECT * FROM v_entregaveis_debug LIMIT 5;"
echo "   SELECT * FROM v_timeline_debug LIMIT 5;"
echo ""
echo "4️⃣  Monitorar por 24-48h:"
echo "   • Ver erros no Dashboard: Logs → Edge Functions"
echo "   • Coletar feedback de usuários"
echo ""
echo "📚 DOCUMENTAÇÃO:"
echo ""
echo "  • Técnica: CORRECOES_SISTEMA_CONSULTOR_RAG_03NOV2025.md"
echo "  • Resumo: PLANO_CORRECAO_EXECUTADO.md"
echo "  • Arquivamento: supabase/functions_archive/pre_rag_fix_20251103/"
echo ""
echo "🆘 ROLLBACK (se necessário):"
echo ""
echo "  cd $BACKUP_DIR"
echo "  supabase functions deploy consultor-rag"
echo ""
success "Sistema Consultor RAG v2.1 está no ar! 🎉"
echo ""

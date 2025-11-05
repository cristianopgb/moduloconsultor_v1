# ⚡ Deploy Rápido - Sistema Kanban Avançado

## 🎯 O que você precisa fazer AGORA:

### Passo 1: Aplicar Migração do Banco (OBRIGATÓRIO)

**Via Supabase Dashboard:**
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Clique em **New Query**
5. Abra o arquivo: `supabase/migrations/20251105000000_expand_kanban_system.sql`
6. Copie TODO o conteúdo
7. Cole no editor SQL do Supabase
8. Clique em **Run** (Ctrl+Enter)
9. ✅ Aguarde confirmação de sucesso

### Passo 2: Deploy da Edge Function (OBRIGATÓRIO)

```bash
# No terminal, dentro do projeto:
cd /tmp/cc-agent/59063573/project

# Deploy da função
npx supabase functions deploy agente-execucao

# Configure a chave da OpenAI (se ainda não configurada)
npx supabase secrets set OPENAI_API_KEY=sua-chave-aqui
```

### Passo 3: Verificar se Deu Certo

```bash
# Execute o script de verificação
node verify-kanban-deployment.cjs
```

Se o script mostrar ✅ em tudo, está pronto para usar!

## 📝 Resumo do que foi implementado:

### Na Aba Kanban (Painel Lateral)
- ✅ Mini-dashboard com KPIs em tempo real
- ✅ Botão destacado "Abrir Gestão de Projetos"
- ✅ Métricas: total, concluídas, em andamento, pendentes, bloqueadas, atrasadas
- ✅ Distribuição por responsável

### Página Dedicada de Projetos (Nova)
**Acesso:** Clique no botão "Abrir Gestão de Projetos" na aba Kanban

#### Chat Executor (Lateral Esquerda)
- ✅ Conversa com IA para gerenciar ações
- ✅ Upload de documentos (PDF, Excel, Word, imagens)
- ✅ Atualização automática de status via conversa
- ✅ Contexto completo do projeto

#### Kanban Avançado (Centro)
- ✅ Drag-and-drop entre colunas
- ✅ 4 status: A Fazer, Em Andamento, Bloqueado, Concluído
- ✅ Cards editáveis com modal completo
- ✅ Framework 5W2H integrado
- ✅ Tags, prioridades, progresso visual
- ✅ Indicador de ações atrasadas

#### Calendário (Centro - Alternativa)
- ✅ Visualização mensal com código de cores
- ✅ 🔴 Vermelho = ações atrasadas
- ✅ 🟢 Verde = ações concluídas
- ✅ 🔵 Azul = ações pendentes
- ✅ Modal com detalhes ao clicar no dia
- ✅ Atualização rápida de status

#### Dashboard KPIs (Lateral Direita)
- ✅ Métricas em tempo real
- ✅ Taxa de conclusão com barra visual
- ✅ Distribuição por responsável
- ✅ Distribuição por processo/área
- ✅ Alertas de bloqueios e atrasos

## 🚀 Testar Funcionalidades:

1. **Mini-Dashboard:**
   - Vá no chat consultor → aba Kanban
   - Veja as métricas atualizando

2. **Página Completa:**
   - Clique em "Abrir Gestão de Projetos"
   - Explore os 3 painéis

3. **Kanban:**
   - Crie uma nova ação (botão + Nova Ação)
   - Arraste entre colunas
   - Edite uma ação (ícone de lápis)

4. **Chat Executor:**
   - Digite: "Como está o projeto?"
   - Teste: "Concluí a ação [nome]"
   - Anexe um arquivo

5. **Calendário:**
   - Mude para visualização calendário
   - Clique em um dia com ações
   - Atualize o status

## ❓ Problemas Comuns:

### "relation does not exist"
→ A migração não foi aplicada. Execute o Passo 1 novamente.

### Edge function retorna 404
→ A função não foi deployada. Execute o Passo 2 novamente.

### "OPENAI_API_KEY not configured"
→ Configure a chave: `npx supabase secrets set OPENAI_API_KEY=sua-chave`

## 📞 Suporte:

Consulte `DEPLOY_KANBAN_SYSTEM.md` para instruções detalhadas.

---

**Tempo estimado:** 5-10 minutos
**Dificuldade:** Fácil (copiar/colar e executar comandos)

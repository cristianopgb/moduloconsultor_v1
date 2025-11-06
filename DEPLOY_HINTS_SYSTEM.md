# Deploy: Sistema de Base Semântica de Situações (Proceda Hints)

## Resumo

Sistema que injeta recomendações cirúrgicas contextualizadas no prompt do consultor, eliminando ações genéricas e superficiais.

**Benefícios:**
- Ações específicas e executáveis (7-10 etapas práticas)
- Recomendações baseadas em situações reais mapeadas
- Zero risco de quebra (integração não-invasiva)
- Telemetria para evolução data-driven

---

## Passo 1: Aplicar Migration

```bash
# Conectar ao Supabase (se ainda não estiver conectado)
npx supabase link --project-ref YOUR_PROJECT_REF

# Aplicar migration da estrutura
npx supabase db push

# Ou via SQL direto no Supabase Studio:
# Copiar conteúdo de: supabase/migrations/20251106000000_create_proceda_hints_system.sql
# Colar no SQL Editor e executar
```

**O que cria:**
- Tabela `proceda_hints` (base de situações)
- Tabela `proceda_hints_telemetry` (tracking de uso)
- Índices para performance (full-text search, GIN, scoring)
- RLS policies (users read-only, masters full access)
- View analítica `proceda_hints_analytics`

---

## Passo 2: Seed da Base Inicial

```bash
# Opção 1: Via psql
psql "YOUR_DATABASE_URL" < supabase/seed-proceda-hints.sql

# Opção 2: Via Supabase Studio SQL Editor
# Copiar conteúdo de: supabase/seed-proceda-hints.sql
# Colar no SQL Editor e executar
```

**O que carrega:**
- 20 situações validadas com recomendações cirúrgicas
- Cobertura: E-commerce, SaaS, Serviços, Varejo, Indústria
- Dominios: Marketing, Vendas, Operações, Financeiro, RH, TI, Qualidade

---

## Passo 3: Deploy da Edge Function Atualizada

```bash
# Deploy consultor-rag com novo hints-engine.ts
npx supabase functions deploy consultor-rag

# Verificar deploy
npx supabase functions list
```

**Arquivos modificados:**
- `supabase/functions/consultor-rag/index.ts` (integração dos hints)
- `supabase/functions/consultor-rag/hints-engine.ts` (motor de busca - NOVO)
- `supabase/functions/consultor-rag/consultor-prompts.ts` (regras antigenéricas)

---

## Passo 4: Validação

### 4.1. Verificar Tabelas

```sql
-- Verificar que tabelas foram criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'proceda_hints%';

-- Verificar seed (deve ter ~20 hints)
SELECT COUNT(*) as total_hints, COUNT(*) FILTER (WHERE ativo = true) as ativos
FROM proceda_hints;

-- Verificar um hint de exemplo
SELECT title, segmentos, dominios, prioridade
FROM proceda_hints
WHERE title ILIKE '%e-commerce%'
LIMIT 1;
```

### 4.2. Testar Busca Semântica

```sql
-- Simular busca para e-commerce sem tráfego pago
SELECT
  title,
  segmentos,
  dominios,
  prioridade,
  LEFT(recommendations, 100) as preview
FROM proceda_hints
WHERE ativo = true
AND (
  segmentos && ARRAY['ecommerce', 'varejo_online']::text[]
  OR scenario ILIKE '%sem tráfego pago%'
)
ORDER BY prioridade DESC, uso_count DESC
LIMIT 3;
```

### 4.3. Criar Sessão de Teste

```bash
# Via frontend: criar nova conversa em modo Consultor
# Informar segmento: "e-commerce"
# Dor: "preciso vender mais, não tenho tráfego pago"

# Verificar logs da Edge Function
npx supabase functions logs consultor-rag --tail
```

**Logs esperados:**
```
[CONSULTOR] A/B Group: control max hints: 3
[HINTS] Search context: { segmentos: ['ecommerce', 'varejo_online'], dominios: ['marketing', 'vendas'], ... }
[HINTS] Found hints: { total: 5, scored: 5, returning: 3, ... }
[CONSULTOR] Found 3 relevant hints
```

---

## Passo 5: Monitoramento

### 5.1. Dashboard Analítico

```sql
-- Ver efetividade dos hints
SELECT *
FROM proceda_hints_analytics
WHERE uso_count > 0
ORDER BY aceite_rate DESC, uso_count DESC
LIMIT 10;
```

### 5.2. Telemetria A/B

```sql
-- Comparar grupos A/B (após 1 semana)
SELECT
  grupo_ab,
  COUNT(*) as total_usos,
  COUNT(*) FILTER (WHERE usado_em_acao = true) as usado_em_acoes,
  COUNT(*) FILTER (WHERE acao_aceita = true) as acoes_aceitas,
  ROUND(AVG(score_busca), 2) as avg_score
FROM proceda_hints_telemetry
WHERE created_at > now() - interval '7 days'
GROUP BY grupo_ab;
```

### 5.3. Hints Mais Efetivos

```sql
-- Top 10 hints com melhor taxa de aceitação
SELECT
  h.title,
  h.segmentos,
  h.uso_count,
  h.aceite_count,
  h.aceite_rate,
  h.ultima_utilizacao
FROM proceda_hints h
WHERE h.uso_count >= 5
ORDER BY h.aceite_rate DESC, h.uso_count DESC
LIMIT 10;
```

---

## Controles de Qualidade

### Máximo 3 Hints por Consulta
✅ Implementado via `maxResults = 3` e grupo A/B

### Bloco Compacto (5 linhas)
✅ Implementado via `formatHintsForPrompt()` - pega apenas 2 recommendations por hint

### Linguagem Proibida
✅ Adicionado no BASE_PERSONA e EXECUCAO_PROMPT:
- PROIBIDO: "melhorar processos", "treinar equipe", "contratar sistema"
- OBRIGATÓRIO: 7-10 etapas práticas, ferramentas nomeadas, KPIs

### Cache por Sessão
✅ Implementado - hints são cacheados por 30min se contexto não mudar

### Telemetria Automática
✅ Log em `proceda_hints_telemetry` a cada uso
✅ Atualização de `uso_count` e `aceite_count` via trigger

---

## Expansão da Base

### Adicionar Novos Hints (via SQL)

```sql
INSERT INTO proceda_hints (
  title,
  segmentos,
  dominios,
  scenario,
  recommendations,
  prioridade,
  tags
) VALUES (
  'Título da situação',
  ARRAY['saas', 'tecnologia'],
  ARRAY['vendas', 'marketing'],
  'descrição rica em sinônimos da situação: palavras-chave, linguagem do usuário, cenário real...',
  'Bullet 1 específico | Bullet 2 específico | Bullet 3 específico',
  8,
  ARRAY['tag1', 'tag2']
);
```

### Checklist de Qualidade

Antes de adicionar hint, validar:

- [ ] **Scenario**: 5+ sinônimos e linguagem natural do usuário
- [ ] **Recommendations**: 3-5 bullets específicos (não genéricos)
- [ ] **Segmentos**: vocabulário controlado (ecommerce, saas, servicos, etc)
- [ ] **Dominios**: categorias corretas (marketing, vendas, operacoes, etc)
- [ ] **Prioridade**: 1-10 justificada (frequência + impacto)

### Deprecar Hints Ruins

```sql
-- Desativar hint com baixa efetividade
UPDATE proceda_hints
SET
  ativo = false,
  notas = 'Desativado em 2025-11-06: aceite_rate < 30%'
WHERE id = 'hint-id-aqui';
```

---

## Troubleshooting

### Hints Não Aparecem no Prompt

**Sintomas:** Edge function não loga "[HINTS] Found hints"

**Checklist:**
1. Verificar que migration foi aplicada: `SELECT COUNT(*) FROM proceda_hints WHERE ativo = true`
2. Verificar que seed foi executado: deve ter ~20 hints
3. Verificar que sessão tem `setor` preenchido ou `contexto.anamnese.segmento`
4. Verificar logs: `npx supabase functions logs consultor-rag --tail`

### LLM Ainda Gera Ações Genéricas

**Sintomas:** Ações tipo "melhorar processos", "treinar equipe" no 5W2H

**Soluções:**
1. Verificar que `consultor-prompts.ts` foi atualizado com regras antigenéricas
2. Verificar que hints estão sendo injetados no `kbContext`
3. Adicionar mais exemplos CORRETOS no seed de hints
4. Aumentar prioridade dos hints mais específicos

### Score de Busca Baixo

**Sintomas:** Hints retornados têm score < 40

**Otimizações:**
1. Enriquecer campo `scenario` com mais sinônimos
2. Ajustar normalização de segmentos em `hints-engine.ts`
3. Adicionar mais dominios detectados na função `detectDominios()`
4. Revisar pesos do scoring (texto 50%, segmento 30%, dominio 20%)

---

## Rollback (Se Necessário)

```sql
-- Desativar hints temporariamente
UPDATE proceda_hints SET ativo = false;

-- Ou via env var (requer redeploy):
-- Adicionar ENABLE_HINTS=false no Supabase Dashboard > Edge Functions > Environment Variables
```

**Nota:** Sistema degrada gracefully - se busca falhar, continua sem hints normalmente.

---

## Métricas de Sucesso (Após 2 Semanas)

- [ ] 80%+ das ações têm 7+ etapas no HOW
- [ ] 60%+ dos hints usados resultam em ações aceitas
- [ ] Latência adicional < 150ms (média)
- [ ] Zero quebras de fluxo por falha na busca
- [ ] 15+ hints com uso_count > 5

---

## Próximos Passos

1. **Semana 1-2:** Monitorar telemetria e ajustar hints ruins
2. **Semana 3:** Adicionar 10-15 hints novos baseados em casos reais
3. **Mês 2:** Criar interface admin para masters adicionarem hints via UI
4. **Mês 3:** Implementar embeddings para busca semântica avançada (pgvector)

---

**Status:** ✅ Sistema pronto para deploy
**Risco:** 🟢 Baixíssimo (integração não-invasiva, fail gracefully)
**Impacto:** 🟢 Alto (elimina ações genéricas, aumenta valor percebido)

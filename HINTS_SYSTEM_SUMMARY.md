# Sistema de Base Semântica de Situações - Resumo Executivo

## Problema Resolvido

**Antes:** Ações genéricas e superficiais tipo "melhorar processos", "treinar equipe", "contratar sistema" - usuário não precisa de consultor IA para ouvir obviedades.

**Depois:** Ações cirúrgicas com 7-10 etapas práticas, ferramentas nomeadas, KPIs mensuráveis e passo a passo executável.

---

## Como Funciona

### 1. Base de Conhecimento (`proceda_hints`)

Tabela com situações comuns mapeadas:
- **Situação**: E-commerce sem tráfego pago
- **Recomendações**: Estruturar campanhas Google Ads + Meta Ads | Criar funil com landing pages | Implementar remarketing
- **Contexto semântico**: "e-commerce, loja online, sem ads, só orgânico, baixo tráfego..."

**Seed inicial:** 20 situações validadas cobrindo E-commerce, SaaS, Serviços, Varejo, Indústria.

### 2. Motor de Busca Inteligente (`hints-engine.ts`)

**Scoring multi-critério:**
- 50% relevância textual (full-text search no scenario)
- 30% match de segmento (ecommerce, saas, varejo, etc)
- 20% match de domínio com dor (marketing, vendas, operações)
- Bonus: prioridade do hint + histórico de efetividade

**Resultado:** Top 3 hints mais relevantes (máximo 5 linhas no prompt)

### 3. Integração Não-Invasiva

**Ponto de inserção:** Logo após buscar `adapters_setor` e antes de montar `systemPrompt`

```typescript
// Linha 171-236 em consultor-rag/index.ts
const hints = await searchRelevantHints(supabase, sessaoId, context, 3);
const hintsBlock = formatHintsForPrompt(hints);
kbContext += hintsBlock; // Injeta no prompt
```

**Vantagens:**
- Não altera FSM (PHASE_FLOW, transições, actions)
- Não modifica parser JSON
- Fail gracefully (se busca falhar, continua normalmente)
- Cache por sessão (evita buscas repetidas)

### 4. Executor LLM Usa Hints Como Bússola

**Fluxo:**
1. LLM recebe no prompt: "SUGESTÕES RELEVANTES: • Estruturar campanhas de mídia paga..."
2. LLM transforma em 5W2H detalhado com 7-10 etapas práticas
3. Usuário recebe ação executável (nunca vê hint bruto)

**Exemplo:**

**Hint (curto):** "Estruturar campanhas de mídia paga"

**5W2H gerado pelo LLM:**
- **What**: Implementar campanhas Google Ads + Meta Ads com tracking completo
- **How** (10 etapas):
  1. Definir orçamento de teste (R$ 3k/mês)
  2. Criar personas detalhadas
  3. Desenvolver 5 criativos por canal
  4. Configurar Google Analytics 4 + Tag Manager
  5. Criar campanhas A/B
  6. Monitorar CTR, CPC, ROAS diariamente
  7. Otimizar lances semanalmente
  8. Escalar campanhas vencedoras após 21 dias
  9. Implementar remarketing
  10. Gerar relatório semanal

### 5. Linguagem Proibida (Antigenérica)

**Adicionado no BASE_PERSONA:**

```
7. LINGUAGEM PROIBIDA (ANTIGENÉRICA) 🔴
   → PROIBIDO: "Melhorar processos", "Treinar equipe", "Contratar sistema"
   → OBRIGATÓRIO: 7-10 etapas práticas, ferramentas nomeadas, KPIs
```

**Executor LLM é forçado a detalhar ou reformular.**

### 6. Telemetria e Evolução

**Tracking automático:**
- Cada uso de hint é logado em `proceda_hints_telemetry`
- Campos: hint_id, sessao_id, fase, usado_em_acao, acao_aceita
- Triggers atualizam `uso_count` e `aceite_rate` automaticamente

**Análise:**
```sql
SELECT * FROM proceda_hints_analytics
WHERE uso_count > 0
ORDER BY aceite_rate DESC;
```

**Governança:**
- Hints com aceite_rate < 30% → deprecar
- Hints com aceite_rate > 70% → priorizar e criar variações

### 7. Teste A/B Silencioso

**Distribuição:**
- 80% recebe 3 hints (control)
- 10% recebe 1 hint (test_1_hint)
- 10% recebe 2 hints (test_2_hints)

**Objetivo:** Otimizar quantidade ideal sem afetar usuários

---

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`supabase/migrations/20251106000000_create_proceda_hints_system.sql`**
   - Tabelas: proceda_hints, proceda_hints_telemetry
   - Índices, RLS, triggers, view analítica

2. **`supabase/seed-proceda-hints.sql`**
   - 20 situações validadas
   - Seed inicial da base

3. **`supabase/functions/consultor-rag/hints-engine.ts`**
   - Motor de busca semântica
   - Score inteligente
   - Cache por sessão
   - Telemetria

4. **`DEPLOY_HINTS_SYSTEM.md`**
   - Instruções completas de deploy
   - Validação e troubleshooting

### Arquivos Modificados

1. **`supabase/functions/consultor-rag/index.ts`**
   - Import do hints-engine
   - Integração na linha 171-236
   - Log de telemetria

2. **`supabase/functions/consultor-rag/consultor-prompts.ts`**
   - Adicionada regra 7: LINGUAGEM PROIBIDA
   - Reforçado no EXECUCAO_PROMPT
   - Exemplos corretos vs incorretos

---

## Controles de Qualidade Implementados

✅ **Máximo 3 hints por consulta** (evita prompt inundado)
✅ **Bloco compacto de 5 linhas** (mantém foco do LLM)
✅ **Score inteligente** (relevância + segmento + domínio)
✅ **Cache de 30min por sessão** (reduz custo)
✅ **Telemetria automática** (evolução data-driven)
✅ **Fail gracefully** (busca falha → continua normal)
✅ **Teste A/B silencioso** (otimiza sem afetar users)
✅ **Linguagem proibida explícita** (força qualidade)

---

## Métricas de Sucesso

**Após 2 semanas de uso:**

- [ ] 80%+ das ações têm 7+ etapas no HOW
- [ ] 60%+ dos hints usados resultam em ações aceitas
- [ ] Latência adicional < 150ms
- [ ] Zero quebras de fluxo
- [ ] 15+ hints com uso_count > 5

**KPIs de longo prazo:**

- Taxa de satisfação do usuário com planos gerados
- NPS específico do módulo Consultor
- Redução de questionamentos tipo "mas como fazer isso?"
- Aumento do engagement (usuários completam jornada)

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| LLM ignora hints | Baixa | Médio | Instrução reforçada no prompt |
| Hints genéricos poluem base | Média | Médio | Checklist de qualidade + revisão semanal |
| Latência > 200ms | Baixa | Baixo | Índices otimizados + cache |
| Busca falha | Baixa | Baixo | Try-catch, fail gracefully |
| Hints não relevantes | Média | Médio | Telemetria identifica + deprecação |

**Risco Geral:** 🟢 Muito Baixo

---

## Roadmap de Expansão

### Curto Prazo (Semana 1-4)

1. **Monitoramento:** Revisar telemetria semanalmente
2. **Ajustes:** Deprecar hints com aceite_rate < 30%
3. **Expansão:** Adicionar 10-15 hints novos baseados em casos reais
4. **Otimização:** Ajustar scoring se necessário

### Médio Prazo (Mês 2-3)

1. **Interface Admin:** Masters adicionam hints via UI
2. **Categorização:** Tags e filtros por indústria/maturidade
3. **Versionamento:** Histórico de mudanças nos hints
4. **Insights:** Dashboard de efetividade por segmento

### Longo Prazo (Mês 4+)

1. **Embeddings:** Busca semântica avançada com pgvector
2. **Personalização:** Hints dinâmicos por perfil de usuário
3. **Crowdsourcing:** Masters propõem hints (workflow de aprovação)
4. **Machine Learning:** Score preditivo de efetividade

---

## Decisão: Implementar?

**Benefício vs Risco:** ⭐⭐⭐⭐⭐ (Muito Alto / Muito Baixo)

**Pontos Fortes:**
- ✅ Resolve problema real (ações genéricas)
- ✅ Integração não-invasiva (não quebra nada)
- ✅ Governança desde dia 1 (telemetria)
- ✅ Escalável (adicionar hints é trivial)
- ✅ Fail-safe (degradação graciosa)

**Pontos de Atenção:**
- ⚠️ Requer curadoria da base (revisão semanal)
- ⚠️ Qualidade depende dos hints seed (20 iniciais são validados)
- ⚠️ LLM pode ainda gerar ações genéricas (mitigado com linguagem proibida)

**Recomendação:** ✅ **IMPLEMENTAR AGORA**

---

## Deploy Rápido (3 Passos)

```bash
# 1. Aplicar migration
npx supabase db push

# 2. Executar seed
psql "YOUR_DB_URL" < supabase/seed-proceda-hints.sql

# 3. Deploy Edge Function
npx supabase functions deploy consultor-rag

# ✅ Pronto! Sistema ativo em produção
```

**Tempo estimado:** 15-20 minutos

**Rollback:** Instantâneo (desativar hints via SQL ou env var)

---

**Documentação completa:** `DEPLOY_HINTS_SYSTEM.md`

**Contato:** Para dúvidas ou ajustes, revisar `hints-engine.ts` e `consultor-prompts.ts`

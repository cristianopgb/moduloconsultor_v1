# Deploy Guide - Hints System Fix

**Versão:** 1.0
**Data:** 08/11/2025

## Resumo das Mudanças

Este deploy corrige completamente o sistema de hints que estava:
- ❌ Buscando hints mas não usando
- ❌ Telemetria inflada (contava buscas, não uso real)
- ❌ Contexto de busca incompleto
- ❌ Sem threshold de confiança
- ❌ Sem logs de debug

Agora está:
- ✅ Pipeline completo funcionando
- ✅ Telemetria precisa (só conta uso real)
- ✅ Contexto enriquecido de múltiplas fontes
- ✅ Threshold de confiança (evita hints ruins)
- ✅ Logs de auditoria completos

---

## Passo a Passo do Deploy

### 1. Aplicar Migração do Banco de Dados

**Opção A: Via Supabase CLI (recomendado)**
```bash
cd /tmp/cc-agent/59063573/project
supabase db push
```

**Opção B: Via Dashboard do Supabase**
1. Abrir https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copiar conteúdo de `supabase/migrations/20251108000001_fix_hints_telemetry_trigger.sql`
3. Colar e executar

**Verificação:**
```sql
-- Deve mostrar a nova função com IF usado_em_acao = true
SELECT prosrc FROM pg_proc WHERE proname = 'update_hint_telemetry_stats';
```

---

### 2. Popular Catálogo de Hints

**No SQL Editor do Supabase:**
1. Abrir https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copiar conteúdo de `supabase/seed-test-hints.sql`
3. Colar e executar

**Verificação:**
```sql
-- Deve retornar 12 hints de teste
SELECT COUNT(*) FROM proceda_hints WHERE tags @> ARRAY['teste'];

-- Deve mostrar cobertura de segmentos e domínios
SELECT
  array_agg(DISTINCT s) as segmentos,
  array_agg(DISTINCT d) as dominios
FROM proceda_hints, unnest(segmentos) s, unnest(dominios) d
WHERE tags @> ARRAY['teste'];
```

---

### 3. Deploy da Edge Function Atualizada

**Via Supabase CLI:**
```bash
cd /tmp/cc-agent/59063573/project

# Deploy da função consultor-rag (atualizada)
supabase functions deploy consultor-rag

# Verificar se deploy foi bem-sucedido
supabase functions list
```

**Verificação:**
```bash
# Acompanhar logs em tempo real
supabase functions logs consultor-rag --tail

# Procurar por [HINTS-AUDIT] nos logs
```

---

### 4. Testar o Sistema

#### Teste 1: Hint de Alta Confiança (Score >= 70)

**Setup:**
1. Criar nova sessão de consultoria
2. Preencher anamnese:
   - **Segmento:** E-commerce
   - **Dor principal:** "Minha loja online não tem tráfego pago, só orgânico das redes sociais"
   - **Faturamento:** R$ 50k/mês
   - **Funcionários:** 5

3. Avançar para fase de execução

**Esperado nos logs:**
```
[HINTS-AUDIT] Search context: { segmento: 'E-commerce', dor_principal: 'Minha loja online não tem...', achados_count: 0, expressoes_count: 3 }
[HINTS-AUDIT] Hints found: [{ id: '...', title: 'E-commerce sem tráfego pago', score: 78 }]
[HINTS-AUDIT] Confidence check: { display: true, confidence: 'high', needsConfirmation: false }
[HINTS-AUDIT] Injecting 1 hints into LLM prompt with confidence: high
[HINTS-AUDIT] Telemetry updated for hint: ... usado_em_acao = true
```

**Esperado na resposta:**
- LLM deve mencionar estruturar campanhas de mídia paga
- Plano 5W2H deve incluir ações de Google Ads e Meta Ads
- Hints devem ter sido usados para guiar o plano

#### Teste 2: Hint de Média Confiança (Score 50-69)

**Setup:**
1. Nova sessão
2. Anamnese:
   - **Segmento:** Indústria
   - **Dor:** "Temos alguns problemas de qualidade"

**Esperado nos logs:**
```
[HINTS-AUDIT] Confidence check: { display: true, confidence: 'medium', needsConfirmation: true }
```

**Esperado na resposta:**
- LLM deve fazer pergunta de confirmação primeiro
- Ex: "Identifiquei possíveis oportunidades em qualidade e controle de defeitos. Isso faz sentido para você?"
- Após confirmação, detalha as ações

#### Teste 3: Sem Hints Relevantes

**Setup:**
1. Nova sessão
2. Anamnese:
   - **Segmento:** Agricultura (não coberto no catálogo)
   - **Dor:** Genérica

**Esperado nos logs:**
```
[HINTS-AUDIT] No hints found for context: { has_segmento: true, has_dor: true, achados_count: 0 }
```

**Esperado na resposta:**
- Sistema continua normalmente
- LLM gera plano sem hints (baseado apenas no contexto)

---

### 5. Monitorar Métricas

**Dashboard de Métricas (SQL Editor):**

```sql
-- 1. Taxa de Uso Real (hints buscados que viraram ações)
SELECT
  COUNT(*) FILTER (WHERE usado_em_acao = true) as hints_usados,
  COUNT(*) as total_buscas,
  ROUND(COUNT(*) FILTER (WHERE usado_em_acao = true)::numeric / COUNT(*) * 100, 2) as taxa_uso_pct
FROM proceda_hints_telemetry
WHERE created_at >= now() - interval '24 hours';
-- Alvo: >= 20%

-- 2. Taxa de Aceitação por Grupo A/B
SELECT
  grupo_ab,
  COUNT(*) as total_usos,
  COUNT(*) FILTER (WHERE acao_aceita = true) as aceites,
  ROUND(COUNT(*) FILTER (WHERE acao_aceita = true)::numeric / COUNT(*) * 100, 2) as taxa_aceite_pct
FROM proceda_hints_telemetry
WHERE usado_em_acao = true
  AND created_at >= now() - interval '7 days'
GROUP BY grupo_ab
ORDER BY grupo_ab;
-- Alvo: >= 60%

-- 3. Qualidade das Ações Geradas
SELECT * FROM proceda_hints_quality_metrics;
-- Alvos:
--   densidade_ok_pct >= 70% (4-8 ações)
--   depth_ok_pct >= 60% (HOW com 7+ etapas)
--   zero_reissues_pct >= 80% (qualidade first time)

-- 4. Top 5 Hints Mais Usados
SELECT
  h.title,
  h.segmentos,
  h.dominios,
  h.uso_count,
  h.aceite_rate,
  h.prioridade
FROM proceda_hints h
WHERE h.uso_count > 0
ORDER BY h.uso_count DESC, h.aceite_rate DESC
LIMIT 5;

-- 5. Hints com Baixa Aceitação (candidatos a revisão)
SELECT
  h.title,
  h.uso_count,
  h.aceite_rate,
  h.prioridade
FROM proceda_hints h
WHERE h.uso_count >= 5
  AND h.aceite_rate < 50
ORDER BY h.uso_count DESC;
```

---

## Troubleshooting

### Problema: Hints não aparecem nos logs

**Verificação:**
```sql
-- 1. Verificar se hints estão ativos
SELECT COUNT(*) FROM proceda_hints WHERE ativo = true;

-- 2. Verificar segmentos e domínios dos hints
SELECT segmentos, dominios, title FROM proceda_hints WHERE ativo = true LIMIT 10;

-- 3. Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'proceda_hints';
```

**Solução:**
- Se COUNT = 0: Executar seed novamente
- Se índices faltando: Executar migração novamente

### Problema: usado_em_acao sempre false

**Verificação:**
```sql
-- Verificar se trigger está correto
SELECT prosrc FROM pg_proc WHERE proname = 'update_hint_telemetry_stats';
```

**Solução:**
- Se não contém `IF NEW.usado_em_acao = true`: Reaplicar migração

### Problema: Score sempre baixo (< 50)

**Causas possíveis:**
1. Contexto de busca vazio
2. Hints não cobrem o segmento/domínio
3. Texto scenario dos hints não tem sinônimos suficientes

**Solução:**
- Adicionar mais hints ao catálogo
- Enriquecer campo scenario com sinônimos
- Verificar se contexto está sendo extraído corretamente (logs [HINTS-AUDIT])

---

## Rollback (Se Necessário)

### Reverter Migração
```sql
-- Restaurar trigger anterior
DROP TRIGGER IF EXISTS update_hint_stats_on_telemetry ON proceda_hints_telemetry;

CREATE OR REPLACE FUNCTION update_hint_telemetry_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Versão antiga: incrementa sempre
  UPDATE proceda_hints
  SET
    uso_count = uso_count + 1,
    ultima_utilizacao = now()
  WHERE id = NEW.hint_id;

  IF NEW.acao_aceita = true THEN
    UPDATE proceda_hints
    SET aceite_count = aceite_count + 1
    WHERE id = NEW.hint_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hint_stats_on_telemetry
  AFTER INSERT ON proceda_hints_telemetry
  FOR EACH ROW
  EXECUTE FUNCTION update_hint_telemetry_stats();
```

### Remover Hints de Teste
```sql
DELETE FROM proceda_hints WHERE tags @> ARRAY['teste'];
```

### Reverter Edge Function
```bash
# Deploy da versão anterior (se manteve backup)
supabase functions deploy consultor-rag --no-verify-jwt
```

---

## Checklist de Deploy

- [ ] 1. Backup do banco de dados realizado
- [ ] 2. Migração aplicada com sucesso
- [ ] 3. Seed de hints executado (12 hints criados)
- [ ] 4. Edge Function deployed
- [ ] 5. Teste 1 (alta confiança) passou
- [ ] 6. Teste 2 (média confiança) passou
- [ ] 7. Teste 3 (sem hints) passou
- [ ] 8. Logs [HINTS-AUDIT] aparecendo
- [ ] 9. Métricas sendo coletadas
- [ ] 10. Documentação atualizada

---

## Contatos

**Em caso de problemas:**
- Verificar logs: `supabase functions logs consultor-rag --tail`
- Consultar documentação: `HINTS_SYSTEM_FIX_COMPLETE.md`
- Verificar métricas: SQL queries acima

**Status:** Sistema pronto para produção após deploy.

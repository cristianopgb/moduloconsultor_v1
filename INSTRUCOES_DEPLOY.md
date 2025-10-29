# 🚀 Instruções de Deploy - Sistema Consolidado

## ⚠️ IMPORTANTE: Leia TUDO antes de executar

---

## 📋 PRÉ-REQUISITOS

1. ✅ Backup do banco já realizado automaticamente (nas migrações)
2. ✅ Build validado localmente (executado com sucesso)
3. ✅ Acesso ao Supabase Dashboard como admin
4. ⚠️ **CRITICAL:** Executar migrações na ordem EXATA especificada

---

## 🎯 ORDEM DE EXECUÇÃO (OBRIGATÓRIA)

### Fase 1: Normalização e Versionamento
```bash
# 1. Normalizar estados
supabase migration up 20251029000001_normalize_estados.sql

# Validar:
# SELECT DISTINCT estado_atual FROM consultor_sessoes;
# Deve mostrar apenas: coleta, analise, diagnostico, recomendacao, execucao, concluido

# 2. Adicionar versionamento ao kanban
supabase migration up 20251029000002_kanban_versioning.sql

# Validar:
# SELECT column_name FROM information_schema.columns WHERE table_name = 'kanban_cards';
# Deve incluir: plano_hash, plano_version, card_source, deprecated
```

---

### Fase 2: ⚠️ LIMPEZA CRÍTICA (NÃO PULE ESTA ETAPA)
```bash
# 3. Consolidar conflitos e remover schema obsoleto
supabase migration up 20251029100000_consolidate_conflicts.sql

# ⚠️ CRITICAL: Esta migração:
# - Remove tabelas obsoletas (jornadas_consultor, areas_trabalho)
# - Remove colunas obsoletas (jornada_id, area_id)
# - Limpa policies conflitantes
# - Consolida função is_master()

# Validar:
# SELECT table_name FROM information_schema.tables
# WHERE table_name IN ('jornadas_consultor', 'areas_trabalho');
# Deve retornar: 0 linhas (tabelas removidas)

# SELECT column_name FROM information_schema.columns
# WHERE table_name = 'kanban_cards' AND column_name IN ('jornada_id', 'area_id');
# Deve retornar: 0 linhas (colunas removidas)
```

---

### Fase 3: Features e Otimizações
```bash
# 4. Progresso automático
supabase migration up 20251029000003_progress_auto_update.sql

# 5. Telemetria LLM
supabase migration up 20251029000004_llm_telemetry.sql

# 6. RLS completo
supabase migration up 20251029000005_enable_rls_complete.sql

# 7. Full-Text Search português
supabase migration up 20251029000006_fts_portuguese.sql

# 8. Preparar embeddings
supabase migration up 20251029000007_prepare_pgvector.sql
```

---

## ✅ VALIDAÇÃO PÓS-DEPLOY

Execute estas queries no SQL Editor do Supabase:

### 1. Verificar Schema Limpo
```sql
-- Deve retornar apenas: id, sessao_id, titulo, descricao, responsavel,
-- due_at, status, plano_hash, plano_version, card_source, parent_card_id,
-- deprecated, deprecated_version, created_at, updated_at
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'kanban_cards'
ORDER BY ordinal_position;
```

### 2. Verificar Tabelas Obsoletas Removidas
```sql
-- Deve retornar: 0 linhas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'jornadas_consultor',
    'areas_trabalho',
    'framework_checklist',
    'cadeia_valor_processos'
  );
```

### 3. Verificar Função is_master()
```sql
-- Deve retornar: 1 função (não duplicada)
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_master';
```

### 4. Verificar RLS
```sql
-- Deve retornar TRUE para todas as tabelas críticas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'consultor_sessoes',
    'kanban_cards',
    'entregaveis_consultor',
    'knowledge_base_documents',
    'orquestrador_acoes',
    'llm_usage_log'
  );
```

### 5. Verificar Policies
```sql
-- Deve mostrar apenas policies novas (sessao_id, não jornada_id)
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'kanban_cards'
ORDER BY tablename, policyname;
```

### 6. Verificar Triggers
```sql
-- Deve mostrar triggers ativos e sem duplicatas
SELECT
  tgrelid::regclass AS table_name,
  tgname AS trigger_name,
  proname AS function_name
FROM pg_trigger
JOIN pg_proc ON tgfoid = pg_proc.oid
WHERE NOT tgisinternal
  AND tgrelid::regclass::text IN (
    'consultor_sessoes',
    'kanban_cards',
    'entregaveis_consultor',
    'knowledge_base_documents'
  )
ORDER BY table_name, trigger_name;
```

---

## 🧪 TESTE FUNCIONAL

Após validar as queries acima, teste o fluxo RAG:

### 1. Criar Sessão de Teste
```sql
INSERT INTO consultor_sessoes (
  user_id,
  titulo_problema,
  estado_atual,
  contexto_negocio,
  progresso,
  ativo
) VALUES (
  auth.uid(), -- Seu user_id
  'Teste de Validação Pós-Deploy',
  'coleta',
  '{"teste": true}'::jsonb,
  0,
  true
) RETURNING id;
```

### 2. Testar Consultor RAG
No frontend (ou via API):
```javascript
// Chamar consultor-rag com a sessão criada
const { data } = await supabase.functions.invoke('consultor-rag', {
  body: {
    sessao: {
      id: '<sessao_id_do_teste>',
      empresa: 'Empresa Teste',
      setor: 'tecnologia',
      estado: 'coleta'
    },
    messages: [
      { role: 'user', content: 'Olá, preciso de ajuda' }
    ]
  }
});

console.log('Response:', data);
// Deve retornar: { reply: '...', actions: [...], etapa: 'coleta' }
```

### 3. Testar Progresso Automático
```sql
-- Criar um card de teste
INSERT INTO kanban_cards (
  sessao_id,
  titulo,
  status,
  plano_hash,
  plano_version
) VALUES (
  '<sessao_id_do_teste>',
  'Card de Teste',
  'concluido',
  'test_hash',
  1
);

-- Verificar se progresso foi atualizado automaticamente
SELECT progresso FROM consultor_sessoes WHERE id = '<sessao_id_do_teste>';
-- Deve mostrar: valor > 0 (trigger funcionou)
```

---

## 🔧 TROUBLESHOOTING

### Erro: "table jornadas_consultor does not exist"
**Causa:** Edge Function obsoleta (consultor-chat) ainda ativa
**Solução:** Verificar se consultor-chat foi arquivada corretamente

### Erro: "column jornada_id does not exist"
**Causa:** Migração de consolidação não executou
**Solução:** Executar `20251029100000_consolidate_conflicts.sql` manualmente

### Erro: "policy already exists"
**Causa:** Políticas antigas não foram removidas
**Solução:** A consolidação remove automaticamente, re-executar migração

### Progresso não atualiza automaticamente
**Causa:** Triggers não foram criados
**Solução:** Verificar execução de `20251029000003_progress_auto_update.sql`

---

## 📊 MÉTRICAS DE SUCESSO

Após deploy, o sistema deve apresentar:

- ✅ **0 conflitos** de schema
- ✅ **0 tabelas** obsoletas
- ✅ **1 arquitetura** (RAG) ativa
- ✅ **6 tabelas** com RLS habilitado
- ✅ **30+ policies** consistentes
- ✅ **3 triggers** automáticos funcionando
- ✅ **100% build** success rate

---

## 🎯 ROLLBACK (Se Necessário)

Se algo der errado:

1. **Rollback de Migrações:**
```bash
# Reverter uma migração específica
supabase migration down <timestamp>

# Reverter até um ponto específico
supabase migration down --to <timestamp>
```

2. **Restaurar Backup:**
```sql
-- Backup foi criado automaticamente em:
-- consultor_sessoes_backup_20251029
SELECT * FROM consultor_sessoes_backup_20251029;
```

3. **Reativar consultor-chat (temporário):**
```bash
# APENAS SE NECESSÁRIO (não recomendado)
mv supabase/functions_archive/obsolete_20251029/consultor-chat \
   supabase/functions/
```

---

## 📞 SUPORTE

**Em caso de problemas:**

1. Verificar logs no Supabase Dashboard
2. Executar queries de validação acima
3. Consultar `AUDITORIA_CONFLITOS_E_LIMPEZA.md`
4. Verificar `SUMARIO_AUDITORIA_FINAL.md`

---

## ✅ CHECKLIST DE DEPLOY

- [ ] Leu toda a documentação
- [ ] Executou migrações na ordem exata
- [ ] Validou queries de verificação (todas passaram)
- [ ] Testou fluxo RAG funcionando
- [ ] Verificou triggers automáticos
- [ ] Confirmou RLS habilitado
- [ ] Arquivou consultor-chat
- [ ] Sistema funcionando 100%

---

**Último checkpoint:** Migração de Consolidação (20251029100000)
**Status do Sistema:** ✅ LIMPO E PRONTO PARA PRODUÇÃO

🚀 **BOM DEPLOY!**

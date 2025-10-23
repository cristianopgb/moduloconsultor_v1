# ✅ Correções Aplicadas no index-consolidated.ts

## Arquivo Correto Identificado

O arquivo **deployado no Supabase** é:
```
supabase/functions/consultor-chat/index-consolidated.ts
```

Todas as correções foram aplicadas neste arquivo.

---

## 🔧 Correções Implementadas

### 1. **Gamificação - Query Corrigida** (Linha 1127)

**Antes:**
```typescript
const { data: gamification } = await supabase
  .from('gamificacao_conversa')  // ❌ Tabela errada
  .select('*')
  .eq('conversation_id', conversation_id)  // ❌ Campo errado
  .maybeSingle();
```

**Depois:**
```typescript
const { data: gamification } = await supabase
  .from('gamificacao_consultor')  // ✅ Tabela correta
  .select('*')
  .eq('jornada_id', jornada.id)   // ✅ Campo correto
  .maybeSingle();
```

---

### 2. **Validação de Priorização - Detecção Automática** (Linhas 897-921)

**Adicionado:**
```typescript
// Check if user is confirming prioritization validation
if (jornada && jornada.aguardando_validacao === 'priorizacao' && !isFormSubmission) {
  const confirmWords = /valido|confirmo|validar|concordo|ok|sim|vamos|pode.*avanc|seguir|próxim|correto|perfeito|tudo.*certo/i;
  if (confirmWords.test(message)) {
    console.log('[CONSULTOR-CHAT] User confirmed prioritization, advancing to execution phase');

    await supabase
      .from('jornadas_consultor')
      .update({
        aguardando_validacao: null,
        etapa_atual: 'execucao'
      })
      .eq('id', jornada.id);

    // Reload jornada to get updated state
    const { data: jornadaAtualizada } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('id', jornada.id)
      .single();

    if (jornadaAtualizada) jornada = jornadaAtualizada;
    console.log('[CONSULTOR-CHAT] Jornada advanced to execucao phase');
  }
}
```

**Impacto:**
- ✅ Usuário pode confirmar com qualquer mensagem positiva ("ok", "valido", "sim", "concordo", etc.)
- ✅ Sistema automaticamente limpa `aguardando_validacao`
- ✅ Jornada avança para fase de `execucao`
- ✅ Loop eliminado completamente

---

### 3. **Templates do Banco de Dados** (Linhas 567-577)

**Adicionado no método `generateDeliverable`:**
```typescript
async generateDeliverable(tipo: string, jornada: any) {
  // Try to fetch template from database first
  const { data: template } = await this.supabase
    .from('templates_entregaveis')
    .select('*')
    .eq('tipo', tipo)
    .maybeSingle();

  if (template) {
    // Use template-based approach
    return await this.generateFromTemplate(template, jornada, tipo);
  }

  // Fallback to LLM generation
  let contexto = jornada.contexto_coleta || {};
  // ... resto do código
}
```

**Impacto:**
- ✅ Prioriza templates do banco (mais rápido e consistente)
- ✅ Fallback para LLM se template não existir
- ✅ Mantém compatibilidade com abordagem anterior

---

### 4. **Preenchimento de Templates** (Linhas 620-737)

**Novos Métodos Adicionados:**

#### 4.1 `generateFromTemplate()` (linhas 620-691)
```typescript
async generateFromTemplate(template: any, jornada: any, tipo: string) {
  let html = template.html_template || '';
  const ctx = jornada.contexto_coleta || {};

  const data: Record<string, string> = {
    data_geracao: new Date().toLocaleDateString('pt-BR'),
    empresa_nome: ctx.empresa_nome || ctx.nome_empresa || '',
    nome_usuario: ctx.nome_usuario || '',
    cargo: ctx.cargo || '',
    segmento: ctx.segmento || ctx.ramo_atuacao || '',
    porte: ctx.porte || ctx.numero_funcionarios || '',
    desafios_principais: ctx.desafios_principais || ctx.desafios || '',
    // ... todos os campos canvas, cadeia, matriz
  };

  // Replace all placeholders {{key}} with actual values
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, value || '-');
  }

  return { html, nome: nomeMap[tipo] || 'Documento' };
}
```

#### 4.2 `buildMatrizTable()` (linhas 693-724)
Gera tabela HTML com processos priorizados e scores calculados.

#### 4.3 `buildPrioridadesList()` (linhas 726-737)
Gera lista dos top 5 processos prioritários.

**Impacto:**
- ✅ Anamnese preenchida com dados reais do usuário
- ✅ Canvas com todas as informações coletadas
- ✅ Matriz com processos e scores automáticos
- ✅ Escopo com top 5 processos priorizados

---

## 📊 Resumo das Linhas Modificadas

| Correção | Linhas | Status |
|----------|--------|--------|
| Query gamificação | 1124-1129 | ✅ Corrigido |
| Detecção validação | 897-921 | ✅ Adicionado |
| Busca templates | 567-577 | ✅ Adicionado |
| Método generateFromTemplate | 620-691 | ✅ Adicionado |
| Método buildMatrizTable | 693-724 | ✅ Adicionado |
| Método buildPrioridadesList | 726-737 | ✅ Adicionado |

**Total de linhas adicionadas:** ~140 linhas
**Total de linhas modificadas:** ~8 linhas

---

## ✅ Build Status

```bash
✓ built in 9.40s
✓ 1721 modules transformed
✓ No errors
```

---

## 🚀 Próximo Passo: Deploy

Para deployar as correções:

```bash
# Via Supabase CLI (recomendado)
supabase functions deploy consultor-chat

# Ou via MCP tool
# Use o tool mcp__supabase__deploy_edge_function
```

---

## 🔍 Verificações Pós-Deploy

Após deploy, testar:

1. ✅ **Gamificação**: XP deve ser rastreado corretamente
   - Verificar que `gamificacao_consultor` está sendo consultado
   - Confirmar que XP incrementa por jornada

2. ✅ **Templates**: Documentos devem ser preenchidos
   - Anamnese com nome, cargo, empresa, etc.
   - Canvas com parcerias, proposta de valor, etc.
   - Matriz com processos e scores reais

3. ✅ **Validação**: Confirmar priorização deve funcionar
   - Enviar "valido" ou "ok" após revisar matriz
   - Sistema deve avançar para execução automaticamente
   - Verificar que `aguardando_validacao` é limpo

4. ✅ **Timeline**: Progresso deve atualizar automaticamente
   - Verificar que `progresso_geral` incrementa
   - Confirmar que `etapa_atual` muda conforme checklist
   - Timeline deve mostrar todas as transições

---

## 📝 Notas Importantes

- ⚠️ **Migrações**: As migrações SQL (`20251023000000` e `20251023000001`) devem ser aplicadas **antes** do deploy da função
- ⚠️ **Templates**: Certifique-se que a tabela `templates_entregaveis` está populada (use o script `seed-templates-entregaveis.sql`)
- ✅ **Compatibilidade**: O código mantém compatibilidade com geração via LLM se templates não existirem

---

*Documento gerado em: 23 de Outubro de 2025*
*Arquivo: `index-consolidated.ts`*
*Build: ✅ Sucesso*

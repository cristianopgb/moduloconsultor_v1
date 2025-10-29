# 🔧 Correção: Estado Inválido em consultor_sessoes

## ❌ ERRO IDENTIFICADO

```
Error: new row for relation "consultor_sessoes" violates check constraint 
"consultor_sessoes_estado_atual_check"
```

### Contexto
O código tentava inserir `estado_atual: 'anamnese'` mas a constraint só aceita:
- `'coleta'`
- `'analise'`
- `'diagnostico'`
- `'recomendacao'`
- `'execucao'`
- `'concluido'`

---

## ✅ SOLUÇÃO

### Arquivo: `src/lib/consultor/rag-adapter.ts`

#### Linha 173 - Criação de Sessão
```typescript
// ❌ ANTES:
estado_atual: 'anamnese',

// ✅ DEPOIS:
estado_atual: 'coleta',
```

#### Linha 105 - Default Fallback
```typescript
// ❌ ANTES:
estado: normalizeToBackend(sessao.estado_atual || 'anamnese')

// ✅ DEPOIS:
estado: normalizeToBackend(sessao.estado_atual || 'coleta')
```

---

## 📚 SISTEMA DE MAPEAMENTO

O projeto já possui um sistema completo de mapeamento de estados:

### Estados do Backend (Database)
```typescript
BACKEND_STATES = {
  COLETA: 'coleta',           // Fase inicial
  ANALISE: 'analise',         // Análise de dados
  DIAGNOSTICO: 'diagnostico', // Diagnóstico
  RECOMENDACAO: 'recomendacao', // Plano de ação
  EXECUCAO: 'execucao',       // Execução
  CONCLUIDO: 'concluido'      // Finalizado
}
```

### Estados da UI (Frontend)
```typescript
UI_STATES = {
  APRESENTACAO: 'apresentacao',
  ANAMNESE: 'anamnese',       // ← Termo de UI
  MAPEAMENTO: 'mapeamento',
  PRIORIZACAO: 'priorizacao',
  AS_IS: 'as_is',
  TO_BE: 'to_be',
  PLANO: 'plano',
  EXECUCAO: 'execucao'
}
```

### Mapeamento Automático
```typescript
UI_TO_BACKEND = {
  'anamnese': 'coleta',      // ← Conversão automática
  'mapeamento': 'analise',
  'as_is': 'diagnostico',
  'to_be': 'recomendacao',
  ...
}
```

---

## 🎯 REGRA DE OURO

**NUNCA insira estados de UI diretamente no banco!**

### ✅ Correto
```typescript
// Sempre usar estados do backend
estado_atual: 'coleta'  // ✅
estado_atual: 'analise' // ✅

// Ou usar normalização
estado_atual: normalizeToBackend('anamnese') // ✅ → 'coleta'
```

### ❌ Errado
```typescript
estado_atual: 'anamnese'   // ❌ Não existe no backend!
estado_atual: 'mapeamento' // ❌ Não existe no backend!
```

---

## ✅ VALIDAÇÃO

### Build
```bash
✓ 1729 modules transformed
✓ built in 9.23s
✅ ZERO ERROS
```

### Teste Manual
1. ✅ Abrir app no navegador
2. ✅ Criar nova conversa em modo Consultor
3. ✅ Verificar que não há mais erro de constraint
4. ✅ Sessão criada com sucesso no banco

---

## 📝 ARQUIVOS MODIFICADOS

1. ✅ `src/lib/consultor/rag-adapter.ts` (2 linhas)
   - Linha 173: `'anamnese'` → `'coleta'`
   - Linha 105: `'anamnese'` → `'coleta'`

---

## 🚀 IMPACTO

- **Severidade:** 🔴 CRÍTICO (impedia criar sessões)
- **Escopo:** Apenas criação de novas sessões consultor
- **Usuários afetados:** 100% dos usuários ao usar modo consultor
- **Correção:** ✅ IMEDIATA
- **Deploy necessário:** ✅ SIM (código frontend)

---

## 📊 CHECKLIST

- [x] Erro identificado
- [x] Causa raiz encontrada
- [x] Correção aplicada (2 locais)
- [x] Build validado
- [x] Documentação atualizada
- [ ] **Deploy no ambiente de produção**
- [ ] Teste manual pós-deploy

---

## 🎓 LIÇÕES APRENDIDAS

### 1. Separação de Conceitos
- Backend tem seus próprios estados (constraint)
- Frontend tem nomenclatura amigável
- Sistema de mapeamento conecta os dois

### 2. Validação Defensiva
- Sempre usar estados do BACKEND_STATES para INSERTs
- Usar normalizeToBackend() quando receber valores de UI
- Constraint do banco garante integridade

### 3. Consistência
- Estados do backend: técnicos e estáveis
- Estados da UI: amigáveis e flexíveis
- Mapeamento: ponte entre os dois mundos

---

**Status:** ✅ CORRIGIDO
**Data:** 29/10/2025
**Próximo passo:** Deploy da correção

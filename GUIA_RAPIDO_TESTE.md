# 🚀 Guia Rápido de Teste - Consultor Inteligente

## O Que Foi Implementado?

O Proceda agora tem um **consultor empresarial de verdade** que:
- ✅ Tem personalidade (empolgado, empático, didático)
- ✅ Segue método estruturado (7 fases)
- ✅ Faz perguntas certas no momento certo
- ✅ Gera entregáveis profissionais automaticamente
- ✅ Cria planos de ação executáveis no Kanban

## 🧪 Como Testar (5 minutos)

### 1. Abra o Proceda no Browser

```bash
npm run dev
# Acesse http://localhost:5173
```

### 2. Faça Login ou Crie Conta

Use qualquer email/senha ou crie nova conta

### 3. Crie Nova Conversa no Modo Consultor

1. Clique em "Chat" no menu
2. Botão "+ Nova Conversa"
3. Selecione modo: **Consultor**

### 4. Converse com o Consultor

**O consultor vai se apresentar:**
```
Olá! Sou Rafael, consultor do PROCEda especializado em negócios como o seu.

Vamos iniciar nossa jornada consultiva! Seguimos um método estruturado:
anamnese → modelagem → investigação → priorização → mapeamento → diagnóstico → execução

Primeiro, preciso te conhecer melhor:
- Qual seu nome e cargo atual?
- Qual sua empresa e ramo de atuação?
```

**Você pode responder algo como:**
```
Sou Maria Santos, CEO da TechSolve, empresa de software B2B.
Temos 30 funcionários, faturamos R$ 500k/mês.
Principal dor: dificuldade em escalar vendas e alto CAC.
```

### 5. Continue a Conversa

O consultor vai guiar você pelas fases:

**Fase 1 - Anamnese (1-2 minutos):**
- Coleta seus dados pessoais
- Coleta dados da empresa
- Entende suas dores

**Fase 2 - Modelagem (2-3 minutos):**
- Monta Business Canvas
- Mapeia Cadeia de Valor
- Identifica onde estão os problemas

**Fase 3 - Investigação (2-3 minutos):**
- Aplica Ishikawa
- Usa 5 Porquês
- Encontra causas raiz

**Fase 4 - Priorização (1 minuto):**
- Matriz GUT
- Define escopo (TOP 3-5 processos)

**Fase 5 - Mapeamento (3-4 minutos):**
- SIPOC de cada processo
- BPMN AS-IS
- Identifica gaps

**Fase 6 - Diagnóstico (1 minuto):**
- Consolida tudo
- Gera relatório executivo

**Fase 7 - Execução (1 minuto):**
- Cria plano 5W2H
- Gera cards no Kanban

## ✅ O Que Verificar

### Durante a Conversa

- [ ] Consultor **não repete** perguntas já respondidas
- [ ] Consultor **contextualiza** por que está perguntando
- [ ] Consultor **sintetiza** o que entendeu antes de avançar
- [ ] Máximo **1-2 perguntas** por turno (não interrogatório)
- [ ] Tom **empolgado mas profissional**

### Ao Final da Jornada

1. **Entregáveis Gerados** (verificar no menu lateral)
   - [ ] Anamnese Empresarial
   - [ ] Business Model Canvas
   - [ ] Cadeia de Valor
   - [ ] Diagrama Ishikawa
   - [ ] Análise 5 Porquês
   - [ ] Matriz de Priorização GUT
   - [ ] SIPOC dos processos
   - [ ] BPMN AS-IS
   - [ ] Diagnóstico Executivo
   - [ ] Plano de Ação 5W2H

2. **Kanban Atualizado**
   - [ ] Badge mostra número de cards novos
   - [ ] Abrir Kanban: cards criados com títulos claros
   - [ ] Cards têm datas válidas (não "+7d", mas datas reais)
   - [ ] Cards têm responsáveis definidos
   - [ ] Cards têm descrição do "por quê"

3. **Sem Erros**
   - [ ] Nenhum erro 500 na conversa
   - [ ] Todos entregáveis abrem corretamente
   - [ ] Kanban carrega sem erros

## 🐛 Se Algo Não Funcionar

### Erro: "jornada_id is required"

**Causa:** Bug #1 não corrigido
**Solução:** Verificar que `rag-adapter.ts` tem função `createJornada()`

### Erro: "Unknown deliverable type"

**Causa:** Bug #2 não corrigido
**Solução:** Verificar que `template-service.ts` tem casos para todos tipos

### Erro: "invalid timestamp format"

**Causa:** Bug #3 não corrigido
**Solução:** Verificar que `rag-executor.ts` tem função `toTimestamp()`

### Consultor não responde / trava

**Causa:** Bug #4 não corrigido
**Solução:** Verificar que `rag-executor.ts` usa try-catch e não throw

## 📊 Teste Rápido (30 segundos)

Se você só quer verificar que tudo compilou:

```bash
# Terminal 1: Build
npm run build

# Deve ver:
# ✓ built in 9.86s
# (sem erros)

# Terminal 2: Teste de código
node test-consultor-flow.cjs

# Deve ver:
# ✓ Code verification passed
# ✓ All critical fixes verified in code
```

## 🎯 Teste Completo (5 minutos)

1. **Abrir app** (localhost:5173)
2. **Login/Signup**
3. **Nova conversa modo Consultor**
4. **Responder 10-15 mensagens** seguindo o fluxo
5. **Verificar entregáveis** gerados
6. **Verificar Kanban** populado
7. **Sem erros 500** ✅

## 💡 Dicas para Testar Melhor

### Use Respostas Realistas

**❌ Ruim:**
```
"teste"
"não sei"
"qualquer coisa"
```

**✅ Bom:**
```
"Sou João, CTO da Logística Express, transportadora em SP.
Faturamos 2M/mês com 80 funcionários.
Problema principal: roteirização manual causa atrasos."
```

### Teste Diferentes Setores

- **Tecnologia/SaaS:** CAC alto, churn, LTV
- **Logística:** OTIF, lead time, roteirização
- **Varejo:** estoque, giro, margem
- **Serviços:** produtividade, utilização, NPS

Cada setor deve ter perguntas e KPIs específicos.

### Interrompa e Retome

1. Converse até fase 3
2. Feche o browser
3. Abra novamente
4. Continue a conversa

**Esperado:** Consultor lembra onde parou

## 🚨 Problemas Conhecidos

### OpenAI Key Não Configurada

**Sintoma:** Entregáveis gerados têm conteúdo básico/HTML simples

**Impacto:** Não crítico (fallback funciona)

**Solução:** Configurar `OPENAI_API_KEY` no .env para conteúdo rico

### Usuário Não Existe na Tabela `users`

**Sintoma:** Erro ao criar conversa

**Impacto:** Não afeta usuários logados normalmente

**Solução:** Sistema de signup deve inserir em `users` automaticamente

## ✅ Checklist Final

Antes de considerar teste completo:

- [ ] Conversa flui naturalmente (não robótico)
- [ ] Consultor não repete perguntas
- [ ] Consultor contextualiza cada pergunta
- [ ] 10+ entregáveis gerados
- [ ] Kanban tem 5-10 cards com datas válidas
- [ ] Zero erros 500
- [ ] Build passa sem erros
- [ ] Code verification passa

## 🎉 Sucesso!

Se todos os checks passaram:

**🎯 Sistema funcionando 100%**

Próximos passos:
1. Testar com usuários reais
2. Coletar feedback
3. Ajustar prompts se necessário
4. Configurar OpenAI para entregáveis ricos

---

**Dúvidas?** Consulte `IMPLEMENTACAO_CONSULTOR_INTELIGENTE_COMPLETA.md` para detalhes técnicos.

# Archive - Arquivos Consolidados Anteriores

Esta pasta contém versões anteriores dos arquivos do módulo Consultor que foram consolidados no `index.ts` principal.

## Arquivos Arquivados

### consultor-chat-consolidated-index.ts
- **Origem**: Raiz do projeto
- **Descrição**: Versão simplificada (394 linhas) do consultor-chat com lógica básica de fluxo
- **Data de Arquivamento**: 23/10/2025
- **Motivo**: Consolidado no index.ts principal com todas as melhorias

### index-consolidated.ts
- **Origem**: supabase/functions/consultor-chat/
- **Descrição**: Versão completa (1508 linhas) com todas as regras anti-loop e comportamento explícito da LLM
- **Data de Arquivamento**: 23/10/2025
- **Motivo**: Serviu como base para melhorias aplicadas no index.ts modular

## Melhorias Consolidadas no index.ts Principal

O arquivo `supabase/functions/consultor-chat/index.ts` atual agora inclui:

1. **Regras Explícitas de Comportamento da LLM**
   - CRITICAL RULES no system prompt
   - Instruções claras sobre o que a LLM DEVE, PODE e NUNCA fazer
   - Detecção de reapresentação e prevenção de loops conversacionais

2. **Sistema Anti-Loop Robusto**
   - Função `isFormAlreadyFilled()` verifica contexto_coleta
   - Filtragem de ações antes de enviar ao frontend
   - Refresh da jornada antes de processar actions

3. **Validação Robusta de userId**
   - Método `isValidUserId()` no MarkerProcessor
   - Fallback para RPCs de conversação quando userId inválido
   - Logs claros quando validação falha

4. **Fallbacks Inteligentes**
   - Inferência de ações quando LLM promete formulário mas não gera marker
   - Geração automática de matriz/escopo quando dados existem
   - Garantia de cadeia de valor em fase de modelagem

5. **Detecção Melhorada de Confirmação**
   - Regex expandido: `/valido|confirmo|validar|concordo|ok|sim|vamos|pode.*avanc|seguir|próxim|correto|perfeito|tudo.*certo/i`
   - Reload de jornada após confirmação
   - Logs detalhados do processo

6. **Persistência Automática de Processos**
   - Normalização de diferentes formatos do frontend
   - Inserção em `cadeia_valor_processos` table
   - Cálculo automático de scores de priorização
   - Criação automática de áreas de trabalho

## Estrutura Modular Mantida

O index.ts principal mantém a arquitetura modular com:
- `IntelligentPromptBuilder`: Construção de prompts com regras explícitas
- `MarkerProcessor`: Processamento de markers com validações
- `DeliverableGenerator`: Geração de entregáveis com templates
- `FrameworkGuide`: Gerenciamento do checklist e CTA system

## Como Restaurar (se necessário)

Se precisar consultar a versão antiga:
```bash
# Ver o consolidated completo (1508 linhas)
cat /tmp/cc-agent/59063573/project/archive/index-consolidated.ts

# Ver o consolidated simplificado (394 linhas)
cat /tmp/cc-agent/59063573/project/archive/consultor-chat-consolidated-index.ts
```

## Notas Importantes

- **NÃO** use esses arquivos em produção
- Eles servem apenas como referência histórica
- Todas as melhorias foram aplicadas no index.ts modular
- A versão atual é mais maintível e com melhor separação de concerns

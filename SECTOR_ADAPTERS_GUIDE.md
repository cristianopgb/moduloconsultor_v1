# Guia Completo: Sector Adapters - Carga em Massa

## 📋 Índice
1. [O Que São Sector Adapters](#o-que-são-sector-adapters)
2. [Funcionalidades Implementadas](#funcionalidades-implementadas)
3. [Como Usar](#como-usar)
4. [Formato do Arquivo JSON](#formato-do-arquivo-json)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Setores Já Populados](#setores-já-populados)

---

## O Que São Sector Adapters

Sector Adapters são **configurações personalizadas por setor empresarial** que adaptam a consultoria para cada segmento específico.

### Componentes de um Adapter:

1. **KPIs Específicos** - Métricas relevantes para o setor
2. **Perguntas de Anamnese** - Coleta de informações específicas
3. **Metodologias Recomendadas** - Frameworks mais adequados
4. **Problemas Comuns** - Desafios típicos do setor
5. **Entregáveis Típicos** - Documentos padrão do segmento

### Por Que Usar?

✅ **Consultoria mais precisa** - Recomendações baseadas em conhecimento setorial
✅ **Anamnese direcionada** - Perguntas relevantes para cada tipo de negócio
✅ **KPIs corretos** - Métricas que realmente importam para o setor
✅ **Diagnóstico rápido** - Identificação automática de problemas comuns
✅ **Templates prontos** - Entregáveis pré-configurados

---

## Funcionalidades Implementadas

### ✅ 1. Importação em Massa (Bulk Import)
- Upload de arquivo JSON com múltiplos adapters
- Validação automática do formato
- Relatório detalhado de sucesso/erros
- Duplicatas são automaticamente puladas
- Suporta importação incremental

### ✅ 2. Exportação Completa
- Download de todos os adapters em JSON
- Formato pronto para edição e reimportação
- Útil para backup e versionamento
- Nome do arquivo com data

### ✅ 3. CRUD Individual
- Criar novo adapter manualmente
- Editar adapters existentes
- Visualizar detalhes completos
- Excluir adapters

### ✅ 4. Integração com RAG
- Adapters são usados pelo sistema RAG
- Personalizam a experiência de consultoria
- Alimentam o orquestrador com contexto setorial

---

## Como Usar

### Acessar a Página

1. Login como **Master**
2. Menu lateral > **Admin** > **Sector Adapters**

### Importar Adapters (Carga em Massa)

1. **Preparar arquivo JSON**
   - Use o template: `sector-adapters-template.json`
   - Adicione quantos setores quiser no array
   - Valide o JSON (use jsonlint.com se necessário)

2. **Fazer Upload**
   - Clique no botão **"Importar JSON"** (azul, ícone Upload)
   - Selecione seu arquivo `.json`
   - Revise a lista de setores a importar
   - Confirme a importação

3. **Verificar Resultado**
   - Popup mostra resumo: ✅ Sucesso / ❌ Erros
   - Adapters importados aparecem na lista
   - Duplicatas são automaticamente ignoradas

### Exportar Adapters

1. Clique no botão **"Exportar"** (cinza, ícone Download)
2. Arquivo JSON é baixado automaticamente
3. Nome: `sector-adapters-YYYY-MM-DD.json`
4. Use para backup ou compartilhar configurações

### Criar Adapter Manualmente

1. Clique em **"Novo Adapter"** (verde, ícone Plus)
2. Preencha os campos obrigatórios
3. Adicione KPIs (botão "Adicionar KPI")
4. Adicione perguntas (botão "Adicionar Pergunta")
5. Configure arrays (metodologias, problemas, entregáveis, tags)
6. Clique em **"Salvar"**

### Editar/Excluir

- **Editar**: Clique no ícone de lápis no card
- **Excluir**: Clique no ícone de lixeira (pede confirmação)

---

## Formato do Arquivo JSON

### Estrutura Básica

```json
[
  {
    "setor_nome": "string (obrigatório)",
    "setor_descricao": "string (opcional)",
    "kpis": [ ... ],
    "perguntas_anamnese": [ ... ],
    "metodologias_recomendadas": [ ... ],
    "problemas_comuns": [ ... ],
    "entregaveis_tipicos": [ ... ],
    "tags": [ ... ],
    "prioridade": number (1-10),
    "ativo": boolean
  }
]
```

### Campos Detalhados

#### `setor_nome` (obrigatório)
- **Tipo**: string
- **Exemplo**: `"Saúde"`, `"Tecnologia"`, `"Varejo"`
- **Nota**: Usado como identificador único (não pode duplicar)

#### `setor_descricao`
- **Tipo**: string
- **Exemplo**: `"Clínicas, hospitais, consultórios, laboratórios"`
- **Dica**: Seja específico sobre que empresas se encaixam

#### `kpis`
Array de objetos KPI:
```json
{
  "nome": "Nome do KPI",
  "descricao": "O que mede",
  "formula": "Como calcular",
  "meta_ideal": "Meta ou benchmark"
}
```

**Exemplo real:**
```json
{
  "nome": "Taxa de Ocupação",
  "descricao": "Percentual de leitos ocupados",
  "formula": "(Leitos Ocupados / Total Leitos) × 100",
  "meta_ideal": "75-85%"
}
```

#### `perguntas_anamnese`
Array de objetos Pergunta:
```json
{
  "campo": "nome_campo_snake_case",
  "pergunta": "Texto da pergunta?",
  "tipo": "text | number | select | multiselect",
  "opcoes": ["Opção 1", "Opção 2"] // apenas para select/multiselect
}
```

**Tipos disponíveis:**
- `text` - Campo de texto livre
- `number` - Campo numérico
- `select` - Seleção única (dropdown)
- `multiselect` - Múltipla seleção (checkboxes)

**Exemplo real:**
```json
{
  "campo": "tipo_estabelecimento",
  "pergunta": "Tipo de estabelecimento?",
  "tipo": "select",
  "opcoes": ["Consultório", "Clínica", "Hospital", "Laboratório"]
}
```

#### `metodologias_recomendadas`
Array de strings com nomes das metodologias:
```json
[
  "SIPOC",
  "Business Model Canvas",
  "5W2H",
  "Cadeia de Valor",
  "Matriz de Priorização",
  "5 Porquês"
]
```

**Nota**: Use os nomes exatos da knowledge base para que o RAG encontre.

#### `problemas_comuns`
Array de strings com desafios típicos:
```json
[
  "Longa fila de espera",
  "Alta taxa de no-show",
  "Baixa produtividade",
  "Gestão de agenda ineficiente"
]
```

#### `entregaveis_tipicos`
Array de strings com documentos/planos comuns:
```json
[
  "Protocolo de Atendimento",
  "Fluxo de Agendamento Otimizado",
  "SLA de Atendimento",
  "Manual de Procedimentos"
]
```

#### `tags`
Array de strings para busca:
```json
["saude", "clinica", "hospital", "medicina", "atendimento"]
```

#### `prioridade`
- **Tipo**: number (1-10)
- **Uso**: Ordem de exibição (maior = aparece primeiro)
- **Padrão**: 5

#### `ativo`
- **Tipo**: boolean
- **Uso**: Habilitar/desabilitar adapter
- **Padrão**: true

---

## Exemplos Práticos

### Exemplo 1: Setor Simples

```json
[
  {
    "setor_nome": "Contabilidade",
    "setor_descricao": "Escritórios contábeis e assessorias fiscais",
    "kpis": [
      {
        "nome": "Clientes por Contador",
        "descricao": "Número de clientes por profissional",
        "formula": "Total Clientes / Número Contadores",
        "meta_ideal": "40-60 clientes"
      }
    ],
    "perguntas_anamnese": [
      {
        "campo": "num_clientes",
        "pergunta": "Quantos clientes ativos possui?",
        "tipo": "number"
      },
      {
        "campo": "regime_tributario",
        "pergunta": "Quais regimes atende?",
        "tipo": "multiselect",
        "opcoes": ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"]
      }
    ],
    "metodologias_recomendadas": ["SIPOC", "5W2H", "Matriz de Priorização"],
    "problemas_comuns": [
      "Atrasos na entrega de obrigações",
      "Alta carga de trabalho manual",
      "Dificuldade em precificar serviços"
    ],
    "entregaveis_tipicos": [
      "Fluxo de Processos Contábeis",
      "Tabela de Precificação de Serviços",
      "Checklist de Obrigações Mensais"
    ],
    "tags": ["contabilidade", "fiscal", "tributario"],
    "prioridade": 6,
    "ativo": true
  }
]
```

### Exemplo 2: Múltiplos Setores

```json
[
  {
    "setor_nome": "E-commerce",
    "setor_descricao": "Lojas virtuais e marketplaces",
    "kpis": [
      {
        "nome": "Taxa de Conversão",
        "descricao": "% de visitantes que compram",
        "formula": "(Vendas / Visitantes) × 100",
        "meta_ideal": "> 2%"
      }
    ],
    "perguntas_anamnese": [
      {
        "campo": "plataforma",
        "pergunta": "Qual plataforma usa?",
        "tipo": "select",
        "opcoes": ["Shopify", "WooCommerce", "Magento", "Própria"]
      }
    ],
    "metodologias_recomendadas": ["Business Model Canvas", "SIPOC"],
    "problemas_comuns": ["Taxa de abandono de carrinho alta", "CAC elevado"],
    "entregaveis_tipicos": ["Funil de Conversão", "Análise de Checkout"],
    "tags": ["ecommerce", "loja-virtual", "vendas-online"],
    "prioridade": 8,
    "ativo": true
  },
  {
    "setor_nome": "Academia",
    "setor_descricao": "Academias de ginástica e fitness",
    "kpis": [
      {
        "nome": "Taxa de Retenção",
        "descricao": "% de alunos que renovam",
        "formula": "(Alunos Renovados / Total Alunos) × 100",
        "meta_ideal": "> 80%"
      }
    ],
    "perguntas_anamnese": [
      {
        "campo": "num_alunos_ativos",
        "pergunta": "Quantos alunos ativos?",
        "tipo": "number"
      }
    ],
    "metodologias_recomendadas": ["5W2H", "Matriz de Priorização"],
    "problemas_comuns": ["Alta evasão de alunos", "Sazonalidade"],
    "entregaveis_tipicos": ["Plano de Retenção", "Jornada do Aluno"],
    "tags": ["academia", "fitness", "esportes"],
    "prioridade": 6,
    "ativo": true
  }
]
```

---

## Setores Já Populados

O sistema vem com **9 adapters pré-configurados**:

### 1. **Tecnologia** (Prioridade: 10)
- SaaS, software, TI, desenvolvimento
- KPIs: Churn, MRR, CAC, NPS
- 5 perguntas específicas

### 2. **Indústria e Manufatura** (Prioridade: 10)
- Fábricas, produção industrial
- KPIs: OEE, Lead Time, Refugo, OTIF
- Foco em eficiência produtiva

### 3. **Varejo** (Prioridade: 9)
- Lojas físicas, e-commerce
- KPIs: Ticket Médio, Taxa de Conversão, Giro de Estoque
- Problemas: ruptura, margem baixa

### 4. **Saúde** (Prioridade: 9)
- Clínicas, hospitais, laboratórios
- KPIs: Taxa de Ocupação, Tempo de Espera, No-Show
- Foco em atendimento

### 5. **Serviços** (Prioridade: 8)
- Consultorias, agências, prestadores
- KPIs: Taxa de Utilização, Margem, LTV, Retenção
- Problemas: precificação, dependência de pessoas

### 6. **Educação** (Prioridade: 8)
- Escolas, cursos, universidades
- KPIs: Taxa de Evasão, NPS, Taxa de Conversão
- Foco em retenção de alunos

### 7. **Alimentação** (Prioridade: 7)
- Restaurantes, bares, lanchonetes
- KPIs: CMV, Ticket Médio, Taxa de Ocupação
- Problemas: desperdício, padronização

### 8. **Logística e Transportes** (Prioridade: 6)
- Transportadoras, entregas, armazenagem
- KPIs: OTIF, Custo por Km, Ocupação de Frota
- Foco em otimização de rotas

### 9. **Hotelaria e Turismo** (Prioridade: 5)
- Hotéis, pousadas, resorts
- KPIs: Taxa de Ocupação, RevPAR, NPS
- Problemas: sazonalidade, dependência de OTAs

---

## Dicas e Boas Práticas

### ✅ DO (Faça)

1. **Use nomes descritivos e únicos** para `setor_nome`
2. **Seja específico** nas descrições de KPIs
3. **Teste o JSON** antes de importar (jsonlint.com)
4. **Comece com 2-3 KPIs** principais (não exagere)
5. **Perguntas objetivas** e diretas
6. **Tags relevantes** para busca
7. **Prioridade coerente** (10 = mais importante)
8. **Exporte antes de mudanças grandes** (backup)

### ❌ DON'T (Não Faça)

1. ❌ **Não use nomes duplicados** - causa erro
2. ❌ **Não crie KPIs genéricos** - seja específico do setor
3. ❌ **Não adicione 20 perguntas** - 4-6 é ideal
4. ❌ **Não esqueça opcoes** em select/multiselect
5. ❌ **Não use JSON mal formatado** - valide antes
6. ❌ **Não invente metodologias** - use as da knowledge base

---

## Comandos Úteis

### Verificar Adapters no Banco

```sql
SELECT
  setor_nome,
  prioridade,
  array_length(tags, 1) as num_tags,
  jsonb_array_length(kpis) as num_kpis,
  ativo
FROM sector_adapters
ORDER BY prioridade DESC, setor_nome;
```

### Contar Adapters Ativos

```sql
SELECT COUNT(*) as total_ativos
FROM sector_adapters
WHERE ativo = true;
```

### Exportar via SQL (alternativa)

```bash
# Execute no terminal do projeto
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('URL', 'KEY');
supabase.from('sector_adapters').select('*').then(r =>
  console.log(JSON.stringify(r.data, null, 2))
);
"
```

---

## Troubleshooting

### Problema: Erro "Invalid API key"
**Solução**: Verifique se está logado como Master. Apenas Masters podem gerenciar adapters.

### Problema: Importação falha com erro "23505"
**Solução**: Adapter com mesmo `setor_nome` já existe. Mude o nome ou exclua o existente.

### Problema: JSON não valida
**Solução**: Use [jsonlint.com](https://jsonlint.com) para validar seu JSON antes de importar.

### Problema: Perguntas não aparecem
**Solução**: Verifique se o campo `tipo` está correto e se `opcoes` está presente para select/multiselect.

### Problema: KPIs não salvam
**Solução**: Certifique-se que cada KPI tem ao menos `nome` e `descricao` preenchidos.

---

## Integração com Sistema RAG

Os Sector Adapters são **automaticamente usados pelo RAG** quando:

1. **Sessão é criada** - Adapter é detectado pelo setor da empresa
2. **Anamnese** - Perguntas específicas são feitas
3. **Diagnóstico** - Problemas comuns são verificados
4. **Recomendações** - Metodologias sugeridas são do adapter
5. **Entregáveis** - Templates são pré-selecionados

### Fluxo Completo

```
Usuário inicia consultoria
         ↓
RAG detecta setor da empresa
         ↓
Carrega Sector Adapter correspondente
         ↓
Faz perguntas_anamnese específicas
         ↓
Calcula KPIs do setor
         ↓
Identifica problemas_comuns
         ↓
Recomenda metodologias_recomendadas
         ↓
Sugere entregaveis_tipicos
```

---

## Arquivos Relacionados

- **Template**: `/sector-adapters-template.json`
- **Seed SQL**: `/supabase/seed-sector-adapters.sql`
- **Página Admin**: `/src/components/Admin/SectorAdaptersPage.tsx`
- **Migração**: `/supabase/migrations/20251027210000_create_sector_adapters.sql`
- **Este guia**: `/SECTOR_ADAPTERS_GUIDE.md`

---

## Próximos Passos

1. ✅ **Explore os adapters existentes** - Veja os 9 setores já configurados
2. ✅ **Exporte para backup** - Clique em "Exportar" e salve o JSON
3. ✅ **Crie adapters customizados** - Use o template e adicione seus setores
4. ✅ **Teste a integração** - Crie conversa em modo Consultor e veja os adapters em ação
5. ✅ **Compartilhe** - Exporte e compartilhe suas configurações com a equipe

---

## Suporte

**Dúvidas?** Abra um issue ou consulte:
- `RAG_INTEGRATION_STATUS.md` - Status do sistema RAG
- `SISTEMA_RAG_ATIVADO.md` - Guia do sistema completo
- Documentação das migrações em `/supabase/migrations/`

---

**Última atualização:** 28 de Outubro de 2025
**Versão:** 1.0 - Funcionalidade de carga em massa implementada ✅

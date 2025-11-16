# Analytics Governance Refactoring - Progress Report

**Date:** November 16, 2025
**Status:** FASE 1, FASE 2 & FASE 3 Completed ✅
**Progress:** 3/6 phases (50%)

---

## 🎯 Objective

Transform Analytics from a coupled system (LLM generates free SQL) into a **Governable Analytics Agent** with:
- ✅ Formal JSON contracts for all interactions
- ✅ Decoupled executor (LLM plans, Executor executes)
- ✅ Complete lineage (full traceability)
- ✅ Semantic layer (synonyms → canonical entities)
- ✅ Metrics registry (single source of truth)
- ✅ Automatic policies (missing data, outliers)

---

## ✅ FASE 1: Contracts & Foundations (COMPLETED)

### 1.1. TypeScript Contracts Created
**File:** `supabase/functions/_shared/analytics-contracts.ts` (450+ lines)

Main contracts:
- **DataCard**: Dataset metadata + quality (0-100) + column types + cardinality
- **Plan**: Analysis plan with steps, preconditions, confidence (0-100), needs_escalation
- **ExecSpec**: DSL for operations (aggregate, topN, filter, window) - NOT free SQL
- **ExecResult**: Result with exec_id, data, warnings, execution time, applied policies
- **ValidationReport**: Structured quality report with checks and severity
- **VizSpec**: Chart specification with lineage (exec_id_ref)
- **NarrativeDoc**: Structured narrative document with sections and exec_ids_used

### 1.2. Governance Tables Created
**Migration:** `20251116000000_create_analytics_governance_tables.sql` ✅ Applied

Tables created:
- **semantic_dictionary**: Maps raw names → canonical entities (e.g., "Rep" → "Vendedor")
- **metrics_registry**: Single source of truth for metrics (14 standard metrics)
- **execution_lineage**: Tracks ALL executions with exec_id for auditability
- **lineage_artifacts**: Links charts/tables/narratives to their source execution
- **analytics_performance_log**: Performance metrics monitoring

### 1.3. Seed Data Prepared
**File:** `supabase/seed-analytics-governance.sql` (360 lines)

Standard entities (11):
- **Dimensions (7):** Vendedor, Produto, Cliente, Data, Categoria, Região, Transportadora
- **Measures (4):** Preço, Custo, Quantidade, Receita

Standard metrics (14):
- **Financial:** Receita, Custo, Margem, Margem%, ROI, ROAS
- **Sales:** Ticket Médio, Conversion Rate, LTV, CAC, Churn Rate
- **Logistics:** OTIF, On Time%, In Full%
- **HR:** Turnover Rate

### 1.4. Adapters Created
Converters to maintain compatibility with existing code:

- **validation-adapter.ts**: Converts `data-validator.ts` → `ValidationReport`
- **narrative-adapter.ts**: Converts `narrative-engine.ts` → `NarrativeDoc`
- **visualization-adapter.ts**: Converts `visualization-engine.ts` → `VizSpec[]`
- **datacard-builder.ts**: Converts legacy `DataSample` → formal `DataCard`
- **analytics-integration.ts**: Backward-compatible wrapper for `chat-analyze`

---

## ✅ FASE 2: Decoupled Executor + Lineage (COMPLETED)

### 2.1. Decoupled Executor
**File:** `supabase/functions/_shared/executor/index.ts` (400+ lines)

Features:
- **Input:** Receives `ExecSpec` (DSL) + `DataCard`
- **Validation:** Checks if columns exist, operations are supported
- **Policies:** Applies default limits, TopN defaults, ordering
- **Translation:** Converts ExecSpec → SQL via `execspec-to-sql.ts`
- **Execution:** Runs via RPC `exec_sql_secure` with timeout (30s)
- **Lineage:** Generates unique `exec_id` (UUID) for traceability
- **Output:** Returns `ExecResult` with data + warnings + applied policies

Main functions:
```typescript
execute(execSpec, dataCard, options): Promise<ExecResult>
executeWithRetry(execSpec, dataCard, maxRetries): Promise<ExecResult>
validateExecSpec(execSpec, dataCard): { valid, errors }
applyPolicies(execSpec, dataCard): { adjustedSpec, policiesApplied }
```

### 2.2. ExecSpec → SQL Translator
**File:** `supabase/functions/_shared/executor/execspec-to-sql.ts` (350+ lines)

Supported primitives:
- **aggregate:** GROUP BY + SUM/AVG/COUNT/MIN/MAX
- **topN:** LIMIT + ORDER BY
- **filter:** WHERE with operators (=, !=, >, <, IN, LIKE, BETWEEN, IS NULL)
- **window:** ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD

Example translation:
```typescript
ExecSpec {
  dimensions: ['vendedor'],
  measures: [{ name: 'receita_total', aggregation: 'sum', column: 'receita' }],
  orderBy: [{ column: 'receita_total', direction: 'desc' }],
  limit: 10
}

// Translates to:
SELECT
  data->>'vendedor' AS vendedor,
  SUM((data->>'receita')::numeric) AS receita_total
FROM dataset_rows
WHERE dataset_id = '<uuid>'
GROUP BY 1
ORDER BY receita_total DESC
LIMIT 10
```

### 2.3. Cache System
**File:** `supabase/functions/_shared/executor/cache.ts` (200+ lines)

Features:
- **Cache Key:** SHA-256(ExecSpec + dataset_id)
- **Storage:** Table `execution_lineage` (status = 'cached')
- **TTL:** 1 hour (configurable)
- **Hit Rate:** Avoids redundant executions

Main functions:
```typescript
checkCache(execSpec, dataset_id): Promise<ExecResult | null>
saveToCache(execSpec, dataset_id, result): Promise<void>
invalidateCache(dataset_id): Promise<void>
cleanExpiredCache(): Promise<void>
```

### 2.4. Lineage Logger
**File:** `supabase/functions/_shared/lineage-logger.ts` (300+ lines)

Complete traceability:
- **Executions:** Logs exec_id, ExecSpec, DataCard, generated SQL, result
- **Artifacts:** Logs charts, tables, narratives linked to exec_id
- **Performance:** Logs times, confidence, token cost

Main functions:
```typescript
logExecution(execSpec, dataCard, result, user_id, conversation_id)
logVisualization(vizSpec, exec_id)
logNarrative(narrative, exec_ids)
logTable(data, exec_id, position)
getLineageTrace(exec_id): Promise<LineageTrace>
getArtifacts(exec_id): Promise<ArtifactLineage[]>
logPerformance(user_id, conversation_id, ...)
getUserPerformanceStats(user_id): Promise<stats>
```

---

## ✅ FASE 3: Semantic Layer + Metrics Registry (COMPLETED)

### 3.1. Semantic Layer
**File:** `supabase/functions/_shared/semantic-layer.ts` (400+ lines)

Features:
- **Column Resolution:** Maps raw column names to canonical entities
- **Matching Strategies:** Exact, alias, fuzzy (Levenshtein), fallback
- **Multi-language Support:** PT, EN, ES
- **Domain-aware:** Different mappings per domain (sales, logistics, etc)
- **Confidence Scoring:** 0-1 confidence for each mapping

Main functions:
```typescript
resolveColumnName(rawName, context): Promise<SemanticMapping>
resolveDataCard(dataCard, context): Promise<DataCard>
getCanonicalName(rawName): Promise<string>
isKnownEntity(rawName): Promise<boolean>
getCanonicalEntities(entityType, domain): Promise<string[]>
```

Examples:
- "Rep", "Vendedor", "Sales Rep" → "Vendedor" (confidence: 1.0)
- "Qtd", "Quantidade" → "Quantidade" (confidence: 0.95)
- "Price", "Preço" → "Preço" (confidence: 0.90)

### 3.2. Metrics Calculator
**File:** `supabase/functions/_shared/metrics-calculator.ts` (450+ lines)

Features:
- **Registry-based:** Uses metrics_registry table
- **Formula Substitution:** Replaces placeholders with actual columns
- **Dependency Checking:** Validates required columns exist
- **Intelligent Fallbacks:** Uses alternative formulas when data missing
- **Auto-suggestion:** Suggests calculable metrics for dataset

Main functions:
```typescript
calculateMetric(metricName, dataCard): Promise<CalculatedMetric>
calculateMetrics(metricNames, dataCard): Promise<MetricCalculationResult>
suggestMetrics(dataCard): Promise<string[]>
canCalculateMetric(metricName, dataCard): Promise<{can, missing, canUseFallback}>
enrichExecSpecWithMetrics(execSpec, dataCard, metrics): Promise<ExecSpec>
getMetricDefinition(metricName): Promise<MetricDefinition>
```

Formula examples:
- **ROI:** `({Receita} - {Investimento}) / {Investimento} * 100`
- **Margem%:** `({Receita} - {Custo}) / {Receita} * 100`
- **OTIF:** `({On_Time_In_Full_Deliveries} / {Total_Deliveries}) * 100`

### 3.3. Policies Engine
**File:** `supabase/functions/_shared/policies-engine.ts` (450+ lines)

Automatic policies:
1. **Data Quality:** Minimum quality score (default: 50)
2. **Row Limits:** Default 10k rows, max 100k
3. **Missing Data:** Auto-filter columns with >50% NULLs
4. **Outlier Detection:** Statistical outliers (±3 std dev)
5. **Semantic Fallbacks:** Use alternative columns when missing
6. **Aggregation Safety:** Ensure GROUP BY for aggregations

Main functions:
```typescript
enforceAnalyticsPolicies(execSpec, dataCard, config): PolicyEnforcementResult
validatePolicyApplication(policy, execSpec, dataCard): {valid, reason}
getPolicyRecommendations(dataCard): string[]
```

Policy application example:
```typescript
{
  policy_name: 'missing_data_handling',
  applied: true,
  reason: 'Added NULL filters for columns with >50% missing data',
  impact: 'Query returns only complete records'
}
```

### 3.4. Intelligent Planner
**File:** `supabase/functions/_shared/intelligent-planner.ts` (350+ lines)

Orchestrates all three components:
1. Applies semantic layer to resolve columns
2. Suggests metrics based on available data
3. Enforces policies and generates warnings
4. Returns enriched plan with confidence score

Main function:
```typescript
createIntelligentPlan(
  baseExecSpec: ExecSpec,
  dataCard: DataCard,
  options: PlanningOptions
): Promise<EnrichedPlan>
```

EnrichedPlan includes:
- Semantic context (resolved columns, known entities)
- Metrics context (suggested, calculable, missing dependencies)
- Policies context (applied policies, warnings, recommendations)
- Overall confidence score (0-1)

---

## 📂 New File Structure

```
supabase/functions/
├── _shared/
│   ├── analytics-contracts.ts           ✨ 450 lines (contracts)
│   ├── analytics-integration.ts         ✨ 200 lines (integration)
│   ├── datacard-builder.ts              ✨ 150 lines (DataCard factory)
│   ├── lineage-logger.ts                ✨ 300 lines (traceability)
│   ├── semantic-layer.ts                ✨ 400 lines (NEW - FASE 3)
│   ├── metrics-calculator.ts            ✨ 450 lines (NEW - FASE 3)
│   ├── policies-engine.ts               ✨ 450 lines (NEW - FASE 3)
│   ├── intelligent-planner.ts           ✨ 350 lines (NEW - FASE 3)
│   └── executor/
│       ├── index.ts                     ✨ 400 lines (executor)
│       ├── execspec-to-sql.ts           ✨ 350 lines (translator)
│       └── cache.ts                     ✨ 200 lines (cache)
├── analyze-file/
│   ├── validation-adapter.ts            ✨ 100 lines
│   ├── narrative-adapter.ts             ✨ 150 lines
│   └── visualization-adapter.ts         ✨ 150 lines
├── chat-analyze/
│   └── index.ts                         (to be refactored in FASE 4)
└── migrations/
    └── 20251116000000_...tables.sql    ✅ Applied
```

**Total new code:** ~4,100 lines of pure TypeScript

---

## 🎯 Benefits Already Achieved

### ✅ **Governance**
- Every execution has unique, traceable exec_id
- Possible to reproduce any historical analysis
- Complete audit of who did what and when

### ✅ **Separation of Concerns**
- LLM: Generates ExecSpec (structured plan)
- Executor: Executes deterministically
- Validation: Before execution (avoids invalid SQL)

### ✅ **Performance**
- Automatic cache (SHA-256 hash)
- 30s timeout (prevents infinite queries)
- 100k row limit (protection against explosion)

### ✅ **Quality**
- Policies applied automatically
- ExecSpec validation before execution
- Structured warnings (not just generic messages)

### ✅ **Intelligence** (NEW)
- Semantic resolution of column names
- Automatic metric calculation from registry
- Smart fallbacks when data is missing
- Confidence scoring for all operations

---

## 🚀 Next Steps (FASE 4-6)

### **FASE 4: LLM Router + Integration** (Next)
- Centralize LLM calls
- Planner consults Semantic Layer + Metrics Registry
- Returns Plan + ExecSpec + confidence (0-100)

### **FASE 5: UX Improvements + Reports**
- Lineage visualization in frontend
- Reports with exec_id references
- Automatic "Limitations" section

### **FASE 6: Tests & Validation**
- Test suite for contracts
- ExecSpec → SQL tests
- Policy and fallback tests

---

## ✅ Build Status

**Build:** ✅ Passed without TypeScript errors
**Time:** 17.82s
**Bundle:** 1.77MB

---

## 📊 Project Metrics

| Metric | Value |
|---------|-------|
| New lines of code | ~4,100 |
| Files created | 17 |
| New tables | 5 |
| Contracts defined | 15+ |
| Standard metrics | 14 |
| Semantic entities | 11 |
| Completed phases | 3/6 (50%) |
| Build status | ✅ Passed |

---

## 🎓 Key Concepts

### **ExecSpec (DSL)**
Structured language for analytical operations. NOT free SQL.
```typescript
{
  dimensions: ['vendedor'],
  measures: [{ name: 'total', aggregation: 'sum', column: 'valor' }],
  filters: [{ column: 'mes', operator: '=', value: 'Janeiro' }],
  orderBy: [{ column: 'total', direction: 'desc' }],
  limit: 10
}
```

### **DataCard**
Complete dataset profile with quality, types, cardinality.
```typescript
{
  dataset_id: 'uuid',
  columns: [{ name: 'vendedor', type: 'text', nullable_pct: 0, cardinality: 25 }],
  totalRows: 10000,
  qualityScore: 87,
  detected_domain: 'sales'
}
```

### **Lineage**
End-to-end traceability.
```
User Question → Plan → ExecSpec → SQL → Execution (exec_id)
                                            ↓
                                  VizSpec (exec_id_ref)
                                  NarrativeDoc (exec_ids_used)
```

---

---

## 🎉 FASE 3 Key Achievements

### Semantic Intelligence
- Column name resolution with 4 matching strategies
- Multi-language and domain support
- Confidence scoring for all mappings
- Automatic fallback to raw names when needed

### Metrics Automation
- 14 standard metrics from registry
- Formula substitution with column validation
- Intelligent fallback formulas
- Auto-suggestion based on available data

### Policy Enforcement
- 6 automatic policies
- Data quality gates
- Missing data handling
- Outlier detection
- Performance safeguards

### Orchestration
- Intelligent planner ties everything together
- Enriched plans with semantic + metrics + policies context
- Confidence scoring for execution decisions
- Complete traceability maintained

---

**Next step:** Implement FASE 4 (LLM Router + Integration with chat-analyze)

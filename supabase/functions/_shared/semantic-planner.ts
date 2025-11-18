/**
 * ===================================================================
 * SEMANTIC PLANNER - Intelligent Analysis Planning
 * ===================================================================
 *
 * The semantic planner bridges the gap between:
 * - User's question/intent
 * - Available data schema
 * - Playbook requirements
 *
 * Key responsibilities:
 * 1. Interpret user intent (e.g., "divergências" = stock comparison)
 * 2. Map available columns to playbook requirements
 * 3. Determine which derived columns need to be created
 * 4. Decide which playbook sections can be activated
 * 5. Generate transformation plan (SQL-first)
 *
 * CRITICAL: This prevents hallucinations by ensuring the LLM only
 * references columns that exist OR can be derived from available data.
 * ===================================================================
 */

import type { Column } from './schema-validator.ts';
import type { Playbook } from './playbook-registry.ts';

export interface SemanticPlan {
  // Analysis metadata
  playbook_id: string;
  playbook_name: string;
  user_intent: string;
  confidence: number;

  // Column mappings
  available_columns: string[];
  required_columns: Record<string, string>; // playbook requirement -> actual column
  missing_columns: string[];

  // Derived columns to create
  derivations: DerivedColumn[];

  // Sections to activate/disable
  active_sections: string[];
  disabled_sections: DisabledSection[];

  // Transformation SQL (if needed)
  transformation_sql?: string;

  // Warnings and limitations
  warnings: string[];
  limitations: string[];
}

export interface DerivedColumn {
  name: string;
  formula: string;
  dependencies: string[];
  type: 'numeric' | 'text' | 'date' | 'boolean';
  description: string;
}

export interface DisabledSection {
  section: string;
  reason: string;
  missing_requirement: string;
}

/**
 * Main planning function - generates semantic plan for analysis
 */
export async function planAnalysis(
  userQuestion: string,
  enrichedSchema: Column[],
  playbook: Playbook,
  rowCount: number
): Promise<SemanticPlan> {

  console.log(`[SemanticPlanner] Planning analysis for playbook: ${playbook.id}`);
  console.log(`[SemanticPlanner] User question: ${userQuestion}`);
  console.log(`[SemanticPlanner] Available columns: ${enrichedSchema.map(c => c.name).join(', ')}`);

  const plan: SemanticPlan = {
    playbook_id: playbook.id,
    playbook_name: playbook.description,
    user_intent: extractIntent(userQuestion),
    confidence: 0,
    available_columns: enrichedSchema.map(c => c.name),
    required_columns: {},
    missing_columns: [],
    derivations: [],
    active_sections: [],
    disabled_sections: [],
    warnings: [],
    limitations: []
  };

  // Build available columns map (normalized names)
  const availableMap = new Map<string, Column>();
  enrichedSchema.forEach(col => {
    const normalized = (col.normalized_name || col.name).toLowerCase();
    availableMap.set(normalized, col);
  });

  // Step 1: Map playbook required columns to available columns
  const requiredColumns = playbook.required_columns || {};

  for (const [reqCol, reqType] of Object.entries(requiredColumns)) {
    const matchedCol = findMatchingColumn(reqCol, reqType, availableMap, enrichedSchema);

    if (matchedCol) {
      plan.required_columns[reqCol] = matchedCol.name;
      console.log(`[SemanticPlanner] Mapped ${reqCol} → ${matchedCol.name}`);
    } else {
      plan.missing_columns.push(reqCol);
      console.log(`[SemanticPlanner] Missing required column: ${reqCol}`);
    }
  }

  // Step 2: Determine derived columns needed
  const metricsMap = playbook.metrics_map || {};

  for (const [metricName, metricDef] of Object.entries(metricsMap)) {
    // Check if all dependencies are available (either direct or derived)
    const canDerive = canDeriveMetric(metricDef, plan.required_columns, availableMap);

    if (canDerive) {
      // Create derivation plan
      const derivation = createDerivation(
        metricName,
        metricDef,
        plan.required_columns,
        enrichedSchema
      );

      if (derivation) {
        plan.derivations.push(derivation);
        // Add to required columns so other metrics can use it
        plan.required_columns[metricName] = metricName;
        console.log(`[SemanticPlanner] Will derive column: ${metricName}`);
      }
    } else {
      console.log(`[SemanticPlanner] Cannot derive ${metricName} - missing dependencies`);
    }
  }

  // Step 3: Determine which sections can be activated
  const sectionPlan = planSections(
    playbook,
    enrichedSchema,
    plan.required_columns,
    plan.derivations,
    rowCount
  );

  plan.active_sections = sectionPlan.active;
  plan.disabled_sections = sectionPlan.disabled;

  // Step 4: Calculate confidence score
  const totalRequired = Object.keys(requiredColumns).length;
  const matched = Object.keys(plan.required_columns).length - plan.derivations.length;
  const derived = plan.derivations.length;

  // Confidence: matched columns (50%) + derivable columns (30%) + active sections (20%)
  const matchScore = totalRequired > 0 ? (matched / totalRequired) * 50 : 0;
  const deriveScore = totalRequired > 0 ? (derived / totalRequired) * 30 : 0;
  const sectionScore = plan.active_sections.length > 0 ? 20 : 0;

  plan.confidence = Math.min(100, Math.round(matchScore + deriveScore + sectionScore));

  console.log(`[SemanticPlanner] Plan confidence: ${plan.confidence}%`);
  console.log(`[SemanticPlanner] Derivations: ${plan.derivations.length}`);
  console.log(`[SemanticPlanner] Active sections: ${plan.active_sections.length}`);
  console.log(`[SemanticPlanner] Disabled sections: ${plan.disabled_sections.length}`);

  // Step 5: Generate warnings and limitations
  if (plan.missing_columns.length > 0) {
    plan.warnings.push(
      `Colunas não encontradas: ${plan.missing_columns.join(', ')}. ` +
      `Análise será limitada aos dados disponíveis.`
    );
  }

  if (plan.disabled_sections.length > 0) {
    plan.limitations.push(
      `${plan.disabled_sections.length} seção(ões) desabilitada(s) por falta de requisitos.`
    );
  }

  if (plan.derivations.length > 0) {
    plan.warnings.push(
      `${plan.derivations.length} coluna(s) será(ão) calculada(s) a partir dos dados existentes.`
    );
  }

  return plan;
}

/**
 * Extract user intent from question
 */
function extractIntent(question: string): string {
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('divergên') || lowerQ.includes('diferen')) {
    return 'comparar_estoques';
  }

  if (lowerQ.includes('venda') || lowerQ.includes('receita')) {
    return 'analisar_vendas';
  }

  if (lowerQ.includes('tendên') || lowerQ.includes('temporal') || lowerQ.includes('tempo')) {
    return 'analisar_tendencias';
  }

  if (lowerQ.includes('categoria') || lowerQ.includes('grupo')) {
    return 'agrupar_por_categoria';
  }

  if (lowerQ.includes('local') || lowerQ.includes('rua') || lowerQ.includes('região')) {
    return 'agrupar_por_localizacao';
  }

  return 'analise_geral';
}

/**
 * Find matching column using semantic mapping
 */
function findMatchingColumn(
  requiredCol: string,
  requiredType: string,
  availableMap: Map<string, Column>,
  allColumns: Column[]
): Column | null {

  const normalized = requiredCol.toLowerCase().trim();

  // 1. Exact match
  if (availableMap.has(normalized)) {
    const col = availableMap.get(normalized)!;
    if (isTypeCompatible(col.inferred_type || col.type, requiredType)) {
      return col;
    }
  }

  // 2. Synonym mapping
  const synonyms = getSynonyms(requiredCol);
  for (const synonym of synonyms) {
    const synNorm = synonym.toLowerCase().trim();
    if (availableMap.has(synNorm)) {
      const col = availableMap.get(synNorm)!;
      if (isTypeCompatible(col.inferred_type || col.type, requiredType)) {
        return col;
      }
    }
  }

  // 3. Fuzzy match on canonical names
  for (const col of allColumns) {
    if (col.canonical_name) {
      const canonNorm = col.canonical_name.toLowerCase().trim();
      if (canonNorm === normalized || synonyms.includes(canonNorm)) {
        if (isTypeCompatible(col.inferred_type || col.type, requiredType)) {
          return col;
        }
      }
    }
  }

  // 4. Partial match
  for (const [key, col] of availableMap.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      if (isTypeCompatible(col.inferred_type || col.type, requiredType)) {
        return col;
      }
    }
  }

  return null;
}

/**
 * Get synonyms for a column name
 */
function getSynonyms(columnName: string): string[] {
  const synonymMap: Record<string, string[]> = {
    // Stock/Inventory
    'saldo_anterior': ['estoque_anterior', 'saldo_inicial', 'estoque_inicial', 'qtd_inicial'],
    'entrada': ['entradas', 'compras', 'input', 'recebimento'],
    'saida': ['saidas', 'saídas', 'vendas', 'output', 'baixa'],
    'contagem_fisica': ['contagem_real', 'inventario', 'inventário', 'fisico', 'físico', 'contagem'],
    'divergencia': ['diferenca', 'diferença', 'ajuste', 'variance'],

    // Common business columns
    'quantidade': ['qtd', 'qnt', 'quantity', 'qty', 'volume'],
    'valor': ['preco', 'preço', 'price', 'amount', 'valor_unit'],
    'data': ['date', 'periodo', 'período', 'mes', 'mês', 'ano'],
    'categoria': ['category', 'tipo', 'class', 'grupo'],
    'produto': ['product', 'item', 'sku', 'material'],
    'cliente': ['customer', 'client'],
    'vendedor': ['seller', 'sales_rep', 'representante'],

    // Location
    'rua': ['endereco', 'endereço', 'street', 'location', 'local', 'posicao', 'posição'],
    'andar': ['floor', 'nivel', 'nível', 'piso'],
    'box': ['box_location', 'gaveta', 'drawer'],

    // Stock-specific
    'qnt_atual': ['estoque_atual', 'saldo_atual', 'quantidade_atual', 'qtd_sistema'],
  };

  return synonymMap[columnName.toLowerCase()] || [];
}

/**
 * Check if types are compatible
 */
function isTypeCompatible(actualType: string, expectedType: string): boolean {
  const actual = (actualType || 'text').toLowerCase();
  const expected = expectedType.toLowerCase();

  if (actual === expected) return true;

  // Numeric variations
  if (expected === 'numeric') {
    return ['numeric', 'number', 'integer', 'float', 'decimal', 'int'].includes(actual);
  }

  // Date variations
  if (expected === 'date') {
    return ['date', 'datetime', 'timestamp'].includes(actual);
  }

  // Text variations
  if (expected === 'text') {
    return ['text', 'string', 'varchar', 'char'].includes(actual);
  }

  return false;
}

/**
 * Check if metric can be derived from available columns
 */
function canDeriveMetric(
  metricDef: any,
  mappedColumns: Record<string, string>,
  availableMap: Map<string, Column>
): boolean {

  const deps = metricDef.deps || [];

  for (const dep of deps) {
    // Check if dependency is already mapped
    if (mappedColumns[dep]) {
      continue;
    }

    // Check if dependency exists as raw column
    const normalized = dep.toLowerCase();
    if (availableMap.has(normalized)) {
      continue;
    }

    // Dependency not available
    return false;
  }

  return true;
}

/**
 * Create derivation plan for a metric
 */
function createDerivation(
  metricName: string,
  metricDef: any,
  mappedColumns: Record<string, string>,
  schema: Column[]
): DerivedColumn | null {

  const formula = metricDef.formula;
  const deps = metricDef.deps || [];

  // Replace dependencies with actual column names
  let actualFormula = formula;

  for (const dep of deps) {
    if (mappedColumns[dep]) {
      const actualCol = mappedColumns[dep];
      // Replace dependency name with actual column name
      actualFormula = actualFormula.replace(
        new RegExp(`\\b${dep}\\b`, 'g'),
        actualCol
      );
    }
  }

  // Determine output type based on formula
  let outputType: 'numeric' | 'text' | 'date' | 'boolean' = 'numeric';

  if (formula.includes('CASE WHEN')) {
    // Could be boolean or numeric depending on THEN clause
    if (formula.includes('THEN 1') || formula.includes('THEN 0')) {
      outputType = 'numeric'; // Binary indicator
    }
  }

  if (formula.includes('ABS') || formula.includes('+') || formula.includes('-') || formula.includes('*') || formula.includes('/')) {
    outputType = 'numeric';
  }

  return {
    name: metricName,
    formula: actualFormula,
    dependencies: deps,
    type: outputType,
    description: `Calculated: ${metricName} = ${formula}`
  };
}

/**
 * Plan which sections can be activated
 */
function planSections(
  playbook: Playbook,
  schema: Column[],
  mappedColumns: Record<string, string>,
  derivations: DerivedColumn[],
  rowCount: number
): { active: string[]; disabled: DisabledSection[] } {

  const active: string[] = [];
  const disabled: DisabledSection[] = [];

  const sections = playbook.sections || {};
  const allDerivedNames = new Set(derivations.map(d => d.name));

  // Build complete column availability (raw + derived)
  const availableColumns = new Set([
    ...schema.map(c => c.name.toLowerCase()),
    ...Object.values(mappedColumns).map(c => c.toLowerCase()),
    ...Array.from(allDerivedNames).map(n => n.toLowerCase())
  ]);

  // Check each section
  for (const [sectionName, queries] of Object.entries(sections)) {
    if (!Array.isArray(queries) || queries.length === 0) {
      continue;
    }

    // Check if section has required columns
    const sectionNeeds = extractColumnsFromQueries(queries);
    const missingCols = sectionNeeds.filter(col => !availableColumns.has(col.toLowerCase()));

    if (missingCols.length > 0) {
      disabled.push({
        section: sectionName,
        reason: `Colunas necessárias não disponíveis: ${missingCols.join(', ')}`,
        missing_requirement: missingCols.join(', ')
      });
      continue;
    }

    // Check specific section requirements
    if (sectionName === 'temporal_trend') {
      const hasDate = schema.some(c => (c.inferred_type || c.type) === 'date');
      if (!hasDate) {
        disabled.push({
          section: sectionName,
          reason: 'Nenhuma coluna de data encontrada',
          missing_requirement: 'Coluna de data'
        });
        continue;
      }

      if (rowCount < 24) {
        disabled.push({
          section: sectionName,
          reason: `Amostra insuficiente (${rowCount} < 24 linhas)`,
          missing_requirement: 'Mínimo 24 linhas para análise temporal'
        });
        continue;
      }
    }

    if (sectionName === 'relationship') {
      const numericCount = schema.filter(c => (c.inferred_type || c.type) === 'numeric').length;
      if (numericCount < 2) {
        disabled.push({
          section: sectionName,
          reason: `Apenas ${numericCount} coluna numérica (mínimo 2)`,
          missing_requirement: 'Mínimo 2 colunas numéricas'
        });
        continue;
      }
    }

    // Section can be activated
    active.push(sectionName);
  }

  return { active, disabled };
}

/**
 * Extract column names from queries
 */
function extractColumnsFromQueries(queries: string[]): string[] {
  const columns = new Set<string>();

  for (const query of queries) {
    // Match patterns like AVG(col), SUM_BY(col, metric), etc.
    const matches = query.matchAll(/\b([a-z_][a-z0-9_]*)\b/gi);

    for (const match of matches) {
      const name = match[1].toLowerCase();
      // Skip SQL keywords and functions
      if (!isSQLKeyword(name)) {
        columns.add(name);
      }
    }
  }

  return Array.from(columns);
}

/**
 * Check if string is a SQL keyword
 */
function isSQLKeyword(str: string): boolean {
  const keywords = [
    'select', 'from', 'where', 'group', 'by', 'order', 'as', 'and', 'or',
    'avg', 'sum', 'count', 'min', 'max', 'case', 'when', 'then', 'else', 'end',
    'abs', 'nullif', 'lower', 'upper', 'in', 'not', 'is', 'null'
  ];

  return keywords.includes(str.toLowerCase());
}

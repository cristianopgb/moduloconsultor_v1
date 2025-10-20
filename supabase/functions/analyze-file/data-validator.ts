/**
 * DATA VALIDATION AND ANOMALY DETECTION MODULE
 *
 * This module provides intelligent data quality assessment and anomaly detection
 * BEFORE analysis runs, preventing garbage-in-garbage-out scenarios.
 *
 * Key Features:
 * - Statistical outlier detection
 * - Logical consistency validation
 * - Impossible value detection
 * - Data quality scoring
 * - Automatic correction suggestions
 */ const DEFAULT_CONFIG = {
  enableOutlierDetection: true,
  enableConsistencyChecks: true,
  enableImpossibleValueDetection: true,
  autoCorrect: true,
  strictMode: false
};
/**
 * Main validation function - analyzes dataset and returns quality report
 */ export async function validateDataset(rows, columns, schema, config = {}) {
  const cfg = {
    ...DEFAULT_CONFIG,
    ...config
  };
  const issues = [];
  console.log(`[DataValidator] Starting validation of ${rows.length} rows, ${columns.length} columns`);
  // 1. Detect statistical outliers
  if (cfg.enableOutlierDetection) {
    const outlierIssues = detectOutliers(rows, schema);
    issues.push(...outlierIssues);
  }
  // 2. Check for impossible values
  if (cfg.enableImpossibleValueDetection) {
    const impossibleIssues = detectImpossibleValues(rows, schema);
    issues.push(...impossibleIssues);
  }
  // 3. Validate logical consistency
  if (cfg.enableConsistencyChecks) {
    const consistencyIssues = checkLogicalConsistency(rows, schema);
    issues.push(...consistencyIssues);
  }
  // 4. Calculate quality score
  const overallScore = calculateQualityScore(issues, rows.length);
  // 5. Generate recommendations
  const recommendations = generateRecommendations(issues, overallScore);
  // 6. Auto-correct if enabled
  let correctedData;
  if (cfg.autoCorrect && issues.some((i)=>i.suggestedAction === 'exclude')) {
    correctedData = applyCorrections(rows, issues);
  }
  // 7. Create summary
  const summary = createSummary(issues, overallScore, correctedData?.length || 0, rows.length);
  console.log(`[DataValidator] Validation complete. Score: ${overallScore}/100, Issues: ${issues.length}`);
  return {
    overallScore,
    issues,
    recommendations,
    correctedData,
    summary
  };
}
/**
 * Detect statistical outliers using IQR method
 */ function detectOutliers(rows, schema) {
  const issues = [];
  const numericColumns = schema.filter((s)=>s.type === 'numeric');
  for (const col of numericColumns){
    const values = rows.map((r, idx)=>({
        value: parseFloat(r[col.name]),
        idx
      })).filter((v)=>!isNaN(v.value));
    if (values.length < 4) continue;
    const sorted = [
      ...values
    ].sort((a, b)=>a.value - b.value);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index].value;
    const q3 = sorted[q3Index].value;
    const iqr = q3 - q1;
    const lowerBound = q1 - 3 * iqr; // Using 3*IQR for extreme outliers
    const upperBound = q3 + 3 * iqr;
    const outliers = values.filter((v)=>v.value < lowerBound || v.value > upperBound);
    if (outliers.length > 0 && outliers.length < values.length * 0.1) {
      issues.push({
        severity: outliers.length > values.length * 0.05 ? 'warning' : 'info',
        type: 'outlier',
        column: col.name,
        rowIndices: outliers.map((o)=>o.idx),
        description: `Coluna "${col.name}" possui ${outliers.length} valores extremos (fora de ${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)})`,
        affectedCount: outliers.length,
        suggestedAction: outliers.length > values.length * 0.05 ? 'flag' : 'ignore',
        details: {
          q1,
          q3,
          iqr,
          lowerBound,
          upperBound,
          outlierValues: outliers.slice(0, 5).map((o)=>o.value)
        }
      });
    }
  }
  return issues;
}
/**
 * Detect impossible values (negatives where shouldn't be, percentages > 100%, etc)
 * ENHANCED: Domain-specific validations for logistics, sales, HR, finance
 */ function detectImpossibleValues(rows, schema) {
  const issues = [];
  for (const col of schema){
    const colName = col.name.toLowerCase();
    // 1. Negative values in inherently positive metrics
    const positiveMetrics = [
      'quantidade',
      'quantity',
      'volume',
      'peso',
      'weight',
      'idade',
      'age',
      'preco',
      'price',
      'valor',
      'value',
      'custo',
      'cost',
      'salario',
      'salary',
      'receita',
      'revenue',
      'lucro',
      'profit',
      'estoque',
      'inventory',
      'stock',
      'distancia',
      'distance',
      'tempo',
      'time',
      'duracao',
      'duration',
      'prazo',
      'deadline'
    ];
    if (positiveMetrics.some((m)=>colName.includes(m))) {
      const negativeRows = [];
      rows.forEach((row, idx)=>{
        const val = parseFloat(row[col.name]);
        if (!isNaN(val) && val < 0) {
          negativeRows.push(idx);
        }
      });
      if (negativeRows.length > 0) {
        issues.push({
          severity: negativeRows.length > rows.length * 0.1 ? 'critical' : 'warning',
          type: 'impossible_value',
          column: col.name,
          rowIndices: negativeRows,
          description: `Coluna "${col.name}" possui ${negativeRows.length} valores negativos (impossível para esta métrica)`,
          affectedCount: negativeRows.length,
          suggestedAction: negativeRows.length < rows.length * 0.05 ? 'flag' : 'exclude',
          details: {
            reason: 'negative_value_in_positive_metric'
          }
        });
      }
    }
    // 2. Percentages and rates (must be 0-100%)
    if (colName.includes('percentual') || colName.includes('taxa') || colName.includes('%') || colName.includes('rate') || colName.includes('pct')) {
      const invalidRows = [];
      rows.forEach((row, idx)=>{
        const val = parseFloat(row[col.name]);
        if (!isNaN(val) && (val > 100 || val < 0)) {
          invalidRows.push(idx);
        }
      });
      if (invalidRows.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'impossible_value',
          column: col.name,
          rowIndices: invalidRows,
          description: `Coluna "${col.name}" possui ${invalidRows.length} valores fora do intervalo 0-100%`,
          affectedCount: invalidRows.length,
          suggestedAction: 'flag',
          details: {
            reason: 'invalid_percentage'
          }
        });
      }
    }
    // 3. OTIF / On-Time / In-Full specific (must be 0 or 1 typically)
    if (colName.includes('otif') || colName.includes('on_time') || colName.includes('in_full') || colName.includes('no_prazo') || colName.includes('completo')) {
      const invalidRows = [];
      rows.forEach((row, idx)=>{
        const val = parseFloat(row[col.name]);
        if (!isNaN(val) && val !== 0 && val !== 1 && val !== 100 && (val < 0 || val > 100)) {
          invalidRows.push(idx);
        }
      });
      if (invalidRows.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'impossible_value',
          column: col.name,
          rowIndices: invalidRows,
          description: `Coluna OTIF "${col.name}" possui ${invalidRows.length} valores inválidos (esperado: 0, 1, ou percentual 0-100)`,
          affectedCount: invalidRows.length,
          suggestedAction: 'flag',
          details: {
            reason: 'invalid_otif_value'
          }
        });
      }
    }
    // 4. HR/People metrics (age, seniority, etc)
    if (colName.includes('idade') || colName.includes('age')) {
      const invalidRows = [];
      rows.forEach((row, idx)=>{
        const val = parseFloat(row[col.name]);
        if (!isNaN(val) && (val < 16 || val > 100)) {
          invalidRows.push(idx);
        }
      });
      if (invalidRows.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'impossible_value',
          column: col.name,
          rowIndices: invalidRows,
          description: `Coluna "${col.name}" possui ${invalidRows.length} valores improváveis (fora de 16-100 anos)`,
          affectedCount: invalidRows.length,
          suggestedAction: 'flag',
          details: {
            reason: 'impossible_age'
          }
        });
      }
    }
    // 5. Extreme salary anomalies (very low or very high)
    if (colName.includes('salario') || colName.includes('salary')) {
      const suspiciousRows = [];
      rows.forEach((row, idx)=>{
        const val = parseFloat(row[col.name]);
        // Flag salaries < R$ 1000 or > R$ 1.000.000 (Brazil context)
        if (!isNaN(val) && (val > 0 && val < 1000 || val > 1000000)) {
          suspiciousRows.push(idx);
        }
      });
      if (suspiciousRows.length > 0) {
        issues.push({
          severity: 'info',
          type: 'impossible_value',
          column: col.name,
          rowIndices: suspiciousRows,
          description: `Coluna "${col.name}" possui ${suspiciousRows.length} valores suspeitos (muito baixos ou muito altos)`,
          affectedCount: suspiciousRows.length,
          suggestedAction: 'flag',
          details: {
            reason: 'suspicious_salary_range'
          }
        });
      }
    }
  }
  return issues;
}
/**
 * Check logical consistency between related columns
 */ function checkLogicalConsistency(rows, schema) {
  const issues = [];
  // Find related column pairs (delivered vs returned, planned vs actual, etc)
  const relationships = findColumnRelationships(schema);
  for (const rel of relationships){
    const { type, col1, col2 } = rel;
    if (type === 'delivered_vs_returned') {
      const inconsistentRows = [];
      const extremeRows = [];
      rows.forEach((row, idx)=>{
        const delivered = parseFloat(row[col1]);
        const returned = parseFloat(row[col2]);
        if (!isNaN(delivered) && !isNaN(returned)) {
          // Critical: returned > delivered
          if (returned > delivered) {
            inconsistentRows.push(idx);
            // Extreme case: returned significantly larger (> 5x)
            if (returned > delivered * 5) {
              extremeRows.push(idx);
            }
          }
        }
      });
      if (inconsistentRows.length > 0) {
        issues.push({
          severity: extremeRows.length > 0 ? 'critical' : 'warning',
          type: 'inconsistency',
          column: `${col1} vs ${col2}`,
          rowIndices: inconsistentRows,
          description: extremeRows.length > 0 ? `ANOMALIA CRÍTICA: ${extremeRows.length} linhas com devoluções ${">"}5x maiores que entregas (matematicamente impossível)` : `${inconsistentRows.length} linhas com valores devolvidos maiores que entregues`,
          affectedCount: inconsistentRows.length,
          suggestedAction: extremeRows.length > 0 ? 'exclude' : 'flag',
          details: {
            type: 'delivered_vs_returned',
            extremeCases: extremeRows.length,
            affectedRows: inconsistentRows.slice(0, 10)
          }
        });
      }
    }
    if (type === 'planned_vs_actual') {
      const largeDeviations = [];
      rows.forEach((row, idx)=>{
        const planned = parseFloat(row[col1]);
        const actual = parseFloat(row[col2]);
        if (!isNaN(planned) && !isNaN(actual) && planned > 0) {
          const deviation = Math.abs((actual - planned) / planned);
          // Flag deviations > 200%
          if (deviation > 2) {
            largeDeviations.push(idx);
          }
        }
      });
      if (largeDeviations.length > 0) {
        issues.push({
          severity: 'info',
          type: 'inconsistency',
          column: `${col1} vs ${col2}`,
          rowIndices: largeDeviations,
          description: `${largeDeviations.length} linhas com desvio >200% entre planejado e realizado`,
          affectedCount: largeDeviations.length,
          suggestedAction: 'flag',
          details: {
            type: 'large_deviation'
          }
        });
      }
    }
    // Stock vs Sales (sales shouldn't exceed current stock in many cases)
    if (type === 'stock_vs_sales') {
      const inconsistentRows = [];
      rows.forEach((row, idx)=>{
        const stock = parseFloat(row[col1]);
        const sales = parseFloat(row[col2]);
        if (!isNaN(stock) && !isNaN(sales) && sales > stock && stock >= 0) {
          inconsistentRows.push(idx);
        }
      });
      if (inconsistentRows.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'inconsistency',
          column: `${col1} vs ${col2}`,
          rowIndices: inconsistentRows,
          description: `${inconsistentRows.length} linhas com vendas maiores que estoque disponível (possível erro de dados)`,
          affectedCount: inconsistentRows.length,
          suggestedAction: 'flag',
          details: {
            type: 'sales_exceed_stock'
          }
        });
      }
    }
    // Price vs Cost (price should generally be > cost for profit)
    if (type === 'price_vs_cost') {
      const lowMarginRows = [];
      const negativeMarginRows = [];
      rows.forEach((row, idx)=>{
        const price = parseFloat(row[col1]);
        const cost = parseFloat(row[col2]);
        if (!isNaN(price) && !isNaN(cost) && cost > 0) {
          const margin = (price - cost) / cost * 100;
          if (margin < 0) {
            negativeMarginRows.push(idx);
          } else if (margin < 5) {
            lowMarginRows.push(idx);
          }
        }
      });
      if (negativeMarginRows.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'inconsistency',
          column: `${col1} vs ${col2}`,
          rowIndices: negativeMarginRows,
          description: `ALERTA: ${negativeMarginRows.length} linhas com preço menor que custo (margem negativa - prejuízo)`,
          affectedCount: negativeMarginRows.length,
          suggestedAction: 'flag',
          details: {
            type: 'negative_margin'
          }
        });
      }
      if (lowMarginRows.length > 0 && lowMarginRows.length > rows.length * 0.1) {
        issues.push({
          severity: 'info',
          type: 'inconsistency',
          column: `${col1} vs ${col2}`,
          rowIndices: lowMarginRows,
          description: `${lowMarginRows.length} linhas com margem muito baixa (<5%) - revisar precificação`,
          affectedCount: lowMarginRows.length,
          suggestedAction: 'flag',
          details: {
            type: 'low_margin'
          }
        });
      }
    }
    // Revenue vs Expenses (chronic imbalance)
    if (type === 'revenue_vs_expenses') {
      const imbalancedRows = [];
      rows.forEach((row, idx)=>{
        const revenue = parseFloat(row[col1]);
        const expenses = parseFloat(row[col2]);
        if (!isNaN(revenue) && !isNaN(expenses) && revenue > 0) {
          // Flag if expenses > revenue (loss)
          if (expenses > revenue) {
            imbalancedRows.push(idx);
          }
        }
      });
      if (imbalancedRows.length > rows.length * 0.5) {
        issues.push({
          severity: 'warning',
          type: 'inconsistency',
          column: `${col1} vs ${col2}`,
          rowIndices: imbalancedRows,
          description: `ALERTA FINANCEIRO: ${imbalancedRows.length} linhas (${Math.round(imbalancedRows.length / rows.length * 100)}%) com despesas maiores que receitas`,
          affectedCount: imbalancedRows.length,
          suggestedAction: 'flag',
          details: {
            type: 'chronic_losses'
          }
        });
      }
    }
  }
  return issues;
}
/**
 * Identify related columns based on naming patterns
 */ function findColumnRelationships(schema) {
  const relationships = [];
  const colNames = schema.map((s)=>s.name.toLowerCase());
  // Look for delivered/returned pairs
  schema.forEach((col1)=>{
    const name1 = col1.name.toLowerCase();
    if (name1.includes('entregue') || name1.includes('entrega') || name1.includes('delivered')) {
      schema.forEach((col2)=>{
        const name2 = col2.name.toLowerCase();
        if (name2.includes('devol') || name2.includes('retorn') || name2.includes('returned')) {
          relationships.push({
            type: 'delivered_vs_returned',
            col1: col1.name,
            col2: col2.name
          });
        }
      });
    }
    if (name1.includes('planejad') || name1.includes('previst') || name1.includes('planned')) {
      schema.forEach((col2)=>{
        const name2 = col2.name.toLowerCase();
        if (name2.includes('real') || name2.includes('efetiv') || name2.includes('actual')) {
          relationships.push({
            type: 'planned_vs_actual',
            col1: col1.name,
            col2: col2.name
          });
        }
      });
    }
    // Stock vs Sales validation
    if (name1.includes('estoque') || name1.includes('stock') || name1.includes('inventory')) {
      schema.forEach((col2)=>{
        const name2 = col2.name.toLowerCase();
        if (name2.includes('vend') || name2.includes('sales') || name2.includes('sold')) {
          relationships.push({
            type: 'stock_vs_sales',
            col1: col1.name,
            col2: col2.name
          });
        }
      });
    }
    // Price vs Cost validation
    if (name1.includes('preco') || name1.includes('price')) {
      schema.forEach((col2)=>{
        const name2 = col2.name.toLowerCase();
        if (name2.includes('custo') || name2.includes('cost')) {
          relationships.push({
            type: 'price_vs_cost',
            col1: col1.name,
            col2: col2.name
          });
        }
      });
    }
    // Revenue vs Expenses validation
    if (name1.includes('receita') || name1.includes('revenue')) {
      schema.forEach((col2)=>{
        const name2 = col2.name.toLowerCase();
        if (name2.includes('despesa') || name2.includes('expense') || name2.includes('gasto')) {
          relationships.push({
            type: 'revenue_vs_expenses',
            col1: col1.name,
            col2: col2.name
          });
        }
      });
    }
    // Expected delivery vs Actual delivery (OTIF)
    if (name1.includes('data_prevista') || name1.includes('expected_date') || name1.includes('prazo')) {
      schema.forEach((col2)=>{
        const name2 = col2.name.toLowerCase();
        if (name2.includes('data_entrega') || name2.includes('delivery_date') || name2.includes('entregue_em')) {
          relationships.push({
            type: 'expected_vs_actual_date',
            col1: col1.name,
            col2: col2.name
          });
        }
      });
    }
  });
  return relationships;
}
/**
 * Calculate overall quality score based on issues found
 */ function calculateQualityScore(issues, totalRows) {
  let score = 100;
  for (const issue of issues){
    const impactRatio = issue.affectedCount / totalRows;
    if (issue.severity === 'critical') {
      score -= Math.min(30, impactRatio * 100);
    } else if (issue.severity === 'warning') {
      score -= Math.min(15, impactRatio * 50);
    } else {
      score -= Math.min(5, impactRatio * 25);
    }
  }
  return Math.max(0, Math.round(score));
}
/**
 * Generate actionable recommendations based on issues
 */ function generateRecommendations(issues, score) {
  const recs = [];
  const criticalIssues = issues.filter((i)=>i.severity === 'critical');
  const warningIssues = issues.filter((i)=>i.severity === 'warning');
  if (score >= 85) {
    recs.push('✅ Qualidade dos dados é excelente. Análise pode prosseguir com alta confiabilidade.');
  } else if (score >= 70) {
    recs.push('⚠️ Qualidade dos dados é boa, mas com algumas ressalvas. Revise os problemas identificados.');
  } else if (score >= 50) {
    recs.push('⚠️ Qualidade dos dados apresenta problemas moderados. Recomenda-se correção antes da análise final.');
  } else {
    recs.push('🔴 Qualidade dos dados é baixa. Correções são essenciais para resultados confiáveis.');
  }
  if (criticalIssues.length > 0) {
    recs.push(`🔴 ${criticalIssues.length} problema(s) CRÍTICO(s) detectado(s). Linhas problemáticas serão excluídas automaticamente.`);
  }
  if (warningIssues.length > 0) {
    recs.push(`⚠️ ${warningIssues.length} aviso(s) detectado(s). Resultados devem ser interpretados com cuidado.`);
  }
  return recs;
}
/**
 * Apply automatic corrections by excluding problematic rows
 */ function applyCorrections(rows, issues) {
  const rowsToExclude = new Set();
  for (const issue of issues){
    if (issue.suggestedAction === 'exclude') {
      issue.rowIndices.forEach((idx)=>rowsToExclude.add(idx));
    }
  }
  console.log(`[DataValidator] Excluding ${rowsToExclude.size} problematic rows`);
  return rows.filter((_, idx)=>!rowsToExclude.has(idx));
}
/**
 * Create human-readable summary
 */ function createSummary(issues, score, correctedRows, originalRows) {
  const parts = [];
  parts.push(`Qualidade dos Dados: ${score}/100`);
  if (issues.length === 0) {
    parts.push('Nenhum problema detectado. Dados estão prontos para análise.');
  } else {
    parts.push(`${issues.length} problema(s) detectado(s):`);
    const critical = issues.filter((i)=>i.severity === 'critical');
    const warnings = issues.filter((i)=>i.severity === 'warning');
    const info = issues.filter((i)=>i.severity === 'info');
    if (critical.length > 0) {
      parts.push(`  - ${critical.length} crítico(s)`);
    }
    if (warnings.length > 0) {
      parts.push(`  - ${warnings.length} aviso(s)`);
    }
    if (info.length > 0) {
      parts.push(`  - ${info.length} informativo(s)`);
    }
  }
  if (correctedRows > 0 && correctedRows < originalRows) {
    const excluded = originalRows - correctedRows;
    parts.push(`\n${excluded} linha(s) problemática(s) foi(foram) excluída(s) automaticamente.`);
    parts.push(`Análise prosseguirá com ${correctedRows} linhas limpas.`);
  }
  return parts.join('\n');
}

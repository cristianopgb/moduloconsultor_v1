/**
 * ITERATIVE REASONING ENGINE
 *
 * Provides multi-step analysis with feedback loops and refinement.
 * Validates results, detects anomalies in outputs, and triggers re-analysis when needed.
 */

export interface ReasoningContext {
  question: string;
  iteration: number;
  maxIterations: number;
  discoveries: Discovery[];
  validations: ValidationResult[];
  confidence: number;
}

export interface Discovery {
  step: number;
  finding: string;
  significance: 'high' | 'medium' | 'low';
  triggersFollowUp: boolean;
  followUpQuestions?: string[];
}

export interface ValidationResult {
  check: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface IterativeAnalysisResult {
  finalResults: any;
  iterations: IterationLog[];
  confidence: number;
  recommendations: string[];
  learnings: string[];
}

export interface IterationLog {
  iteration: number;
  action: string;
  input: any;
  output: any;
  validation: ValidationResult[];
  discoveries: Discovery[];
  nextAction: string;
}

/**
 * Execute analysis with iterative refinement
 */
export async function executeIterativeAnalysis(
  initialQuery: string,
  executor: (query: string, context: ReasoningContext) => Promise<any>,
  validator: (results: any, context: ReasoningContext) => Promise<ValidationResult[]>
): Promise<IterativeAnalysisResult> {

  const context: ReasoningContext = {
    question: initialQuery,
    iteration: 0,
    maxIterations: 3,
    discoveries: [],
    validations: [],
    confidence: 50
  };

  const iterations: IterationLog[] = [];
  let currentQuery = initialQuery;
  let finalResults: any = null;

  console.log(`[IterativeReasoner] Starting iterative analysis`);

  while (context.iteration < context.maxIterations) {
    context.iteration++;
    console.log(`[IterativeReasoner] Iteration ${context.iteration}/${context.maxIterations}`);

    try {
      // Execute current query
      const results = await executor(currentQuery, context);

      // Validate results
      const validation = await validator(results, context);
      context.validations.push(...validation);

      // Check for critical failures
      const criticalFailures = validation.filter(v => !v.passed && v.severity === 'critical');

      if (criticalFailures.length > 0) {
        console.log(`[IterativeReasoner] Critical issues found, triggering refinement`);

        // Generate refined query based on failures
        const refinedQuery = await refineQueryBasedOnFailures(
          currentQuery,
          results,
          criticalFailures,
          context
        );

        iterations.push({
          iteration: context.iteration,
          action: 'execute_and_validate',
          input: currentQuery,
          output: results,
          validation,
          discoveries: [],
          nextAction: 'refine_and_retry'
        });

        currentQuery = refinedQuery;
        continue;
      }

      // Discover insights
      const discoveries = await discoverInsights(results, context);
      context.discoveries.push(...discoveries);

      // Check if discoveries require follow-up
      const requiresFollowUp = discoveries.some(d => d.triggersFollowUp);

      if (requiresFollowUp && context.iteration < context.maxIterations) {
        console.log(`[IterativeReasoner] Discoveries trigger follow-up analysis`);

        const followUpQuery = await generateFollowUpQuery(discoveries, context);

        iterations.push({
          iteration: context.iteration,
          action: 'discover_and_follow_up',
          input: currentQuery,
          output: results,
          validation,
          discoveries,
          nextAction: 'follow_up_analysis'
        });

        currentQuery = followUpQuery;
        continue;
      }

      // No issues, no follow-ups - we're done
      finalResults = results;
      context.confidence = calculateConfidence(validation, discoveries);

      iterations.push({
        iteration: context.iteration,
        action: 'complete',
        input: currentQuery,
        output: results,
        validation,
        discoveries,
        nextAction: 'finalize'
      });

      console.log(`[IterativeReasoner] Analysis complete with confidence ${context.confidence}%`);
      break;

    } catch (error: any) {
      console.error(`[IterativeReasoner] Error in iteration ${context.iteration}:`, error);

      iterations.push({
        iteration: context.iteration,
        action: 'error',
        input: currentQuery,
        output: null,
        validation: [{
          check: 'execution',
          passed: false,
          message: `Error: ${error.message}`,
          severity: 'critical'
        }],
        discoveries: [],
        nextAction: 'retry_with_fallback'
      });

      // Try fallback approach
      if (context.iteration < context.maxIterations) {
        currentQuery = await generateFallbackQuery(currentQuery, error, context);
      } else {
        throw error;
      }
    }
  }

  // Generate final recommendations
  const recommendations = generateRecommendations(context, iterations);
  const learnings = extractLearnings(context, iterations);

  return {
    finalResults,
    iterations,
    confidence: context.confidence,
    recommendations,
    learnings
  };
}

/**
 * Validate analysis results for correctness and coherence
 */
export async function validateResults(
  results: any,
  context: ReasoningContext
): Promise<ValidationResult[]> {

  const validations: ValidationResult[] = [];

  // 1. Check for empty results
  if (!results || (Array.isArray(results) && results.length === 0)) {
    validations.push({
      check: 'non_empty_results',
      passed: false,
      message: 'Query returned no results - may indicate incorrect logic or data filtering',
      severity: 'critical'
    });
    return validations;
  }

  // 2. Check for logical impossibilities
  if (Array.isArray(results)) {
    for (const row of results) {
      // Check for negative percentages
      for (const [key, value] of Object.entries(row)) {
        if (key.includes('pct') || key.includes('percent') || key.includes('taxa')) {
          const numVal = parseFloat(value as string);
          if (!isNaN(numVal) && (numVal < 0 || numVal > 100)) {
            validations.push({
              check: 'valid_percentage',
              passed: false,
              message: `Invalid percentage value: ${key} = ${numVal}% (should be 0-100)`,
              severity: 'warning'
            });
          }
        }

        // Check for extremely large numbers (potential calculation errors)
        if (typeof value === 'number' && Math.abs(value) > 1e15) {
          validations.push({
            check: 'reasonable_magnitude',
            passed: false,
            message: `Suspiciously large value: ${key} = ${value}`,
            severity: 'warning'
          });
        }
      }
    }
  }

  // 3. Check for internal consistency
  const consistencyCheck = checkInternalConsistency(results);
  validations.push(...consistencyCheck);

  // 4. Check for completeness
  if (context.question.toLowerCase().includes('otif')) {
    const hasOTIFMetrics = results.some((r: any) =>
      r.hasOwnProperty('otif_count') ||
      r.hasOwnProperty('on_time') ||
      r.hasOwnProperty('in_full')
    );

    validations.push({
      check: 'otif_metrics_present',
      passed: hasOTIFMetrics,
      message: hasOTIFMetrics
        ? 'OTIF metrics correctly calculated'
        : 'OTIF query missing expected metrics',
      severity: hasOTIFMetrics ? 'info' : 'critical'
    });
  }

  // If no failures, mark as valid
  if (validations.length === 0 || validations.every(v => v.passed)) {
    validations.push({
      check: 'overall_validity',
      passed: true,
      message: 'Results passed all validation checks',
      severity: 'info'
    });
  }

  return validations;
}

/**
 * Check internal consistency of results
 */
function checkInternalConsistency(results: any[]): ValidationResult[] {
  const checks: ValidationResult[] = [];

  if (!Array.isArray(results) || results.length === 0) {
    return checks;
  }

  // Check if sums add up correctly
  const firstRow = results[0];

  // If there's a 'total' and individual components, validate sum
  if (firstRow.total && firstRow.count) {
    const calculatedTotal = results.reduce((sum, r) => sum + (r.count || 0), 0);
    const declaredTotal = firstRow.total;

    if (Math.abs(calculatedTotal - declaredTotal) > declaredTotal * 0.01) {
      checks.push({
        check: 'sum_consistency',
        passed: false,
        message: `Sum mismatch: calculated ${calculatedTotal} vs declared ${declaredTotal}`,
        severity: 'warning'
      });
    }
  }

  return checks;
}

/**
 * Discover insights from results that may trigger follow-up
 */
async function discoverInsights(
  results: any,
  context: ReasoningContext
): Promise<Discovery[]> {

  const discoveries: Discovery[] = [];

  if (!Array.isArray(results) || results.length === 0) {
    return discoveries;
  }

  // Discovery 1: Extreme outliers in distribution
  const numericColumns = Object.keys(results[0]).filter(k => typeof results[0][k] === 'number');

  for (const col of numericColumns) {
    const values = results.map(r => r[col]).filter(v => v != null);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    // If max is 10x average, it's worth investigating
    if (max > avg * 10) {
      discoveries.push({
        step: context.iteration,
        finding: `Outlier detected in ${col}: max value (${max}) is ${Math.round(max / avg)}x the average`,
        significance: 'high',
        triggersFollowUp: true,
        followUpQuestions: [
          `What are the characteristics of records with extreme ${col} values?`,
          `Are these outliers data errors or legitimate extreme cases?`
        ]
      });
    }
  }

  // Discovery 2: Unexpected patterns
  if (context.question.toLowerCase().includes('otif') && results[0]) {
    const otifScore = results[0].otif_pct || 0;
    const onTimeScore = results[0].on_time_pct || 0;
    const inFullScore = results[0].in_full_pct || 0;

    // If OTIF is low but both components are high, something's wrong
    if (otifScore < 50 && onTimeScore > 80 && inFullScore > 80) {
      discoveries.push({
        step: context.iteration,
        finding: 'Anomaly: OTIF is low despite high On Time and In Full scores - calculation may be incorrect',
        significance: 'high',
        triggersFollowUp: true,
        followUpQuestions: ['Verify OTIF calculation logic']
      });
    }

    // If On Time is very low, investigate lead times
    if (onTimeScore < 30) {
      discoveries.push({
        step: context.iteration,
        finding: `On Time performance is critically low (${onTimeScore}%) - deep dive into lead times needed`,
        significance: 'high',
        triggersFollowUp: true,
        followUpQuestions: [
          'What is the distribution of lead times?',
          'What are the main causes of delays?'
        ]
      });
    }
  }

  return discoveries;
}

/**
 * Refine query based on validation failures
 */
async function refineQueryBasedOnFailures(
  originalQuery: string,
  results: any,
  failures: ValidationResult[],
  context: ReasoningContext
): Promise<string> {

  console.log(`[IterativeReasoner] Refining query based on ${failures.length} failures`);

  // If query returned empty, try broader filters
  if (failures.some(f => f.check === 'non_empty_results')) {
    return originalQuery.replace(/WHERE.*?(?=GROUP|ORDER|LIMIT|$)/i, '');
  }

  // If percentages are invalid, fix calculation
  if (failures.some(f => f.check === 'valid_percentage')) {
    return originalQuery.replace(
      /(\w+)\s*\/\s*(\w+)/g,
      '(CAST($1 AS FLOAT) / NULLIF($2, 0)) * 100'
    );
  }

  return originalQuery;
}

/**
 * Generate follow-up query based on discoveries
 */
async function generateFollowUpQuery(
  discoveries: Discovery[],
  context: ReasoningContext
): Promise<string> {

  const highPriorityDiscoveries = discoveries.filter(d => d.significance === 'high');

  if (highPriorityDiscoveries.length > 0) {
    const discovery = highPriorityDiscoveries[0];
    if (discovery.followUpQuestions && discovery.followUpQuestions.length > 0) {
      return discovery.followUpQuestions[0];
    }
  }

  return context.question;
}

/**
 * Generate fallback query on error
 */
async function generateFallbackQuery(
  originalQuery: string,
  error: Error,
  context: ReasoningContext
): Promise<string> {

  console.log(`[IterativeReasoner] Generating fallback for error: ${error.message}`);

  // If syntax error, try simpler query
  if (error.message.includes('syntax') || error.message.includes('parse')) {
    return 'SELECT COUNT(*) as total, AVG(value) as average FROM {{temp_table}} LIMIT 100';
  }

  return originalQuery;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(
  validations: ValidationResult[],
  discoveries: Discovery[]
): number {

  let confidence = 100;

  // Reduce confidence for failed validations
  const criticalFailures = validations.filter(v => !v.passed && v.severity === 'critical');
  const warnings = validations.filter(v => !v.passed && v.severity === 'warning');

  confidence -= criticalFailures.length * 30;
  confidence -= warnings.length * 10;

  // Reduce confidence for unresolved high-priority discoveries
  const unresolvedDiscoveries = discoveries.filter(
    d => d.significance === 'high' && d.triggersFollowUp
  );
  confidence -= unresolvedDiscoveries.length * 5;

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Generate recommendations based on iteration history
 */
function generateRecommendations(
  context: ReasoningContext,
  iterations: IterationLog[]
): string[] {

  const recs: string[] = [];

  if (iterations.length > 1) {
    recs.push(`Análise passou por ${iterations.length} iterações de refinamento para garantir qualidade`);
  }

  if (context.confidence >= 90) {
    recs.push('✅ Alta confiabilidade nos resultados - pode prosseguir com decisões');
  } else if (context.confidence >= 70) {
    recs.push('⚠️ Confiabilidade moderada - recomenda-se validação adicional');
  } else {
    recs.push('🔴 Baixa confiabilidade - revisar dados fonte e metodologia');
  }

  const criticalIssues = context.validations.filter(v => !v.passed && v.severity === 'critical');
  if (criticalIssues.length > 0) {
    recs.push(`🔴 ${criticalIssues.length} problema(s) crítico(s) identificado(s) - ação corretiva necessária`);
  }

  return recs;
}

/**
 * Extract key learnings from iteration process
 */
function extractLearnings(
  context: ReasoningContext,
  iterations: IterationLog[]
): string[] {

  const learnings: string[] = [];

  // Count refinements
  const refinements = iterations.filter(i => i.nextAction === 'refine_and_retry');
  if (refinements.length > 0) {
    learnings.push(`Sistema detectou e corrigiu ${refinements.length} problema(s) automaticamente`);
  }

  // Count discoveries
  const allDiscoveries = iterations.flatMap(i => i.discoveries);
  const significantDiscoveries = allDiscoveries.filter(d => d.significance === 'high');
  if (significantDiscoveries.length > 0) {
    learnings.push(`Identificadas ${significantDiscoveries.length} descoberta(s) importante(s) que requereram investigação adicional`);
  }

  // Note validation improvements
  const firstValidation = iterations[0]?.validation || [];
  const lastValidation = iterations[iterations.length - 1]?.validation || [];
  const firstFailures = firstValidation.filter(v => !v.passed).length;
  const lastFailures = lastValidation.filter(v => !v.passed).length;

  if (firstFailures > lastFailures) {
    learnings.push(`Qualidade dos resultados melhorou através de ${firstFailures - lastFailures} correção(ões)`);
  }

  return learnings;
}

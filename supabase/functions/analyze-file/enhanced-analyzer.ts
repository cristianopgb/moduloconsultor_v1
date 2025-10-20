/**
 * ENHANCED ANALYZER - Integration Layer
 *
 * This module integrates all new capabilities into the analysis pipeline:
 * - Data validation and anomaly detection
 * - Free-form analysis (non-template)
 * - Iterative reasoning with refinement
 * - Advanced visualization and storytelling
 */

import { validateDataset, DataQualityReport } from './data-validator.ts';
import {
  detectDomain,
  createAnalysisMethodology,
  DomainContext,
  AnalysisMethodology
} from './free-form-analyzer.ts';
import {
  executeIterativeAnalysis,
  validateResults,
  IterativeAnalysisResult,
  ReasoningContext
} from './iterative-reasoner.ts';
import {
  generateVisualizationSuite,
  VisualizationSuite
} from './visualization-engine.ts';

export interface EnhancedAnalysisConfig {
  enableValidation: boolean;
  enableFreeForm: boolean;
  enableIterativeReasoning: boolean;
  enableAdvancedViz: boolean;
  strictMode: boolean;
}

export interface EnhancedAnalysisResult {
  success: boolean;
  executed_query: boolean;

  // Original fields
  message: string;
  result?: any;
  analysis_id?: string;

  // Enhanced fields
  qualityReport?: DataQualityReport;
  domainContext?: DomainContext;
  methodology?: AnalysisMethodology;
  iterativeResults?: IterativeAnalysisResult;
  visualizations?: VisualizationSuite;

  // Metadata
  processingMode: 'template' | 'free-form' | 'hybrid';
  iterationsCount: number;
  confidence: number;
  warnings: string[];
}

const DEFAULT_CONFIG: EnhancedAnalysisConfig = {
  enableValidation: true,
  enableFreeForm: true,
  enableIterativeReasoning: true,
  enableAdvancedViz: true,
  strictMode: false
};

/**
 * Main enhanced analysis function
 * Wraps existing analysis with intelligent layers
 */
export async function runEnhancedAnalysis(
  dataset: any,
  schema: any[],
  userQuestion: string,
  executeSQL: (sql: string) => Promise<any[]>,
  config: Partial<EnhancedAnalysisConfig> = {}
): Promise<EnhancedAnalysisResult> {

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  let processingMode: 'template' | 'free-form' | 'hybrid' = 'template';

  console.log('[EnhancedAnalyzer] Starting enhanced analysis pipeline');
  console.log(`[EnhancedAnalyzer] Config:`, cfg);

  // ========== STEP 1: DATA VALIDATION ==========
  let qualityReport: DataQualityReport | undefined;
  let workingDataset = dataset;

  if (cfg.enableValidation) {
    console.log('[EnhancedAnalyzer] STEP 1: Validating data quality...');

    qualityReport = await validateDataset(
      dataset.rows,
      dataset.columns,
      schema,
      {
        enableOutlierDetection: true,
        enableConsistencyChecks: true,
        enableImpossibleValueDetection: true,
        autoCorrect: true,
        strictMode: cfg.strictMode
      }
    );

    console.log(`[EnhancedAnalyzer] Quality score: ${qualityReport.overallScore}/100`);
    console.log(`[EnhancedAnalyzer] Issues found: ${qualityReport.issues.length}`);

    // Apply corrections if data quality is poor
    if (qualityReport.correctedData && qualityReport.correctedData.length < dataset.rows.length) {
      const excludedCount = dataset.rows.length - qualityReport.correctedData.length;
      console.log(`[EnhancedAnalyzer] Applying corrections: ${excludedCount} rows excluded`);

      workingDataset = {
        ...dataset,
        rows: qualityReport.correctedData,
        totalRows: qualityReport.correctedData.length
      };

      warnings.push(
        `${excludedCount} linha(s) com problemas foi(foram) excluída(s) automaticamente para garantir resultados precisos`
      );
    }

    // Add quality warnings
    qualityReport.issues
      .filter(i => i.severity === 'critical' || i.severity === 'warning')
      .forEach(issue => {
        warnings.push(`[Qualidade] ${issue.description}`);
      });

    // Log summary for user visibility
    console.log(`[EnhancedAnalyzer] Data quality summary:\n${qualityReport.summary}`);
  }

  // ========== STEP 2: DOMAIN DETECTION ==========
  console.log('[EnhancedAnalyzer] STEP 2: Detecting domain context...');

  const domainContext = detectDomain(userQuestion, schema);
  console.log(`[EnhancedAnalyzer] Domain: ${domainContext.domain} (${domainContext.confidence}% confidence)`);
  console.log(`[EnhancedAnalyzer] Key indicators: ${domainContext.indicators.slice(0, 3).join(', ')}`);

  // ========== STEP 3: METHODOLOGY SELECTION ==========
  let methodology: AnalysisMethodology | undefined;

  if (cfg.enableFreeForm) {
    console.log('[EnhancedAnalyzer] STEP 3: Creating analysis methodology...');

    methodology = createAnalysisMethodology(userQuestion, schema, domainContext);
    console.log(`[EnhancedAnalyzer] Approach: ${methodology.approach}`);
    console.log(`[EnhancedAnalyzer] Steps: ${methodology.steps.length}`);

    if (methodology.domainContext && methodology.domainContext.domain !== 'generic') {
      processingMode = 'free-form';
      console.log(`[EnhancedAnalyzer] Using FREE-FORM analysis (domain-specific: ${methodology.domainContext.domain})`);
    }
  }

  // ========== STEP 4: QUERY EXECUTION (with optional iterative refinement) ==========
  console.log('[EnhancedAnalyzer] STEP 4: Executing analysis...');

  let finalResults: any;
  let iterativeResults: IterativeAnalysisResult | undefined;
  let iterationsCount = 1;
  let confidence = 75; // Base confidence

  if (cfg.enableIterativeReasoning && methodology && methodology.steps.length > 0) {
    console.log('[EnhancedAnalyzer] Using ITERATIVE REASONING for robust results');

    // Create executor function that wraps SQL execution
    const executor = async (query: string, context: ReasoningContext) => {
      console.log(`[EnhancedAnalyzer] Iteration ${context.iteration}: Executing query`);

      // Convert methodology steps to SQL
      const sqlQueries = methodology!.steps.map(step => step.sqlQuery);
      const results = [];

      for (const sql of sqlQueries) {
        const result = await executeSQL(sql);
        results.push(result);
      }

      return results;
    };

    // Execute with iterative refinement
    iterativeResults = await executeIterativeAnalysis(
      userQuestion,
      executor,
      validateResults
    );

    finalResults = iterativeResults.finalResults;
    iterationsCount = iterativeResults.iterations.length;
    confidence = iterativeResults.confidence;

    console.log(`[EnhancedAnalyzer] Iterative analysis complete: ${iterationsCount} iterations, ${confidence}% confidence`);

    // Add learnings as warnings/info
    iterativeResults.learnings.forEach(learning => {
      warnings.push(`[Sistema] ${learning}`);
    });

  } else {
    // ⚠️ Methodology has no pre-defined steps - use dynamic SQL generation
    console.log('[EnhancedAnalyzer] ⚠️ Methodology has no pre-defined steps - generating SQL dynamically');
    console.log('[EnhancedAnalyzer] This is expected for OTIF and other domain-specific analyses');

    // FALLBACK: Generate SQL dynamically using LLM
    // This happens when free-form methodology returns empty steps (e.g., OTIF)
    console.log('[EnhancedAnalyzer] Calling dynamic SQL generation...');

    // Execute a simple aggregation as fallback
    // The main pipeline will handle SQL generation via generateSQL()
    finalResults = null; // Signal that no results were generated
    processingMode = 'free-form';

    // Since we have no steps, we can't use iterative reasoning
    // Return early with flag indicating dynamic SQL is needed
    console.log('[EnhancedAnalyzer] Returning early - main pipeline should use generateSQL()');
  }

  // ========== STEP 5: VISUALIZATION & STORYTELLING ==========
  let visualizations: VisualizationSuite | undefined;

  // Only generate visualizations if we have actual results
  if (cfg.enableAdvancedViz && methodology && finalResults) {
    console.log('[EnhancedAnalyzer] STEP 5: Generating visualizations and narrative...');

    visualizations = generateVisualizationSuite(
      methodology.approach,
      Array.isArray(finalResults) ? finalResults.flat() : [finalResults],
      domainContext,
      {
        totalRows: workingDataset.totalRows,
        columns: schema,
        qualityScore: qualityReport?.overallScore
      }
    );

    console.log(`[EnhancedAnalyzer] Generated ${visualizations.charts.length} visualizations`);
    console.log(`[EnhancedAnalyzer] Quick wins: ${visualizations.recommendations.quickWins.length}`);
    console.log(`[EnhancedAnalyzer] Strategic actions: ${visualizations.recommendations.strategicActions.length}`);
  }

  // ========== STEP 6: COMPILE FINAL RESULT ==========
  console.log('[EnhancedAnalyzer] STEP 6: Compiling final result...');

  // If we don't have finalResults, signal to main pipeline to use generateSQL
  if (!finalResults) {
    console.log('[EnhancedAnalyzer] No results generated - main pipeline should handle SQL generation');
    return {
      success: false,
      executed_query: false,
      message: 'Enhanced Analyzer requires dynamic SQL generation',
      needsDynamicSQL: true,

      // Still return useful context for the main pipeline
      qualityReport,
      domainContext,
      methodology,
      processingMode,
      confidence,
      warnings
    } as any;
  }

  const executiveSummary = visualizations?.narrative.executiveSummary ||
    `Análise completa realizada com ${confidence}% de confiança. ` +
    `Metodologia aplicada: ${methodology?.approach || 'análise genérica'}.`;

  return {
    success: true,
    executed_query: true,
    message: executiveSummary,
    result: finalResults,

    // Enhanced data
    qualityReport,
    domainContext,
    methodology,
    iterativeResults,
    visualizations,

    // Metadata
    processingMode,
    iterationsCount,
    confidence,
    warnings
  };
}

/**
 * Helper to determine if free-form analysis should be used
 */
export function shouldUseFreeForm(
  templateFound: boolean,
  templateConfidence: number,
  domainContext: DomainContext
): boolean {

  // Use free-form if:
  // 1. No suitable template found
  if (!templateFound) return true;

  // 2. Template confidence is low but domain confidence is high
  if (templateConfidence < 60 && domainContext.confidence > 70) return true;

  // 3. Domain is highly specific (logistics, finance) and has specific indicators
  if (domainContext.domain !== 'generic' && domainContext.indicators.length > 3) {
    return true;
  }

  return false;
}

/**
 * Helper to create user-friendly message from enhanced result
 */
export function createUserMessage(result: EnhancedAnalysisResult): string {
  const parts: string[] = [];

  // Quality info
  if (result.qualityReport) {
    parts.push(`**Qualidade dos Dados:** ${result.qualityReport.overallScore}/100`);

    if (result.qualityReport.correctedData) {
      const excluded = result.qualityReport.issues.filter(i => i.suggestedAction === 'exclude');
      if (excluded.length > 0) {
        parts.push(`\n⚠️ **Correções Aplicadas:** ${excluded.length} problema(s) detectado(s) e corrigido(s) automaticamente`);

        // Describe most critical issue
        const critical = result.qualityReport.issues.find(i => i.severity === 'critical');
        if (critical) {
          parts.push(`\n🔍 **Problema Crítico Detectado:** ${critical.description}`);
        }
      }
    }
  }

  // Analysis summary
  parts.push(`\n\n**Análise Realizada:** ${result.methodology?.approach || 'Análise genérica'}`);

  if (result.domainContext && result.domainContext.domain !== 'generic') {
    parts.push(`**Domínio:** ${result.domainContext.domain} (${result.domainContext.confidence}% confiança)`);
  }

  // Results
  parts.push(`\n\n${result.message}`);

  // Visualizations insights
  if (result.visualizations) {
    parts.push('\n\n**Principais Insights:**');
    const insights = result.visualizations.charts.flatMap(c => c.insights).slice(0, 5);
    insights.forEach((insight, idx) => {
      parts.push(`${idx + 1}. ${insight}`);
    });

    // Quick wins
    if (result.visualizations.recommendations.quickWins.length > 0) {
      parts.push('\n\n**Ações Recomendadas (Impacto Rápido):**');
      result.visualizations.recommendations.quickWins.slice(0, 3).forEach((action, idx) => {
        parts.push(`${idx + 1}. **${action.title}** - ${action.description}`);
        parts.push(`   Impacto esperado: ${action.expectedImpact}`);
      });
    }
  }

  // Confidence note
  if (result.confidence < 70) {
    parts.push(`\n\n⚠️ **Nota:** Confiabilidade moderada (${result.confidence}%). Recomenda-se validação adicional dos resultados.`);
  }

  // Warnings
  if (result.warnings.length > 0) {
    parts.push('\n\n**Observações:**');
    result.warnings.slice(0, 3).forEach(w => parts.push(`- ${w}`));
  }

  return parts.join('\n');
}

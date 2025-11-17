/**
 * ===================================================================
 * HALLUCINATION DETECTOR - Final Safety Net
 * ===================================================================
 *
 * Scans generated text for hallucinations:
 * - Mentions of non-existent columns
 * - Metrics without satisfied dependencies
 * - Invalid dates (1970, 0001)
 * - Impossible values (negative counts, >100% rates)
 * - Forbidden terms
 *
 * CRITICAL: If >5 violations OR any critical violation → block result
 * ===================================================================
 */

import type { Column } from './schema-validator.ts';

export interface HallucinationViolation {
  type: 'forbidden_term' | 'missing_column' | 'invalid_date' | 'impossible_value' | 'unsatisfied_metric';
  term: string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line_number?: number;
}

export interface HallucinationReport {
  violations: HallucinationViolation[];
  blocked_terms: string[];
  confidence_penalty: number;
  should_block: boolean;
  summary: string;
}

// Invalid date patterns to detect
const INVALID_DATE_PATTERNS = [
  /1970-01-01/,
  /0001-01-01/,
  /1900-01-01/,
  /\b0{4}-/,  // Year 0000
  /epoch/i,
];

// Impossible value patterns
const IMPOSSIBLE_VALUE_PATTERNS = [
  { pattern: /taxa.*?(\d+\.?\d*)%/, validator: (val: number) => val > 100 || val < 0 },
  { pattern: /percentual.*?(\d+\.?\d*)%/, validator: (val: number) => val > 100 || val < 0 },
  { pattern: /contagem.*?(-\d+)/, validator: (val: number) => val < 0 },
  { pattern: /quantidade.*?(-\d+)/, validator: (val: number) => val < 0 },
];

/**
 * Scan text for hallucinations
 */
export function scanForHallucinations(
  text: string,
  availableColumns: Column[],
  forbiddenTerms: string[],
  metricsMap: Record<string, any> = {}
): HallucinationReport {

  console.log('[HallucinationDetector] Starting scan...');

  const violations: HallucinationViolation[] = [];
  const blockedTerms: string[] = [];

  // Build column name sets
  const columnNames = new Set(
    availableColumns.map(col => col.name.toLowerCase())
  );

  const canonicalNames = new Set(
    availableColumns.map(col => (col.canonical_name || col.name).toLowerCase())
  );

  const allColumnNames = new Set([...columnNames, ...canonicalNames]);

  // Split text into lines for context
  const lines = text.split('\n');

  // 1. Scan for forbidden terms
  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();

    for (const term of forbiddenTerms) {
      const lowerTerm = term.toLowerCase();
      if (lowerLine.includes(lowerTerm)) {
        violations.push({
          type: 'forbidden_term',
          term,
          context: line.trim(),
          severity: 'high',
          line_number: idx + 1
        });
        blockedTerms.push(term);
      }
    }
  });

  // 2. Scan for column references that don't exist
  const columnReferencePattern = /\b([a-z_][a-z0-9_]{2,})\b/gi;

  lines.forEach((line, idx) => {
    const matches = line.matchAll(columnReferencePattern);

    for (const match of matches) {
      const potentialColumn = match[1].toLowerCase();

      // Skip common words
      if (isCommonWord(potentialColumn)) continue;

      // Check if it looks like a column but doesn't exist
      if (looksLikeColumnName(potentialColumn) && !allColumnNames.has(potentialColumn)) {
        // Check if mentioned in a data context
        if (isDataContext(line)) {
          violations.push({
            type: 'missing_column',
            term: potentialColumn,
            context: line.trim(),
            severity: 'critical',
            line_number: idx + 1
          });
        }
      }
    }
  });

  // 3. Scan for invalid dates
  lines.forEach((line, idx) => {
    for (const pattern of INVALID_DATE_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          type: 'invalid_date',
          term: pattern.source,
          context: line.trim(),
          severity: 'high',
          line_number: idx + 1
        });
      }
    }
  });

  // 4. Scan for impossible values
  lines.forEach((line, idx) => {
    for (const { pattern, validator } of IMPOSSIBLE_VALUE_PATTERNS) {
      const match = pattern.exec(line);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && !validator(value)) {
          violations.push({
            type: 'impossible_value',
            term: match[0],
            context: line.trim(),
            severity: 'medium',
            line_number: idx + 1
          });
        }
      }
    }
  });

  // 5. Scan for unsatisfied metrics
  for (const metricName in metricsMap) {
    const metric = metricsMap[metricName];
    const deps = metric.deps || [];

    // Check if metric is mentioned in text
    if (text.toLowerCase().includes(metricName.toLowerCase())) {
      // Verify all dependencies exist
      for (const dep of deps) {
        if (!allColumnNames.has(dep.toLowerCase())) {
          violations.push({
            type: 'unsatisfied_metric',
            term: metricName,
            context: `Metric "${metricName}" requires missing column: "${dep}"`,
            severity: 'critical',
            line_number: undefined
          });
        }
      }
    }
  }

  // Calculate confidence penalty
  const penalty = calculateConfidencePenalty(violations);

  // Determine if should block
  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const shouldBlock = violations.length > 5 || criticalCount > 0;

  // Generate summary
  const summary = generateSummary(violations, shouldBlock);

  console.log(`[HallucinationDetector] Found ${violations.length} violations`);
  console.log(`[HallucinationDetector] Critical: ${criticalCount}, Should block: ${shouldBlock}`);

  return {
    violations,
    blocked_terms: [...new Set(blockedTerms)],
    confidence_penalty: penalty,
    should_block: shouldBlock,
    summary
  };
}

/**
 * Check if word is common and not a column
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has',
    'data', 'analysis', 'result', 'value', 'total', 'count', 'average',
    'sum', 'min', 'max', 'para', 'com', 'por', 'dos', 'das', 'uma',
    'analise', 'dados', 'resultado', 'valor', 'media', 'total', 'grupo'
  ]);

  return commonWords.has(word) || word.length < 3;
}

/**
 * Check if word looks like a column name
 */
function looksLikeColumnName(word: string): boolean {
  // Contains underscore or is camelCase
  if (word.includes('_')) return true;
  if (/[a-z][A-Z]/.test(word)) return true;

  // Ends with common suffixes
  const suffixes = ['_id', '_date', '_valor', '_qtd', '_total', '_medio'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix)) return true;
  }

  return false;
}

/**
 * Check if line is in a data context (mentions specific values or calculations)
 */
function isDataContext(line: string): boolean {
  const dataKeywords = [
    'média', 'media', 'total', 'soma', 'contagem', 'quantidade',
    'average', 'sum', 'count', 'value', 'metric', 'indicador',
    'coluna', 'column', 'campo', 'field', 'por', 'by'
  ];

  const lowerLine = line.toLowerCase();
  return dataKeywords.some(keyword => lowerLine.includes(keyword));
}

/**
 * Calculate confidence penalty based on violations
 */
function calculateConfidencePenalty(violations: HallucinationViolation[]): number {
  let penalty = 0;

  violations.forEach(v => {
    switch (v.severity) {
      case 'critical':
        penalty += 20;
        break;
      case 'high':
        penalty += 10;
        break;
      case 'medium':
        penalty += 5;
        break;
      case 'low':
        penalty += 2;
        break;
    }
  });

  return Math.min(30, penalty); // Cap at 30 points
}

/**
 * Generate summary of violations
 */
function generateSummary(violations: HallucinationViolation[], shouldBlock: boolean): string {
  if (violations.length === 0) {
    return '✅ Nenhuma alucinação detectada. Texto validado com sucesso.';
  }

  const byType = violations.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let summary = `⚠️ Detectadas ${violations.length} violações:\n`;

  if (byType.forbidden_term) {
    summary += `- ${byType.forbidden_term} termo(s) proibido(s)\n`;
  }
  if (byType.missing_column) {
    summary += `- ${byType.missing_column} referência(s) a coluna(s) inexistente(s)\n`;
  }
  if (byType.invalid_date) {
    summary += `- ${byType.invalid_date} data(s) inválida(s)\n`;
  }
  if (byType.impossible_value) {
    summary += `- ${byType.impossible_value} valor(es) impossível(is)\n`;
  }
  if (byType.unsatisfied_metric) {
    summary += `- ${byType.unsatisfied_metric} métrica(s) com dependências não satisfeitas\n`;
  }

  if (shouldBlock) {
    summary += '\n🚫 **RESULTADO BLOQUEADO** devido a violações críticas.';
  }

  return summary;
}

/**
 * Format violation report for logging
 */
export function formatViolationReport(report: HallucinationReport): string {
  if (report.violations.length === 0) {
    return 'No violations detected.';
  }

  let output = `\n========== HALLUCINATION REPORT ==========\n`;
  output += `Total violations: ${report.violations.length}\n`;
  output += `Confidence penalty: -${report.confidence_penalty} points\n`;
  output += `Should block: ${report.should_block ? 'YES' : 'NO'}\n`;
  output += `\n`;

  report.violations.forEach((v, idx) => {
    output += `\n[${idx + 1}] ${v.type.toUpperCase()} (${v.severity})\n`;
    output += `    Term: "${v.term}"\n`;
    output += `    Context: "${v.context}"\n`;
    if (v.line_number) {
      output += `    Line: ${v.line_number}\n`;
    }
  });

  output += `\n==========================================\n`;

  return output;
}

/**
 * Generate user-friendly error message for blocked results
 */
export function generateBlockedResultMessage(report: HallucinationReport): string {
  const criticalViolations = report.violations.filter(v => v.severity === 'critical');

  let message = '## ⚠️ Análise Bloqueada por Inconsistências\n\n';
  message += 'O sistema detectou conteúdo inconsistente com os dados fornecidos. ';
  message += 'Para garantir a qualidade da análise, o resultado foi bloqueado.\n\n';

  message += '### Problemas Detectados:\n\n';

  if (criticalViolations.length > 0) {
    message += '**Violações Críticas:**\n';
    criticalViolations.forEach((v, idx) => {
      message += `${idx + 1}. ${v.context}\n`;
    });
    message += '\n';
  }

  message += '### Próximos Passos:\n\n';
  message += '1. Verifique se o arquivo carregado contém todas as colunas necessárias\n';
  message += '2. Tente novamente com um dataset mais completo\n';
  message += '3. Se o problema persistir, entre em contato com o suporte\n';

  return message;
}

/**
 * Check if specific term is present in text
 */
export function containsHallucination(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

/**
 * Remove hallucinated content from text (sanitize)
 */
export function sanitizeText(text: string, forbiddenTerms: string[]): string {
  let sanitized = text;

  // Remove lines containing forbidden terms
  const lines = sanitized.split('\n');
  const cleanLines = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    return !forbiddenTerms.some(term => lowerLine.includes(term.toLowerCase()));
  });

  sanitized = cleanLines.join('\n');

  return sanitized;
}

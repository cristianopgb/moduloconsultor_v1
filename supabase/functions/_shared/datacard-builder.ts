/**
 * DATA CARD BUILDER
 * Converts legacy DataSample to formal DataCard contract
 */

import type { DataCard, ColumnMetadata, DataStats } from './analytics-contracts.ts';

export interface LegacyDataSample {
  columns: string[];
  sample_rows: any[];
  total_rows: number;
  column_types: Record<string, string>;
  stats: Record<string, any>;
}

/**
 * Convert legacy DataSample to DataCard
 */
export function buildDataCard(
  dataset_id: string,
  sample: LegacyDataSample
): DataCard {

  const columns: ColumnMetadata[] = sample.columns.map(colName => {
    const type = mapLegacyType(sample.column_types[colName] || 'text');
    const colStats = sample.stats[colName];

    const values = sample.sample_rows.map(row => row[colName]).filter(v => v != null && v !== '');
    const nullableCount = sample.sample_rows.length - values.length;
    const nullable_pct = (nullableCount / sample.sample_rows.length) * 100;

    const uniqueValues = new Set(values);
    const cardinality = uniqueValues.size;

    const metadata: ColumnMetadata = {
      name: colName,
      normalized_name: normalizeColumnName(colName),
      type,
      nullable_pct,
      cardinality,
      unique_values_sample: Array.from(uniqueValues).slice(0, 5),
    };

    if (type === 'numeric' && colStats) {
      metadata.stats = {
        min: colStats.min,
        max: colStats.max,
      };
    }

    metadata.is_candidate_key = cardinality === sample.sample_rows.length && nullable_pct < 5;

    return metadata;
  });

  const qualityScore = calculateQualityScore(columns, sample.total_rows);

  const stats: DataStats = {
    size_category: categorizeSize(sample.total_rows),
    completeness_pct: calculateCompleteness(columns),
    consistency_issues: 0,
    outliers_detected: 0,
    duplicates_detected: 0,
  };

  return {
    dataset_id,
    columns,
    totalRows: sample.total_rows,
    qualityScore,
    sampleRows: sample.sample_rows.slice(0, 10),
    stats,
    created_at: new Date().toISOString(),
  };
}

function mapLegacyType(legacyType: string): 'text' | 'numeric' | 'date' | 'boolean' | 'empty' {
  const mapping: Record<string, 'text' | 'numeric' | 'date' | 'boolean' | 'empty'> = {
    numeric: 'numeric',
    date: 'date',
    text: 'text',
    empty: 'empty',
    boolean: 'boolean',
  };
  return mapping[legacyType] || 'text';
}

function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function calculateQualityScore(columns: ColumnMetadata[], totalRows: number): number {
  let score = 100;

  const avgNullable = columns.reduce((sum, col) => sum + col.nullable_pct, 0) / columns.length;
  score -= avgNullable * 0.3;

  const emptyColumns = columns.filter(col => col.type === 'empty').length;
  score -= (emptyColumns / columns.length) * 20;

  const lowCardinalityColumns = columns.filter(col =>
    col.cardinality < 2 && col.type !== 'empty'
  ).length;
  score -= (lowCardinalityColumns / columns.length) * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateCompleteness(columns: ColumnMetadata[]): number {
  const avgCompleteness = columns.reduce((sum, col) => sum + (100 - col.nullable_pct), 0) / columns.length;
  return Math.round(avgCompleteness);
}

function categorizeSize(rows: number): 'small' | 'medium' | 'large' {
  if (rows < 10000) return 'small';
  if (rows < 100000) return 'medium';
  return 'large';
}

/**
 * Enhance DataCard with validation results
 */
export function enrichDataCardWithValidation(
  dataCard: DataCard,
  validationScore: number,
  issuesFound: number,
  outliers: number
): DataCard {
  return {
    ...dataCard,
    qualityScore: Math.min(dataCard.qualityScore, validationScore),
    stats: {
      ...dataCard.stats,
      consistency_issues: issuesFound,
      outliers_detected: outliers,
    },
  };
}

/**
 * Detect domain from column names
 */
export function detectDomain(columns: ColumnMetadata[]): 'logistics' | 'sales' | 'hr' | 'financial' | 'generic' {
  const colNames = columns.map(c => c.normalized_name).join(' ');

  const logistics_keywords = ['transportadora', 'carrier', 'entrega', 'delivery', 'otif', 'prazo', 'lead_time'];
  const sales_keywords = ['venda', 'sales', 'vendedor', 'salesperson', 'cliente', 'customer', 'receita', 'revenue'];
  const hr_keywords = ['funcionario', 'employee', 'salario', 'salary', 'cargo', 'position', 'departamento'];
  const financial_keywords = ['custo', 'cost', 'despesa', 'expense', 'lucro', 'profit', 'orcamento', 'budget'];

  const scores = {
    logistics: logistics_keywords.filter(kw => colNames.includes(kw)).length,
    sales: sales_keywords.filter(kw => colNames.includes(kw)).length,
    hr: hr_keywords.filter(kw => colNames.includes(kw)).length,
    financial: financial_keywords.filter(kw => colNames.includes(kw)).length,
  };

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'generic';

  const domain = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as any;
  return domain || 'generic';
}

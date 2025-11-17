/**
 * ===================================================================
 * UNIVERSAL FALLBACK
 * ===================================================================
 *
 * Always returns something useful when no template matches
 * Implements neutral policies: never invents columns, respects data
 * ===================================================================
 */

import type { DataCard, ExecSpec, ExecResult, Warning } from './analytics-contracts.ts';
import { execute } from './executor/index.ts';

export interface FallbackStrategy {
  name: string;
  description: string;
  canApply: (dataCard: DataCard) => boolean;
  generateSpec: (dataCard: DataCard) => ExecSpec;
}

/**
 * Detect categorical and quantitative columns
 */
function detectColumnTypes(dataCard: DataCard): {
  categorical: string[];
  quantitative: string[];
  dates: string[];
} {
  const categorical: string[] = [];
  const quantitative: string[] = [];
  const dates: string[] = [];

  for (const col of dataCard.columns) {
    if (col.type === 'date') {
      dates.push(col.name);
    } else if (col.type === 'numeric' && col.cardinality > 20) {
      // High cardinality numeric = likely a measure
      quantitative.push(col.name);
    } else if (col.cardinality > 1 && col.cardinality <= 100) {
      // Low cardinality = likely a dimension
      categorical.push(col.name);
    }
  }

  return { categorical, quantitative, dates };
}

/**
 * TOP N STRATEGY: Group by category, sum by measure, show top N + "Others"
 */
const topNStrategy: FallbackStrategy = {
  name: 'Top N with Others',
  description: 'Groups by 1-2 categorical columns, aggregates 1 quantitative column, shows top N + Others',

  canApply: (dataCard: DataCard) => {
    const { categorical, quantitative } = detectColumnTypes(dataCard);
    return categorical.length >= 1 && quantitative.length >= 1;
  },

  generateSpec: (dataCard: DataCard) => {
    const { categorical, quantitative } = detectColumnTypes(dataCard);

    // Pick first 1-2 categorical columns
    const dimensions = categorical.slice(0, 2);

    // Pick first quantitative column
    const measureColumn = quantitative[0];

    return {
      operations: [
        {
          op: 'aggregate',
          params: {
            groupBy: dimensions,
            measures: [
              {
                name: `total_${measureColumn}`,
                aggregation: 'sum',
                column: measureColumn,
              },
            ],
          },
        },
        {
          op: 'topN',
          params: {
            n: 10,
            orderBy: `total_${measureColumn}`,
            direction: 'desc',
            include_others: true,
          },
        },
      ],
      dimensions,
      measures: [
        {
          name: `total_${measureColumn}`,
          aggregation: 'sum',
          column: measureColumn,
        },
      ],
      orderBy: [
        {
          column: `total_${measureColumn}`,
          direction: 'desc',
        },
      ],
      limit: 11, // Top 10 + Others
    };
  },
};

/**
 * TIME SERIES STRATEGY: Only if date column exists
 */
const timeSeriesStrategy: FallbackStrategy = {
  name: 'Time Series',
  description: 'Aggregates by date + optional category, sums 1 quantitative column',

  canApply: (dataCard: DataCard) => {
    const { dates, quantitative } = detectColumnTypes(dataCard);
    return dates.length >= 1 && quantitative.length >= 1;
  },

  generateSpec: (dataCard: DataCard) => {
    const { categorical, quantitative, dates } = detectColumnTypes(dataCard);

    const dateColumn = dates[0];
    const dimensions = [dateColumn];

    // Optionally add 1 categorical for breakdown
    if (categorical.length > 0) {
      dimensions.push(categorical[0]);
    }

    const measureColumn = quantitative[0];

    return {
      operations: [
        {
          op: 'aggregate',
          params: {
            groupBy: dimensions,
            measures: [
              {
                name: `total_${measureColumn}`,
                aggregation: 'sum',
                column: measureColumn,
              },
            ],
          },
        },
      ],
      dimensions,
      measures: [
        {
          name: `total_${measureColumn}`,
          aggregation: 'sum',
          column: measureColumn,
        },
      ],
      orderBy: [
        {
          column: dateColumn,
          direction: 'asc',
        },
      ],
      limit: 365, // Up to 1 year of daily data
    };
  },
};

/**
 * SIMPLE PIVOT: Just count by first categorical
 */
const simplePivotStrategy: FallbackStrategy = {
  name: 'Simple Pivot',
  description: 'Groups by first categorical column, counts rows',

  canApply: (dataCard: DataCard) => {
    const { categorical } = detectColumnTypes(dataCard);
    return categorical.length >= 1;
  },

  generateSpec: (dataCard: DataCard) => {
    const { categorical } = detectColumnTypes(dataCard);
    const dimension = categorical[0];

    return {
      operations: [
        {
          op: 'aggregate',
          params: {
            groupBy: [dimension],
            measures: [
              {
                name: 'count',
                aggregation: 'count',
              },
            ],
          },
        },
      ],
      dimensions: [dimension],
      measures: [
        {
          name: 'count',
          aggregation: 'count',
        },
      ],
      orderBy: [
        {
          column: 'count',
          direction: 'desc',
        },
      ],
      limit: 20,
    };
  },
};

/**
 * SMART FALLBACK: Choose best strategy based on data
 */
export async function executeFallback(
  dataCard: DataCard,
  userQuestion?: string
): Promise<ExecResult> {
  console.log('[UniversalFallback] No template matched, executing fallback...');

  const strategies = [topNStrategy, timeSeriesStrategy, simplePivotStrategy];

  // Find first applicable strategy
  let chosenStrategy: FallbackStrategy | null = null;
  for (const strategy of strategies) {
    if (strategy.canApply(dataCard)) {
      chosenStrategy = strategy;
      break;
    }
  }

  if (!chosenStrategy) {
    console.error('[UniversalFallback] No fallback strategy applicable');
    return {
      exec_id: crypto.randomUUID(),
      success: false,
      data: [],
      warnings: [
        {
          type: 'data_quality',
          severity: 'error',
          message: 'Cannot generate analysis: dataset has no categorical or quantitative columns',
        },
      ],
      execution_time_ms: 0,
      rows_processed: 0,
      rows_returned: 0,
      created_at: new Date().toISOString(),
    };
  }

  console.log(`[UniversalFallback] Using strategy: ${chosenStrategy.name}`);

  const fallbackSpec = chosenStrategy.generateSpec(dataCard);

  const warnings: Warning[] = [
    {
      type: 'policy_applied',
      severity: 'info',
      message: `No template matched. Applied fallback strategy: ${chosenStrategy.name}`,
      details: {
        strategy: chosenStrategy.name,
        description: chosenStrategy.description,
      },
    },
  ];

  // Execute fallback
  const result = await execute(fallbackSpec, dataCard, {
    enableCache: false,
    timeout_ms: 30000,
  });

  // Add fallback warning
  return {
    ...result,
    warnings: [...warnings, ...result.warnings],
  };
}

/**
 * Check if a dataset is suitable for any analysis
 */
export function canAnalyze(dataCard: DataCard): { can: boolean; reason?: string } {
  if (dataCard.totalRows < 1) {
    return { can: false, reason: 'Dataset is empty' };
  }

  if (dataCard.columns.length < 1) {
    return { can: false, reason: 'Dataset has no columns' };
  }

  if (dataCard.qualityScore < 20) {
    return { can: false, reason: 'Dataset quality is too low (<20/100)' };
  }

  const { categorical, quantitative } = detectColumnTypes(dataCard);

  if (categorical.length === 0 && quantitative.length === 0) {
    return { can: false, reason: 'Dataset has no usable columns (no categories or measures)' };
  }

  return { can: true };
}

/**
 * Get suggested fallback strategy (without executing)
 */
export function suggestFallbackStrategy(dataCard: DataCard): string {
  const strategies = [topNStrategy, timeSeriesStrategy, simplePivotStrategy];

  for (const strategy of strategies) {
    if (strategy.canApply(dataCard)) {
      return strategy.name;
    }
  }

  return 'None (dataset unsuitable for analysis)';
}

// Query DSL (Domain Specific Language) for dataset queries
// This provides a safe, validated intermediate format between natural language and SQL

export type ColumnRole = 'dimension' | 'measure' | 'time' | 'identifier'

export type ColumnType = 'numeric' | 'text' | 'date' | 'boolean' | 'mixed'

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'between' | 'date_between'

export type AggregationOperation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct'

export type TimeGranularity = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

export type PostOperation = 'percent_of_total' | 'rank' | 'cumulative' | 'moving_average'

export interface ColumnMetadata {
  name: string
  type: ColumnType
  role?: ColumnRole
  nullable: boolean
  null_percentage: number
  unique_count: number
  cardinality: number
  sample_values: string[]
  synonyms?: string[]
  min?: number
  max?: number
  mean?: number
  median?: number
  std_dev?: number
}

export interface DatasetCatalog {
  dataset_id: string
  row_count: number
  column_count: number
  columns: ColumnMetadata[]
  quality_score: number
  warnings: string[]
}

export interface QueryFilter {
  column: string
  operator: FilterOperator
  value: any
  value2?: any // For 'between' operations
}

export interface TimeBucket {
  column: string
  granularity: TimeGranularity
}

export interface Measure {
  operation: AggregationOperation
  column?: string // Optional for 'count'
  alias: string
}

export interface RatioMeasure {
  operation: 'ratio'
  numerator: Measure
  denominator: Measure
  safe_zero?: boolean
  alias: string
}

export interface OrderBy {
  column: string
  direction: 'asc' | 'desc'
}

export interface QueryDSL {
  dataset_id: string
  filters?: QueryFilter[]
  group_by?: string[]
  time_bucket?: TimeBucket
  measures: (Measure | RatioMeasure)[]
  order_by?: OrderBy[]
  limit?: number
  post_ops?: PostOperation[]
}

export interface QueryValidationError {
  field: string
  message: string
  suggestion?: string
}

export interface QueryValidationResult {
  valid: boolean
  errors: QueryValidationError[]
  warnings?: string[]
}

export interface QueryExecutionResult {
  columns: string[]
  rows: any[][]
  row_count: number
  execution_time_ms: number
  was_limited: boolean
  actual_limit?: number
}

export interface QueryAnalysisResponse {
  dsl: QueryDSL
  catalog_summary: {
    dataset_id: string
    row_count: number
    columns_used: string[]
  }
  validation: QueryValidationResult
  result?: QueryExecutionResult
  sql_generated?: string // For debugging
  explanation?: string // Natural language explanation of what was done
}

// Validation constants
export const MAX_GROUP_BY_CARDINALITY = 5000
export const MAX_RESULT_ROWS = 10000
export const MAX_QUERY_TIMEOUT_MS = 30000
export const MAX_GROUP_BY_COLUMNS = 5

// Validation functions
export function validateQueryDSL(dsl: QueryDSL, catalog: DatasetCatalog): QueryValidationResult {
  const errors: QueryValidationError[] = []
  const warnings: string[] = []

  // Validate dataset_id
  if (!dsl.dataset_id || dsl.dataset_id !== catalog.dataset_id) {
    errors.push({
      field: 'dataset_id',
      message: 'Invalid or missing dataset_id',
      suggestion: `Use dataset_id: ${catalog.dataset_id}`
    })
  }

  // Validate filters
  if (dsl.filters) {
    for (const filter of dsl.filters) {
      const column = catalog.columns.find(c => c.name === filter.column)
      if (!column) {
        errors.push({
          field: 'filters',
          message: `Column '${filter.column}' not found in dataset`,
          suggestion: `Available columns: ${catalog.columns.map(c => c.name).join(', ')}`
        })
      }
    }
  }

  // Validate group_by
  if (dsl.group_by) {
    if (dsl.group_by.length > MAX_GROUP_BY_COLUMNS) {
      errors.push({
        field: 'group_by',
        message: `Too many group_by columns (max ${MAX_GROUP_BY_COLUMNS})`,
        suggestion: 'Reduce the number of grouping dimensions'
      })
    }

    for (const colName of dsl.group_by) {
      const column = catalog.columns.find(c => c.name === colName)
      if (!column) {
        errors.push({
          field: 'group_by',
          message: `Column '${colName}' not found in dataset`,
          suggestion: `Available columns: ${catalog.columns.map(c => c.name).join(', ')}`
        })
      } else if (column.cardinality > MAX_GROUP_BY_CARDINALITY) {
        warnings.push(`Column '${colName}' has high cardinality (${column.cardinality}), query may be slow`)
      }
    }
  }

  // Validate time_bucket
  if (dsl.time_bucket) {
    const column = catalog.columns.find(c => c.name === dsl.time_bucket!.column)
    if (!column) {
      errors.push({
        field: 'time_bucket',
        message: `Column '${dsl.time_bucket.column}' not found in dataset`,
        suggestion: `Available columns: ${catalog.columns.map(c => c.name).join(', ')}`
      })
    } else if (column.type !== 'date') {
      errors.push({
        field: 'time_bucket',
        message: `Column '${dsl.time_bucket.column}' is not a date column`,
        suggestion: `Available date columns: ${catalog.columns.filter(c => c.type === 'date').map(c => c.name).join(', ') || 'none'}`
      })
    }
  }

  // Validate measures
  if (!dsl.measures || dsl.measures.length === 0) {
    errors.push({
      field: 'measures',
      message: 'At least one measure is required',
      suggestion: 'Add sum, avg, count, or other aggregation'
    })
  } else {
    for (const measure of dsl.measures) {
      if ('numerator' in measure) {
        // Ratio measure
        const ratioMeasure = measure as RatioMeasure
        // Validate numerator and denominator recursively
        // (simplified validation for now)
        continue
      }

      const simpleMeasure = measure as Measure
      if (simpleMeasure.operation !== 'count' && !simpleMeasure.column) {
        errors.push({
          field: 'measures',
          message: `Operation '${simpleMeasure.operation}' requires a column`,
          suggestion: 'Specify which column to aggregate'
        })
        continue
      }

      if (simpleMeasure.column) {
        const column = catalog.columns.find(c => c.name === simpleMeasure.column)
        if (!column) {
          errors.push({
            field: 'measures',
            message: `Column '${simpleMeasure.column}' not found in dataset`,
            suggestion: `Available columns: ${catalog.columns.map(c => c.name).join(', ')}`
          })
        } else if (['sum', 'avg', 'min', 'max'].includes(simpleMeasure.operation) && column.type !== 'numeric') {
          errors.push({
            field: 'measures',
            message: `Operation '${simpleMeasure.operation}' requires a numeric column`,
            suggestion: `Available numeric columns: ${catalog.columns.filter(c => c.type === 'numeric').map(c => c.name).join(', ') || 'none'}`
          })
        }
      }
    }
  }

  // Validate order_by
  if (dsl.order_by) {
    for (const order of dsl.order_by) {
      // Check if it's a column from group_by or a measure alias
      const isGroupByColumn = dsl.group_by?.includes(order.column)
      const isMeasureAlias = dsl.measures.some(m => m.alias === order.column)

      if (!isGroupByColumn && !isMeasureAlias) {
        errors.push({
          field: 'order_by',
          message: `Column '${order.column}' must be in group_by or be a measure alias`,
          suggestion: 'Order by columns that are in the result set'
        })
      }
    }
  }

  // Validate limit
  if (dsl.limit && dsl.limit > MAX_RESULT_ROWS) {
    warnings.push(`Limit ${dsl.limit} exceeds maximum ${MAX_RESULT_ROWS}, will be capped`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

export function buildCatalogFromStatisticalSummary(
  datasetId: string,
  summary: any
): DatasetCatalog {
  const columns: ColumnMetadata[] = []

  if (summary.columns && Array.isArray(summary.columns)) {
    for (const col of summary.columns) {
      const totalCount = col.stats?.null_count !== undefined
        ? col.count || 0
        : summary.total_rows || 0

      const nullCount = col.stats?.null_count || 0
      const uniqueCount = col.stats?.unique_count || 0

      // Infer role based on type and cardinality
      let role: ColumnRole = 'dimension'
      if (col.type === 'numeric') {
        role = 'measure'
      } else if (col.type === 'date') {
        role = 'time'
      } else if (uniqueCount === totalCount && totalCount > 100) {
        role = 'identifier'
      }

      columns.push({
        name: col.name,
        type: col.type as ColumnType,
        role,
        nullable: nullCount > 0,
        null_percentage: totalCount > 0 ? (nullCount / totalCount) * 100 : 0,
        unique_count: uniqueCount,
        cardinality: uniqueCount,
        sample_values: col.sample_values || [],
        min: col.stats?.min,
        max: col.stats?.max,
        mean: col.stats?.mean,
        median: col.stats?.median,
        std_dev: col.stats?.std_dev
      })
    }
  }

  return {
    dataset_id: datasetId,
    row_count: summary.total_rows || 0,
    column_count: summary.total_columns || 0,
    columns,
    quality_score: summary.data_quality_score || 0,
    warnings: summary.warnings || []
  }
}

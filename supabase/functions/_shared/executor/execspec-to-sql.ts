/**
 * ===================================================================
 * EXECSPEC TO SQL TRANSLATOR
 * ===================================================================
 *
 * Converts ExecSpec (DSL) to safe, valid PostgreSQL
 *
 * Supported Operations:
 * - aggregate: GROUP BY with aggregation functions
 * - topN: Top-N with LIMIT + ORDER BY
 * - filter: WHERE clauses
 * - window: Window functions (ROW_NUMBER, RANK, etc)
 * ===================================================================
 */

import type { ExecSpec, Filter, Aggregation, TopNSpec, WindowFunction } from '../analytics-contracts.ts';
import { normalizeColumnName } from '../../analyze-file/sql-sanitizer.ts';

/**
 * Main translation function
 */
export function execSpecToSQL(execSpec: ExecSpec, dataset_id: string): string {
  const parts: string[] = [];

  // SELECT clause
  const selectClause = buildSelectClause(execSpec);
  parts.push(`SELECT ${selectClause}`);

  // FROM clause
  parts.push(`FROM dataset_rows`);

  // WHERE clause (always filter by dataset_id)
  const whereClause = buildWhereClause(execSpec, dataset_id);
  parts.push(`WHERE dataset_id = '${dataset_id}'::uuid`);
  if (whereClause) {
    parts.push(`AND ${whereClause}`);
  }

  // GROUP BY clause
  if (execSpec.dimensions.length > 0 || execSpec.aggregations) {
    const groupByClause = buildGroupByClause(execSpec);
    if (groupByClause) {
      parts.push(`GROUP BY ${groupByClause}`);
    }
  }

  // ORDER BY clause
  if (execSpec.orderBy && execSpec.orderBy.length > 0) {
    const orderByClause = buildOrderByClause(execSpec);
    parts.push(`ORDER BY ${orderByClause}`);
  }

  // LIMIT clause
  if (execSpec.limit) {
    parts.push(`LIMIT ${Math.min(execSpec.limit, 100000)}`);
  }

  return parts.join('\n');
}

/**
 * Build SELECT clause with measures and dimensions
 */
function buildSelectClause(execSpec: ExecSpec): string {
  const columns: string[] = [];

  // Add dimensions
  execSpec.dimensions.forEach(dim => {
    const normalized = normalizeColumnName(dim);
    columns.push(`data->${normalized} AS ${normalized}`);
  });

  // Add measures (aggregations)
  if (execSpec.aggregations) {
    execSpec.aggregations.forEach(agg => {
      const aggSQL = buildAggregationSQL(agg);
      columns.push(aggSQL);
    });
  } else if (execSpec.measures.length > 0) {
    execSpec.measures.forEach(measure => {
      const measureSQL = buildMeasureSQL(measure);
      columns.push(measureSQL);
    });
  }

  // Add window functions if present
  if (execSpec.windowFunctions && execSpec.windowFunctions.length > 0) {
    execSpec.windowFunctions.forEach(win => {
      const winSQL = buildWindowFunctionSQL(win);
      columns.push(winSQL);
    });
  }

  // If no columns specified, select all
  if (columns.length === 0) {
    return 'data';
  }

  return columns.join(',\n  ');
}

/**
 * Build WHERE clause from filters
 */
function buildWhereClause(execSpec: ExecSpec, dataset_id: string): string | null {
  if (!execSpec.filters || execSpec.filters.length === 0) {
    return null;
  }

  const conditions = execSpec.filters.map(filter => buildFilterSQL(filter));
  return conditions.join(' AND ');
}

/**
 * Build single filter condition
 */
function buildFilterSQL(filter: Filter): string {
  const column = normalizeColumnName(filter.column);

  switch (filter.operator) {
    case '=':
      return `data->>${column} = '${sanitizeValue(filter.value)}'`;
    case '!=':
      return `data->>${column} != '${sanitizeValue(filter.value)}'`;
    case '>':
      return `(data->>${column})::numeric > ${sanitizeNumeric(filter.value)}`;
    case '>=':
      return `(data->>${column})::numeric >= ${sanitizeNumeric(filter.value)}`;
    case '<':
      return `(data->>${column})::numeric < ${sanitizeNumeric(filter.value)}`;
    case '<=':
      return `(data->>${column})::numeric <= ${sanitizeNumeric(filter.value)}`;
    case 'in':
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      const escaped = values.map(v => `'${sanitizeValue(v)}'`).join(', ');
      return `data->>${column} IN (${escaped})`;
    case 'not_in':
      const notValues = Array.isArray(filter.value) ? filter.value : [filter.value];
      const notEscaped = notValues.map(v => `'${sanitizeValue(v)}'`).join(', ');
      return `data->>${column} NOT IN (${notEscaped})`;
    case 'like':
      return `data->>${column} LIKE '%${sanitizeValue(filter.value)}%'`;
    case 'between':
      if (Array.isArray(filter.value) && filter.value.length === 2) {
        return `(data->>${column})::numeric BETWEEN ${sanitizeNumeric(filter.value[0])} AND ${sanitizeNumeric(filter.value[1])}`;
      }
      return 'TRUE';
    case 'is_null':
      return `data->>${column} IS NULL`;
    case 'is_not_null':
      return `data->>${column} IS NOT NULL`;
    default:
      return 'TRUE';
  }
}

/**
 * Build GROUP BY clause
 */
function buildGroupByClause(execSpec: ExecSpec): string | null {
  if (execSpec.dimensions.length === 0) {
    return null;
  }

  const groups = execSpec.dimensions.map((dim, idx) => `${idx + 1}`);
  return groups.join(', ');
}

/**
 * Build ORDER BY clause
 */
function buildOrderByClause(execSpec: ExecSpec): string {
  if (!execSpec.orderBy || execSpec.orderBy.length === 0) {
    return '';
  }

  const orders = execSpec.orderBy.map(order => {
    const normalized = normalizeColumnName(order.column);
    return `${normalized} ${order.direction.toUpperCase()}`;
  });

  return orders.join(', ');
}

/**
 * Build aggregation SQL
 */
function buildAggregationSQL(agg: Aggregation): string {
  const column = normalizeColumnName(agg.column);
  const func = agg.function.toUpperCase();

  let sql = '';

  switch (func) {
    case 'SUM':
      sql = `SUM((data->>${column})::numeric)`;
      break;
    case 'AVG':
      sql = `AVG((data->>${column})::numeric)`;
      break;
    case 'COUNT':
      sql = `COUNT(*)`;
      break;
    case 'MIN':
      sql = `MIN((data->>${column})::numeric)`;
      break;
    case 'MAX':
      sql = `MAX((data->>${column})::numeric)`;
      break;
    case 'COUNT_DISTINCT':
      sql = `COUNT(DISTINCT data->>${column})`;
      break;
    default:
      sql = `COUNT(*)`;
  }

  return `${sql} AS ${agg.alias}`;
}

/**
 * Build measure SQL
 */
function buildMeasureSQL(measure: any): string {
  if (measure.formula) {
    // Custom formula (need to parse and convert)
    return `${measure.formula} AS ${measure.name}`;
  }

  const column = measure.column ? normalizeColumnName(measure.column) : '*';
  const func = measure.aggregation.toUpperCase();

  let sql = '';

  switch (func) {
    case 'SUM':
      sql = `SUM((data->>${column})::numeric)`;
      break;
    case 'AVG':
      sql = `AVG((data->>${column})::numeric)`;
      break;
    case 'COUNT':
      sql = `COUNT(*)`;
      break;
    case 'MIN':
      sql = `MIN((data->>${column})::numeric)`;
      break;
    case 'MAX':
      sql = `MAX((data->>${column})::numeric)`;
      break;
    default:
      sql = `COUNT(*)`;
  }

  return `${sql} AS ${measure.name}`;
}

/**
 * Build window function SQL
 */
function buildWindowFunctionSQL(win: WindowFunction): string {
  const func = win.function.toUpperCase();
  const orderBy = normalizeColumnName(win.orderBy);

  let partitionClause = '';
  if (win.partitionBy && win.partitionBy.length > 0) {
    const partitions = win.partitionBy.map(p => normalizeColumnName(p)).join(', ');
    partitionClause = `PARTITION BY ${partitions}`;
  }

  let sql = '';

  switch (func) {
    case 'ROW_NUMBER':
      sql = `ROW_NUMBER() OVER (${partitionClause} ORDER BY ${orderBy})`;
      break;
    case 'RANK':
      sql = `RANK() OVER (${partitionClause} ORDER BY ${orderBy})`;
      break;
    case 'DENSE_RANK':
      sql = `DENSE_RANK() OVER (${partitionClause} ORDER BY ${orderBy})`;
      break;
    case 'LAG':
      sql = `LAG(data->>${orderBy}) OVER (${partitionClause} ORDER BY ${orderBy})`;
      break;
    case 'LEAD':
      sql = `LEAD(data->>${orderBy}) OVER (${partitionClause} ORDER BY ${orderBy})`;
      break;
    default:
      sql = `ROW_NUMBER() OVER (ORDER BY ${orderBy})`;
  }

  return `${sql} AS ${win.alias}`;
}

/**
 * Sanitize string value for SQL
 */
function sanitizeValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/'/g, "''");
}

/**
 * Sanitize numeric value
 */
function sanitizeNumeric(value: any): number {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Generate simple aggregate query
 */
export function generateSimpleAggregateSQL(
  dataset_id: string,
  dimensions: string[],
  measures: { column: string; aggregation: string; alias: string }[]
): string {
  const execSpec: ExecSpec = {
    operations: [{ op: 'aggregate', params: {} }],
    dimensions,
    measures: measures.map(m => ({
      name: m.alias,
      aggregation: m.aggregation as any,
      column: m.column,
    })),
  };

  return execSpecToSQL(execSpec, dataset_id);
}

/**
 * Generate Top-N query
 */
export function generateTopNSQL(
  dataset_id: string,
  orderByColumn: string,
  n: number = 10,
  direction: 'asc' | 'desc' = 'desc'
): string {
  const execSpec: ExecSpec = {
    operations: [{ op: 'topN', params: { n, orderBy: orderByColumn } }],
    dimensions: [orderByColumn],
    measures: [],
    orderBy: [{ column: orderByColumn, direction }],
    limit: n,
  };

  return execSpecToSQL(execSpec, dataset_id);
}

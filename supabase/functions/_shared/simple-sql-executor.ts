/**
 * SIMPLE SQL EXECUTOR - Execute SQL queries on in-memory data
 *
 * Supports:
 * - SELECT with column selection
 * - WHERE clauses (basic comparisons)
 * - GROUP BY with aggregations (SUM, AVG, COUNT, MIN, MAX)
 * - ORDER BY
 * - LIMIT
 *
 * NO external dependencies - pure TypeScript implementation
 */

interface ColumnInfo {
  name: string;
  type: 'numeric' | 'text' | 'date' | 'unknown';
}

interface SQLResult {
  success: boolean;
  data: any[];
  rowCount: number;
  error?: string;
  executionTimeMs: number;
}

/**
 * Execute SQL query on array of objects
 */
export function executeSQL(data: any[], sql: string, columnTypes: Record<string, string>): SQLResult {
  const startTime = Date.now();

  try {
    // Parse SQL (very basic parser)
    const query = parseSQL(sql);

    // Execute query stages
    let result = [...data];

    // WHERE clause
    if (query.where) {
      result = result.filter(row => evaluateWhere(row, query.where!, columnTypes));
    }

    // Check if query has aggregations
    const hasAggregations = query.select.some((col: any) => col.aggregation);
    const hasNonAggregations = query.select.some((col: any) => !col.aggregation);

    // GROUP BY
    if (query.groupBy && query.groupBy.length > 0) {
      result = executeGroupBy(result, query.groupBy, query.select, columnTypes);
    } else if (hasAggregations && !hasNonAggregations) {
      // Aggregation without GROUP BY - calculate totals across entire dataset
      result = [executeTotalAggregations(result, query.select, columnTypes)];
    } else if (hasAggregations && hasNonAggregations) {
      // Mix of aggregated and non-aggregated columns without GROUP BY
      // This is invalid SQL - the non-aggregated columns should be in GROUP BY
      const nonAggCols = query.select.filter((col: any) => !col.aggregation).map((col: any) => col.column);
      throw new Error(`Aggregation requires GROUP BY. Add: GROUP BY ${nonAggCols.join(', ')}`);
    } else {
      // Simple SELECT without aggregations
      result = result.map(row => {
        const newRow: any = {};
        query.select.forEach(col => {
          newRow[col.alias || col.column] = row[col.column];
        });
        return newRow;
      });
    }

    // ORDER BY
    if (query.orderBy && query.orderBy.length > 0) {
      result.sort((a, b) => {
        for (const order of query.orderBy!) {
          const aVal = a[order.column];
          const bVal = b[order.column];
          const comparison = compareValues(aVal, bVal, columnTypes[order.column] || 'text');
          if (comparison !== 0) {
            return order.direction === 'DESC' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    // LIMIT
    if (query.limit) {
      result = result.slice(0, query.limit);
    }

    return {
      success: true,
      data: result,
      rowCount: result.length,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      data: [],
      rowCount: 0,
      error: error.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Basic SQL parser (handles simple queries)
 */
function parseSQL(sql: string): any {
  const normalized = sql.trim().replace(/\s+/g, ' ');

  // Extract SELECT columns
  const selectMatch = normalized.match(/SELECT\s+(.+?)\s+FROM/i);
  if (!selectMatch) throw new Error('Invalid SELECT syntax');

  const selectPart = selectMatch[1];
  const select = parseSelectColumns(selectPart);

  // Extract WHERE
  let where = null;
  const whereMatch = normalized.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|$)/i);
  if (whereMatch) {
    where = whereMatch[1].trim();
  }

  // Extract GROUP BY
  let groupBy: string[] = [];
  const groupByMatch = normalized.match(/GROUP BY\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|$)/i);
  if (groupByMatch) {
    groupBy = groupByMatch[1].split(',').map(c => c.trim());
  }

  // Extract ORDER BY
  let orderBy: any[] = [];
  const orderByMatch = normalized.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|$)/i);
  if (orderByMatch) {
    const orderCols = orderByMatch[1].split(',');
    orderBy = orderCols.map(col => {
      const parts = col.trim().split(/\s+/);
      return {
        column: parts[0],
        direction: parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      };
    });
  }

  // Extract LIMIT
  let limit = null;
  const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1]);
  }

  return { select, where, groupBy, orderBy, limit };
}

/**
 * Parse SELECT columns (including aggregations)
 */
function parseSelectColumns(selectPart: string): any[] {
  const columns: any[] = [];
  const parts = selectPart.split(',');

  for (const part of parts) {
    const trimmed = part.trim();

    // Check for aggregation: SUM(col), AVG(col), etc.
    const aggMatch = trimmed.match(/(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*([^)]+)\s*\)(?:\s+AS\s+(\w+))?/i);
    if (aggMatch) {
      columns.push({
        aggregation: aggMatch[1].toUpperCase(),
        column: aggMatch[2].trim(),
        alias: aggMatch[3] || `${aggMatch[1].toLowerCase()}_${aggMatch[2].trim()}`,
      });
    } else {
      // Simple column or column AS alias
      const aliasMatch = trimmed.match(/(.+?)\s+AS\s+(\w+)/i);
      if (aliasMatch) {
        columns.push({
          column: aliasMatch[1].trim(),
          alias: aliasMatch[2].trim(),
        });
      } else {
        columns.push({ column: trimmed });
      }
    }
  }

  return columns;
}

/**
 * Evaluate WHERE clause for a row
 */
function evaluateWhere(row: any, whereClause: string, columnTypes: Record<string, string>): boolean {
  // Very basic WHERE evaluation
  // Supports: column = value, column > value, column < value, AND, OR

  // Split by AND/OR
  const conditions = whereClause.split(/\s+(AND|OR)\s+/i);

  let result = true;
  let operator = 'AND';

  for (const condition of conditions) {
    if (condition.toUpperCase() === 'AND' || condition.toUpperCase() === 'OR') {
      operator = condition.toUpperCase();
      continue;
    }

    const condResult = evaluateCondition(row, condition.trim(), columnTypes);

    if (operator === 'AND') {
      result = result && condResult;
    } else {
      result = result || condResult;
    }
  }

  return result;
}

/**
 * Evaluate single condition
 */
function evaluateCondition(row: any, condition: string, columnTypes: Record<string, string>): boolean {
  // Parse: column operator value
  const match = condition.match(/(\w+)\s*(=|!=|>|<|>=|<=)\s*(.+)/);
  if (!match) return true;

  const [, column, operator, valueStr] = match;
  const rowValue = row[column];

  // Parse value (remove quotes if string)
  let value: any = valueStr.trim();
  if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  } else if (!isNaN(Number(value))) {
    value = Number(value);
  }

  // Compare
  switch (operator) {
    case '=':
      return rowValue == value;
    case '!=':
      return rowValue != value;
    case '>':
      return Number(rowValue) > Number(value);
    case '<':
      return Number(rowValue) < Number(value);
    case '>=':
      return Number(rowValue) >= Number(value);
    case '<=':
      return Number(rowValue) <= Number(value);
    default:
      return true;
  }
}

/**
 * Execute GROUP BY with aggregations
 */
function executeGroupBy(
  data: any[],
  groupByColumns: string[],
  selectColumns: any[],
  columnTypes: Record<string, string>
): any[] {
  // Group data
  const groups = new Map<string, any[]>();

  for (const row of data) {
    const key = groupByColumns.map(col => String(row[col] ?? '')).join('|||');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  // Aggregate each group
  const results: any[] = [];

  for (const [key, groupRows] of groups) {
    const result: any = {};

    // Add GROUP BY columns
    const keyParts = key.split('|||');
    groupByColumns.forEach((col, idx) => {
      result[col] = keyParts[idx];
    });

    // Calculate aggregations
    for (const selectCol of selectColumns) {
      if (selectCol.aggregation) {
        const alias = selectCol.alias || selectCol.column;
        result[alias] = calculateAggregation(
          groupRows,
          selectCol.column,
          selectCol.aggregation,
          columnTypes[selectCol.column] || 'numeric'
        );
      } else if (!groupByColumns.includes(selectCol.column)) {
        // Non-aggregated, non-grouped column - take first value
        result[selectCol.alias || selectCol.column] = groupRows[0][selectCol.column];
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Execute total aggregations (without GROUP BY)
 * Returns a single row with all aggregated values
 */
function executeTotalAggregations(
  data: any[],
  selectColumns: any[],
  columnTypes: Record<string, string>
): any {
  const result: any = {};

  for (const selectCol of selectColumns) {
    if (selectCol.aggregation) {
      const alias = selectCol.alias || selectCol.column;

      // Handle COUNT(*) specially
      if (selectCol.aggregation === 'COUNT' && selectCol.column === '*') {
        result[alias] = data.length;
      } else {
        result[alias] = calculateAggregation(
          data,
          selectCol.column,
          selectCol.aggregation,
          columnTypes[selectCol.column] || 'numeric'
        );
      }
    }
  }

  return result;
}

/**
 * Calculate aggregation for a group
 */
function calculateAggregation(rows: any[], column: string, aggregation: string, columnType: string): any {
  // Handle COUNT(*) - just count all rows
  if (aggregation === 'COUNT' && column === '*') {
    return rows.length;
  }

  const values = rows.map(r => r[column]).filter(v => v != null && v !== '');

  if (values.length === 0) return null;

  switch (aggregation) {
    case 'COUNT':
      return values.length;

    case 'SUM':
      return values.reduce((sum, v) => sum + Number(v), 0);

    case 'AVG':
      const sum = values.reduce((sum, v) => sum + Number(v), 0);
      return sum / values.length;

    case 'MIN':
      return Math.min(...values.map(Number));

    case 'MAX':
      return Math.max(...values.map(Number));

    default:
      return null;
  }
}

/**
 * Compare two values based on type
 */
function compareValues(a: any, b: any, type: string): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (type === 'numeric') {
    return Number(a) - Number(b);
  } else if (type === 'date') {
    return new Date(a).getTime() - new Date(b).getTime();
  } else {
    return String(a).localeCompare(String(b));
  }
}

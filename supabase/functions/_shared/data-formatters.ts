/**
 * DATA FORMATTERS
 *
 * Intelligent data formatting for professional reports
 * Automatically detects data types and applies appropriate formatting
 */

export interface FormattedValue {
  raw: any;
  formatted: string;
  type: 'currency' | 'percentage' | 'number' | 'date' | 'text';
}

/**
 * Detect column type based on name and values
 */
export function detectColumnType(columnName: string, sampleValues: any[]): string {
  const lowerName = columnName.toLowerCase();

  // Currency detection
  if (lowerName.match(/receita|custo|valor|preco|price|revenue|cost|faturamento|venda|sale/)) {
    return 'currency';
  }

  // Percentage detection
  if (lowerName.match(/taxa|percent|margem|roi|ctr|conversao|conversion|rate/)) {
    return 'percentage';
  }

  // Date detection
  if (lowerName.match(/data|date|periodo|period|mes|month|ano|year|dia|day/)) {
    return 'date';
  }

  // Quantity detection
  if (lowerName.match(/quantidade|qtd|qty|unidade|unit|volume|count/)) {
    return 'quantity';
  }

  // Check sample values
  if (sampleValues && sampleValues.length > 0) {
    const firstNonNull = sampleValues.find(v => v != null);
    if (firstNonNull) {
      if (typeof firstNonNull === 'number') {
        // Check if values look like percentages (0-100 or 0-1)
        const numbers = sampleValues.filter(v => typeof v === 'number');
        const allBetween0And100 = numbers.every(n => n >= 0 && n <= 100);
        const allBetween0And1 = numbers.every(n => n >= 0 && n <= 1);

        if (allBetween0And1 && !allBetween0And100) {
          return 'percentage';
        }
      }
    }
  }

  return 'number';
}

/**
 * Format currency value (Brazilian Real)
 */
export function formatCurrency(value: any, decimals: number = 2): string {
  if (value == null || value === '') return '-';

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return value.toString();

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * Format percentage value
 */
export function formatPercentage(value: any, decimals: number = 1, isDecimal: boolean = false): string {
  if (value == null || value === '') return '-';

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return value.toString();

  // If value is between 0-1, assume it's a decimal percentage (multiply by 100)
  const percentage = isDecimal || (num >= 0 && num <= 1) ? num * 100 : num;

  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Format number with thousand separators
 */
export function formatNumber(value: any, decimals: number = 0): string {
  if (value == null || value === '') return '-';

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return value.toString();

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * Format number in compact notation (K, M, B)
 */
export function formatCompact(value: any): string {
  if (value == null || value === '') return '-';

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return value.toString();

  const absNum = Math.abs(num);

  if (absNum >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  } else if (absNum >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (absNum >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }

  return formatNumber(num, 1);
}

/**
 * Format date to Brazilian standard
 */
export function formatDate(value: any): string {
  if (value == null || value === '') return '-';

  try {
    const date = typeof value === 'string' ? new Date(value) : value;

    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return value.toString();
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch {
    return value.toString();
  }
}

/**
 * Format date to month/year
 */
export function formatMonthYear(value: any): string {
  if (value == null || value === '') return '-';

  try {
    const date = typeof value === 'string' ? new Date(value) : value;

    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return value.toString();
    }

    return new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return value.toString();
  }
}

/**
 * Intelligently format value based on detected type
 */
export function formatValue(value: any, columnName: string, detectedType?: string): FormattedValue {
  const type = detectedType || detectColumnType(columnName, [value]);

  let formatted: string;

  switch (type) {
    case 'currency':
      formatted = formatCurrency(value);
      break;
    case 'percentage':
      formatted = formatPercentage(value);
      break;
    case 'date':
      formatted = formatDate(value);
      break;
    case 'quantity':
      formatted = formatNumber(value, 0);
      break;
    default:
      if (typeof value === 'number') {
        formatted = formatNumber(value, 2);
      } else {
        formatted = value?.toString() || '-';
      }
  }

  return {
    raw: value,
    formatted,
    type: type as any
  };
}

/**
 * Format entire row of data
 */
export function formatRow(row: Record<string, any>, columnTypes?: Record<string, string>): Record<string, FormattedValue> {
  const formatted: Record<string, FormattedValue> = {};

  for (const [key, value] of Object.entries(row)) {
    const detectedType = columnTypes?.[key];
    formatted[key] = formatValue(value, key, detectedType);
  }

  return formatted;
}

/**
 * Format array of rows
 */
export function formatRows(rows: any[], columnTypes?: Record<string, string>): Array<Record<string, FormattedValue>> {
  return rows.map(row => formatRow(row, columnTypes));
}

/**
 * Create formatting config for Chart.js
 */
export function createChartFormatConfig(columnName: string): any {
  const type = detectColumnType(columnName, []);

  switch (type) {
    case 'currency':
      return {
        callback: (value: any) => formatCurrency(value, 0)
      };
    case 'percentage':
      return {
        callback: (value: any) => formatPercentage(value, 1)
      };
    case 'quantity':
      return {
        callback: (value: any) => formatNumber(value, 0)
      };
    default:
      return {
        callback: (value: any) => formatNumber(value, 1)
      };
  }
}

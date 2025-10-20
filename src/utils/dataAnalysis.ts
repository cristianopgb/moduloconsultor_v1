export interface ColumnStats {
  name: string
  type: 'numeric' | 'text' | 'date' | 'boolean' | 'mixed'
  count: number
  nullCount: number
  uniqueCount: number
  min?: number
  max?: number
  mean?: number
  median?: number
  mode?: string | number
  stdDev?: number
  variance?: number
  q1?: number
  q3?: number
  topValues?: Array<{ value: any; count: number }>
}

export interface DatasetSummary {
  rowCount: number
  columnCount: number
  columns: ColumnStats[]
  dataQualityScore: number
  warnings: string[]
  sampleRows: any[]
}

function detectColumnType(values: any[]): ColumnStats['type'] {
  const nonNull = values.filter(v => v != null && v !== '')
  if (nonNull.length === 0) return 'text'

  let numericCount = 0
  let dateCount = 0
  let booleanCount = 0

  for (const val of nonNull.slice(0, 100)) {
    const str = String(val).trim()

    if (str === 'true' || str === 'false' || str === '1' || str === '0') {
      booleanCount++
    }

    if (!isNaN(Number(str)) && str !== '') {
      numericCount++
    }

    if (!isNaN(Date.parse(str)) && /\d{4}/.test(str)) {
      dateCount++
    }
  }

  const total = Math.min(nonNull.length, 100)
  if (numericCount / total > 0.8) return 'numeric'
  if (dateCount / total > 0.8) return 'date'
  if (booleanCount / total > 0.8) return 'boolean'

  return 'text'
}

function calculateNumericStats(values: number[]): Partial<ColumnStats> {
  if (values.length === 0) return {}

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((acc, val) => acc + val, 0)
  const mean = sum / values.length

  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    q1: sorted[q1Index],
    q3: sorted[q3Index]
  }
}

function calculateMode(values: any[]): any {
  const frequency: Record<string, number> = {}

  for (const val of values) {
    const key = String(val)
    frequency[key] = (frequency[key] || 0) + 1
  }

  let maxCount = 0
  let mode: any = null

  for (const [key, count] of Object.entries(frequency)) {
    if (count > maxCount) {
      maxCount = count
      mode = key
    }
  }

  return mode
}

function getTopValues(values: any[], limit = 5): Array<{ value: any; count: number }> {
  const frequency: Record<string, number> = {}

  for (const val of values) {
    if (val == null || val === '') continue
    const key = String(val)
    frequency[key] = (frequency[key] || 0) + 1
  }

  return Object.entries(frequency)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function analyzeColumn(name: string, values: any[]): ColumnStats {
  const type = detectColumnType(values)
  const nullCount = values.filter(v => v == null || v === '').length
  const nonNullValues = values.filter(v => v != null && v !== '')
  const uniqueValues = new Set(nonNullValues.map(v => String(v)))

  const stats: ColumnStats = {
    name,
    type,
    count: values.length,
    nullCount,
    uniqueCount: uniqueValues.size
  }

  if (type === 'numeric') {
    const numericValues = nonNullValues
      .map(v => Number(v))
      .filter(v => !isNaN(v))

    Object.assign(stats, calculateNumericStats(numericValues))
  }

  if (type === 'text' || type === 'mixed') {
    stats.mode = calculateMode(nonNullValues)
    stats.topValues = getTopValues(nonNullValues)
  }

  return stats
}

export function analyzeDataset(data: any[], maxSampleRows = 100): DatasetSummary {
  if (!data || data.length === 0) {
    return {
      rowCount: 0,
      columnCount: 0,
      columns: [],
      dataQualityScore: 0,
      warnings: ['Dataset vazio'],
      sampleRows: []
    }
  }

  const columnNames = Object.keys(data[0])
  const columns: ColumnStats[] = []
  const warnings: string[] = []

  for (const colName of columnNames) {
    const values = data.map(row => row[colName])
    const stats = analyzeColumn(colName, values)
    columns.push(stats)

    if (stats.nullCount / stats.count > 0.5) {
      warnings.push(`Coluna "${colName}" tem mais de 50% de valores nulos`)
    }

    if (stats.uniqueCount === 1) {
      warnings.push(`Coluna "${colName}" tem apenas um valor único (considere remover)`)
    }
  }

  const totalCells = data.length * columnNames.length
  const totalNulls = columns.reduce((sum, col) => sum + col.nullCount, 0)
  const dataQualityScore = Math.round(((totalCells - totalNulls) / totalCells) * 100)

  if (dataQualityScore < 70) {
    warnings.push(`Score de qualidade baixo: ${dataQualityScore}%`)
  }

  const sampleRows = data.slice(0, maxSampleRows)

  return {
    rowCount: data.length,
    columnCount: columnNames.length,
    columns,
    dataQualityScore,
    warnings,
    sampleRows
  }
}

export function prepareDataForAI(summary: DatasetSummary): string {
  const lines: string[] = [
    `Dataset: ${summary.rowCount} linhas × ${summary.columnCount} colunas`,
    `Qualidade: ${summary.dataQualityScore}%`,
    '',
    'Colunas:'
  ]

  for (const col of summary.columns) {
    lines.push(`- ${col.name} (${col.type}):`)
    lines.push(`  Valores: ${col.count - col.nullCount} preenchidos, ${col.nullCount} nulos, ${col.uniqueCount} únicos`)

    if (col.type === 'numeric') {
      lines.push(`  Estatísticas: min=${col.min}, max=${col.max}, média=${col.mean}, mediana=${col.median}, desvio=${col.stdDev}`)
    } else if (col.topValues) {
      const top = col.topValues.slice(0, 3).map(t => `"${t.value}" (${t.count}x)`).join(', ')
      lines.push(`  Top valores: ${top}`)
    }
  }

  if (summary.warnings.length > 0) {
    lines.push('')
    lines.push('Avisos:')
    summary.warnings.forEach(w => lines.push(`- ${w}`))
  }

  lines.push('')
  lines.push('Amostra (primeiras 3 linhas):')
  summary.sampleRows.slice(0, 3).forEach((row, i) => {
    lines.push(`${i + 1}. ${JSON.stringify(row)}`)
  })

  return lines.join('\n')
}

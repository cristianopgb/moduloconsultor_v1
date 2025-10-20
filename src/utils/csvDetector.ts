/**
 * CSV Delimiter Detection Utility
 *
 * Automatically detects the delimiter used in CSV files by analyzing
 * the first few lines. Supports common delimiters used in Brazil and worldwide.
 */

export type CSVDelimiter = ',' | ';' | '\t' | '|'

export interface CSVDetectionResult {
  delimiter: CSVDelimiter
  confidence: number
  encoding: string
  lineCount: number
  columnCount: number
}

/**
 * Detects the most likely delimiter in a CSV text
 */
export function detectCSVDelimiter(text: string): CSVDetectionResult {
  const lines = text.split('\n').filter(line => line.trim().length > 0).slice(0, 10)

  if (lines.length === 0) {
    return {
      delimiter: ',',
      confidence: 0,
      encoding: 'utf-8',
      lineCount: 0,
      columnCount: 0
    }
  }

  const delimiters: CSVDelimiter[] = [',', ';', '\t', '|']
  const scores: Record<CSVDelimiter, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 }
  const counts: Record<CSVDelimiter, number[]> = { ',': [], ';': [], '\t': [], '|': [] }

  // Count occurrences of each delimiter per line
  for (const line of lines) {
    for (const delimiter of delimiters) {
      const count = line.split(delimiter).length - 1
      counts[delimiter].push(count)
    }
  }

  // Score each delimiter based on:
  // 1. Consistency across lines (variance)
  // 2. Total count (more columns = higher score)
  // 3. Presence in all lines
  for (const delimiter of delimiters) {
    const delimiterCounts = counts[delimiter]
    const avg = delimiterCounts.reduce((a, b) => a + b, 0) / delimiterCounts.length

    // Skip if delimiter never appears
    if (avg === 0) continue

    // Calculate variance (lower is better)
    const variance = delimiterCounts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / delimiterCounts.length
    const consistency = 1 / (1 + variance)

    // Score: consistency * average count * presence factor
    const presenceFactor = delimiterCounts.filter(c => c > 0).length / delimiterCounts.length
    scores[delimiter] = consistency * avg * presenceFactor
  }

  // Find best delimiter
  let bestDelimiter: CSVDelimiter = ','
  let bestScore = 0

  for (const delimiter of delimiters) {
    if (scores[delimiter] > bestScore) {
      bestScore = scores[delimiter]
      bestDelimiter = delimiter
    }
  }

  // Calculate confidence (0-100)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? Math.round((bestScore / totalScore) * 100) : 0

  // Get average column count
  const avgColumns = counts[bestDelimiter].length > 0
    ? Math.round(counts[bestDelimiter].reduce((a, b) => a + b, 0) / counts[bestDelimiter].length) + 1
    : 0

  return {
    delimiter: bestDelimiter,
    confidence,
    encoding: 'utf-8',
    lineCount: lines.length,
    columnCount: avgColumns
  }
}

/**
 * Attempts to detect the encoding of a file buffer
 * Returns the detected encoding name
 */
export function detectEncoding(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer)

  // Check for BOM (Byte Order Mark)
  if (uint8Array.length >= 3) {
    // UTF-8 BOM
    if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      return 'utf-8'
    }
  }

  if (uint8Array.length >= 2) {
    // UTF-16 LE BOM
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
      return 'utf-16le'
    }
    // UTF-16 BE BOM
    if (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
      return 'utf-16be'
    }
  }

  // No BOM found, analyze content
  // Check for high byte usage (indicates non-ASCII, possibly Windows-1252 or ISO-8859-1)
  let highByteCount = 0
  const sampleSize = Math.min(1000, uint8Array.length)

  for (let i = 0; i < sampleSize; i++) {
    if (uint8Array[i] > 127) {
      highByteCount++
    }
  }

  const highByteRatio = highByteCount / sampleSize

  // If more than 10% high bytes, likely Windows-1252 (common in Brazil)
  if (highByteRatio > 0.1) {
    return 'windows-1252'
  }

  // Default to UTF-8
  return 'utf-8'
}

/**
 * Converts a buffer to text using the specified encoding
 */
export function bufferToText(buffer: ArrayBuffer, encoding: string): string {
  try {
    const decoder = new TextDecoder(encoding)
    return decoder.decode(buffer)
  } catch (error) {
    console.warn(`[csvDetector] Failed to decode with ${encoding}, falling back to utf-8`, error)
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(buffer)
  }
}

/**
 * Parses CSV text with the detected delimiter
 */
export function parseCSVWithDelimiter(text: string, delimiter: CSVDelimiter): string[][] {
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  const result: string[][] = []

  for (const line of lines) {
    // Simple split (doesn't handle quoted fields with delimiters inside)
    // For production, consider using a proper CSV parser library
    const fields = line.split(delimiter).map(field => field.trim())
    result.push(fields)
  }

  return result
}

/**
 * Complete CSV detection and parsing pipeline
 */
export async function detectAndParseCSV(file: File): Promise<{
  text: string
  delimiter: CSVDelimiter
  confidence: number
  encoding: string
  rows: string[][]
  headers: string[]
}> {
  // Read file as buffer
  const buffer = await file.arrayBuffer()

  // Detect encoding
  const encoding = detectEncoding(buffer)

  // Convert to text
  const text = bufferToText(buffer, encoding)

  // Detect delimiter
  const detection = detectCSVDelimiter(text)

  // Parse CSV
  const rows = parseCSVWithDelimiter(text, detection.delimiter)
  const headers = rows.length > 0 ? rows[0] : []

  return {
    text,
    delimiter: detection.delimiter,
    confidence: detection.confidence,
    encoding,
    rows,
    headers
  }
}

/**
 * Format delimiter name for display
 */
export function getDelimiterName(delimiter: CSVDelimiter): string {
  switch (delimiter) {
    case ',': return 'Vírgula (,)'
    case ';': return 'Ponto-e-vírgula (;)'
    case '\t': return 'Tab (\\t)'
    case '|': return 'Pipe (|)'
    default: return 'Desconhecido'
  }
}

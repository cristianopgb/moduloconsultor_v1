/**
 * ===================================================================
 * FILE TYPE DETECTOR - Input Adapter Layer
 * ===================================================================
 *
 * Detects file types using:
 * 1. Extension analysis (primary)
 * 2. Byte signature validation (secondary)
 * 3. Content pattern analysis (fallback)
 *
 * Validates file size limits per type
 * ===================================================================
 */

export type FileType = 'csv' | 'xlsx' | 'json' | 'txt' | 'pdf' | 'docx' | 'pptx' | 'unknown';

export interface FileTypeResult {
  type: FileType;
  confidence: number; // 0-100
  extension: string;
  size_bytes: number;
  within_limits: boolean;
  size_limit_mb: number;
  warnings: string[];
}

// Size limits per file type (in MB)
const SIZE_LIMITS: Record<FileType, number> = {
  csv: 10,
  xlsx: 8,
  pdf: 6,
  docx: 6,
  pptx: 6,
  txt: 5,
  json: 5,
  unknown: 0
};

// File signatures (magic bytes)
const SIGNATURES = {
  xlsx: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04 (ZIP)
  docx: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04 (ZIP)
  pptx: [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04 (ZIP)
  pdf: [0x25, 0x50, 0x44, 0x46],  // %PDF
};

/**
 * Extract file extension from filename
 */
function getExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

/**
 * Check if bytes match a signature
 */
function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Detect if content is JSON
 */
function looksLikeJSON(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder('utf-8').decode(bytes.slice(0, 100));
    const trimmed = text.trim();
    return trimmed.startsWith('[') || trimmed.startsWith('{');
  } catch {
    return false;
  }
}

/**
 * Detect if content has CSV/delimiter patterns
 */
function looksLikeDelimited(bytes: Uint8Array): { likely: boolean; delimiter?: string } {
  try {
    const text = new TextDecoder('utf-8').decode(bytes.slice(0, 2000));
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    if (lines.length < 2) return { likely: false };

    // Check for common delimiters
    const delimiters = [',', ';', '\t', '|'];
    const counts: Record<string, number[]> = {};

    for (const delim of delimiters) {
      counts[delim] = lines.slice(0, 10).map(line =>
        (line.match(new RegExp(`\\${delim}`, 'g')) || []).length
      );
    }

    // Find delimiter with consistent count across lines
    for (const [delim, lineCounts] of Object.entries(counts)) {
      const avg = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
      const variance = lineCounts.map(c => Math.abs(c - avg)).reduce((a, b) => a + b, 0) / lineCounts.length;

      // If variance is low and average is > 1, likely a delimiter
      if (avg > 1 && variance < 1) {
        return { likely: true, delimiter: delim };
      }
    }

    return { likely: false };
  } catch {
    return { likely: false };
  }
}

/**
 * Detect file type from base64 data and filename
 */
export function detectFileType(
  file_data_base64: string,
  filename: string
): FileTypeResult {
  const warnings: string[] = [];
  const extension = getExtension(filename);

  // Decode first bytes for signature check
  let bytes: Uint8Array;
  try {
    const binaryString = atob(file_data_base64.slice(0, 1000)); // First ~750 bytes
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } catch (error) {
    return {
      type: 'unknown',
      confidence: 0,
      extension,
      size_bytes: 0,
      within_limits: false,
      size_limit_mb: 0,
      warnings: ['Failed to decode base64 data']
    };
  }

  // Calculate actual file size
  const size_bytes = Math.ceil(file_data_base64.length * 0.75); // base64 is ~133% of original

  let detectedType: FileType = 'unknown';
  let confidence = 0;

  // 1. Extension-based detection (primary)
  switch (extension) {
    case 'csv':
      detectedType = 'csv';
      confidence = 90;
      break;
    case 'xlsx':
    case 'xls':
      detectedType = 'xlsx';
      confidence = matchesSignature(bytes, SIGNATURES.xlsx) ? 100 : 80;
      if (confidence === 80) {
        warnings.push('Excel extension detected but ZIP signature not found');
      }
      break;
    case 'json':
      detectedType = 'json';
      confidence = looksLikeJSON(bytes) ? 100 : 70;
      if (confidence === 70) {
        warnings.push('JSON extension but content does not start with [ or {');
      }
      break;
    case 'txt':
      detectedType = 'txt';
      confidence = 85;
      break;
    case 'pdf':
      detectedType = 'pdf';
      confidence = matchesSignature(bytes, SIGNATURES.pdf) ? 100 : 70;
      if (confidence === 70) {
        warnings.push('PDF extension but signature not found');
      }
      break;
    case 'docx':
    case 'doc':
      detectedType = 'docx';
      confidence = matchesSignature(bytes, SIGNATURES.docx) ? 100 : 70;
      if (confidence === 70) {
        warnings.push('DOCX extension but ZIP signature not found');
      }
      break;
    case 'pptx':
    case 'ppt':
      detectedType = 'pptx';
      confidence = matchesSignature(bytes, SIGNATURES.pptx) ? 100 : 70;
      if (confidence === 70) {
        warnings.push('PPTX extension but ZIP signature not found');
      }
      break;
  }

  // 2. Signature-based detection (if no extension match)
  if (detectedType === 'unknown') {
    if (matchesSignature(bytes, SIGNATURES.pdf)) {
      detectedType = 'pdf';
      confidence = 90;
      warnings.push('Detected as PDF by signature (missing .pdf extension)');
    } else if (matchesSignature(bytes, SIGNATURES.xlsx)) {
      // Could be xlsx, docx, or pptx - default to xlsx
      detectedType = 'xlsx';
      confidence = 60;
      warnings.push('Detected ZIP file - assuming XLSX (could be DOCX/PPTX)');
    } else if (looksLikeJSON(bytes)) {
      detectedType = 'json';
      confidence = 85;
      warnings.push('Detected as JSON by content pattern');
    } else {
      const delimResult = looksLikeDelimited(bytes);
      if (delimResult.likely) {
        detectedType = 'csv';
        confidence = 75;
        warnings.push(`Detected as delimited file (delimiter: ${delimResult.delimiter})`);
      } else {
        detectedType = 'txt';
        confidence = 50;
        warnings.push('Defaulting to TXT - no clear pattern detected');
      }
    }
  }

  // 3. Validate size limits
  const size_limit_mb = SIZE_LIMITS[detectedType];
  const size_mb = size_bytes / (1024 * 1024);
  const within_limits = size_mb <= size_limit_mb;

  if (!within_limits) {
    warnings.push(
      `File size ${size_mb.toFixed(2)}MB exceeds limit of ${size_limit_mb}MB for ${detectedType.toUpperCase()} files`
    );
  }

  return {
    type: detectedType,
    confidence,
    extension,
    size_bytes,
    within_limits,
    size_limit_mb,
    warnings
  };
}

/**
 * Validate that detected type is supported
 */
export function isSupportedType(type: FileType): boolean {
  return type !== 'unknown';
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(type: FileType): string {
  const names: Record<FileType, string> = {
    csv: 'CSV',
    xlsx: 'Excel',
    json: 'JSON',
    txt: 'Text',
    pdf: 'PDF',
    docx: 'Word Document',
    pptx: 'PowerPoint',
    unknown: 'Unknown'
  };
  return names[type];
}

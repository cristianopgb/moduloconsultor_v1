/**
 * ===================================================================
 * DOCUMENT ADAPTERS - PDF, DOCX, PPTX
 * ===================================================================
 *
 * Basic table extraction from office documents
 * For v1.1, these return clear errors with guidance
 * Future versions can implement full extraction using libraries
 * ===================================================================
 */

export interface DocumentAdapterResult {
  rows: Array<Record<string, any>>;
  metadata: {
    row_count: number;
    column_count: number;
    tables_detected: number;
    chosen_table_shape?: { rows: number; cols: number };
    source_location?: string;
    headers: string[];
    normalized_headers: string[];
    warnings: string[];
  };
}

/**
 * PDF Adapter - Stub for v1.1
 * Returns error with guidance to convert to CSV/XLSX
 */
export function adaptPDF(file_data_base64: string): DocumentAdapterResult {
  throw new Error(
    'Detectamos arquivo PDF sem tabelas legíveis. ' +
    'A extração de tabelas de PDF será implementada em versão futura. ' +
    'Para seguir com análises agora, exporte a tabela para CSV ou Excel (.xlsx).'
  );
}

/**
 * DOCX Adapter - Stub for v1.1
 * Returns error with guidance to convert to CSV/XLSX
 */
export function adaptDOCX(file_data_base64: string): DocumentAdapterResult {
  throw new Error(
    'Detectamos arquivo Word (DOCX) mas a extração de tabelas não está disponível nesta versão. ' +
    'Para seguir com análises agora, insira a tabela em uma planilha Excel ou exporte como CSV.'
  );
}

/**
 * PPTX Adapter - Stub for v1.1
 * Returns error with guidance to convert to CSV/XLSX
 */
export function adaptPPTX(file_data_base64: string): DocumentAdapterResult {
  throw new Error(
    'Detectamos arquivo PowerPoint (PPTX) mas a extração de tabelas não está disponível nesta versão. ' +
    'Para seguir com análises agora, copie a tabela para Excel ou exporte como CSV.'
  );
}

/**
 * Future implementation notes:
 *
 * For PDF table extraction:
 * - Use npm:pdf-parse or similar for Deno
 * - Detect tables using layout analysis (spacing, lines)
 * - Extract largest table automatically
 * - Handle multi-page tables
 *
 * For DOCX table extraction:
 * - Parse document.xml from DOCX ZIP
 * - Find <w:tbl> elements
 * - Extract <w:tr> rows and <w:tc> cells
 * - Choose largest table if multiple
 *
 * For PPTX table extraction:
 * - Parse slide XML files from PPTX ZIP
 * - Find <a:tbl> elements in slides
 * - Extract table structure
 * - Record slide number where table was found
 */

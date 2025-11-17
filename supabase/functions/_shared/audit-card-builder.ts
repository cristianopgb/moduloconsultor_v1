/**
 * ===================================================================
 * AUDIT CARD BUILDER - Transparent reporting of analysis process
 * ===================================================================
 *
 * Builds human-readable audit cards showing:
 * - What was ingested and how
 * - What normalizations were applied
 * - What limitations exist
 * - What sections were enabled/disabled by guardrails
 * ===================================================================
 */

export interface AuditCard {
  file_info: {
    type: string;
    size_mb: string;
    confidence: string;
  };
  ingestion: {
    method: string;
    rows_processed: number;
    rows_discarded: number;
    columns_detected: number;
    warnings: string[];
  };
  normalizations: {
    headers_changed: boolean;
    decimal_locale?: string;
    encoding?: string;
    dialect?: string;
    examples: string[];
  };
  schema_detection: {
    columns: Array<{
      original: string;
      normalized: string;
      type: string;
    }>;
  };
  guardrails: {
    active_sections: string[];
    disabled_sections: Array<{
      section: string;
      reason: string;
    }>;
    quality_score: number;
  };
  limitations: string[];
  recommendations: string[];
}

/**
 * Build audit card from ingestion telemetry and analysis metadata
 */
export function buildAuditCard(
  ingestTelemetry: any,
  enrichedSchema: any[],
  guardrails: any,
  playbookId: string,
  compatibilityScore: number
): AuditCard {

  const { ingest_source, file_size_bytes, detection_confidence } = ingestTelemetry;
  const { headers_original, headers_normalized, ingest_warnings, limitations } = ingestTelemetry;

  // File info
  const fileInfo = {
    type: ingest_source.toUpperCase(),
    size_mb: (file_size_bytes / 1024 / 1024).toFixed(2),
    confidence: `${detection_confidence}%`
  };

  // Ingestion summary
  const ingestion = {
    method: getIngestionMethodDescription(ingestTelemetry),
    rows_processed: ingestTelemetry.row_count,
    rows_discarded: ingestTelemetry.discarded_rows || 0,
    columns_detected: ingestTelemetry.column_count,
    warnings: ingest_warnings || []
  };

  // Normalizations applied
  const normalizationExamples: string[] = [];
  const headersChanged = headers_original.some((h: string, i: number) =>
    h !== headers_normalized[i]
  );

  if (headersChanged) {
    const examples = headers_original
      .map((orig: string, i: number) => {
        const norm = headers_normalized[i];
        return orig !== norm ? `"${orig}" → "${norm}"` : null;
      })
      .filter(Boolean)
      .slice(0, 3);

    normalizationExamples.push(...examples);
  }

  if (ingestTelemetry.decimal_locale === 'comma') {
    normalizationExamples.push('Decimais: vírgula → ponto (ex: 1,5 → 1.5)');
  }

  const normalizations = {
    headers_changed: headersChanged,
    decimal_locale: ingestTelemetry.decimal_locale,
    encoding: ingestTelemetry.encoding,
    dialect: ingestTelemetry.dialect,
    examples: normalizationExamples
  };

  // Schema detection
  const schemaColumns = enrichedSchema.map(col => ({
    original: headers_original[headers_normalized.indexOf(col.name)] || col.name,
    normalized: col.name,
    type: col.inferred_type || col.type
  }));

  // Guardrails summary
  const guardrailsInfo = {
    active_sections: guardrails.active_sections || [],
    disabled_sections: guardrails.disabled_sections || [],
    quality_score: guardrails.quality_score || 0
  };

  // Build recommendations
  const recommendations: string[] = [];

  if (compatibilityScore < 90) {
    recommendations.push(
      `Compatibilidade com playbook "${playbookId}": ${compatibilityScore}%. ` +
      `Para melhorar a qualidade da análise, certifique-se de que o dataset contenha todas as colunas esperadas.`
    );
  }

  if (ingestTelemetry.discarded_rows > 0) {
    const pct = ((ingestTelemetry.discarded_rows / (ingestTelemetry.row_count + ingestTelemetry.discarded_rows)) * 100).toFixed(1);
    recommendations.push(
      `${ingestTelemetry.discarded_rows} linhas vazias foram descartadas (${pct}%). ` +
      `Considere limpar o arquivo antes do upload para melhorar o desempenho.`
    );
  }

  if (guardrails.disabled_sections && guardrails.disabled_sections.length > 0) {
    recommendations.push(
      `Algumas seções da análise foram desabilitadas por falta de dados necessários. ` +
      `Veja "Seções Desabilitadas" abaixo para detalhes.`
    );
  }

  if (ingestTelemetry.total_sheets && ingestTelemetry.total_sheets > 1) {
    recommendations.push(
      `O arquivo Excel contém ${ingestTelemetry.total_sheets} planilhas. ` +
      `Apenas a primeira ("${ingestTelemetry.sheet_name}") foi analisada. ` +
      `Para analisar outras planilhas, exporte-as individualmente.`
    );
  }

  return {
    file_info: fileInfo,
    ingestion,
    normalizations,
    schema_detection: {
      columns: schemaColumns
    },
    guardrails: guardrailsInfo,
    limitations: limitations || [],
    recommendations
  };
}

/**
 * Get human-readable ingestion method description
 */
function getIngestionMethodDescription(telemetry: any): string {
  const { ingest_source, detection_method, dialect, format } = telemetry;

  switch (ingest_source) {
    case 'csv':
      return `CSV com delimitador ${dialect === 'comma' ? 'vírgula' : dialect === 'semicolon' ? 'ponto-e-vírgula' : dialect === 'tab' ? 'tab' : dialect}`;

    case 'xlsx':
      return telemetry.total_sheets > 1
        ? `Excel - planilha "${telemetry.sheet_name}" (${telemetry.total_sheets} planilhas no arquivo)`
        : `Excel - planilha "${telemetry.sheet_name}"`;

    case 'json':
      return format === 'direct_array' ? 'JSON (array direto)' : 'JSON (formato wrapped)';

    case 'txt':
      return detection_method === 'delimited'
        ? `TXT com delimitador ${dialect || 'detectado'}`
        : detection_method === 'fixed_width'
        ? 'TXT com colunas de largura fixa'
        : 'TXT (estrutura detectada)';

    case 'pdf':
      return telemetry.tables_detected
        ? `PDF - ${telemetry.tables_detected} tabela(s) detectada(s)`
        : 'PDF (extração básica)';

    case 'docx':
      return 'Word Document (extração de tabelas)';

    case 'pptx':
      return 'PowerPoint (extração de tabelas)';

    default:
      return ingest_source.toUpperCase();
  }
}

/**
 * Format audit card as markdown for display
 */
export function formatAuditCardAsMarkdown(card: AuditCard): string {
  const sections: string[] = [];

  sections.push('## 📋 Cartão de Auditoria da Análise\n');

  // File info
  sections.push('### 📁 Informações do Arquivo\n');
  sections.push(`- **Tipo:** ${card.file_info.type}`);
  sections.push(`- **Tamanho:** ${card.file_info.size_mb} MB`);
  sections.push(`- **Confiança na Detecção:** ${card.file_info.confidence}\n`);

  // Ingestion
  sections.push('### 📥 Ingestão\n');
  sections.push(`- **Método:** ${card.ingestion.method}`);
  sections.push(`- **Linhas Processadas:** ${card.ingestion.rows_processed}`);
  if (card.ingestion.rows_discarded > 0) {
    sections.push(`- **Linhas Descartadas:** ${card.ingestion.rows_discarded} (linhas vazias)`);
  }
  sections.push(`- **Colunas Detectadas:** ${card.ingestion.columns_detected}`);

  if (card.ingestion.warnings.length > 0) {
    sections.push('\n**⚠️ Avisos:**');
    card.ingestion.warnings.forEach(w => sections.push(`- ${w}`));
  }
  sections.push('');

  // Normalizations
  if (card.normalizations.examples.length > 0) {
    sections.push('### 🔄 Normalizações Aplicadas\n');
    card.normalizations.examples.forEach(ex => sections.push(`- ${ex}`));
    sections.push('');
  }

  // Schema
  sections.push('### 🔍 Schema Detectado\n');
  sections.push('| Coluna Original | Coluna Normalizada | Tipo Detectado |');
  sections.push('|----------------|-------------------|----------------|');
  card.schema_detection.columns.slice(0, 10).forEach(col => {
    sections.push(`| ${col.original} | ${col.normalized} | ${col.type} |`);
  });
  if (card.schema_detection.columns.length > 10) {
    sections.push(`\n*... e mais ${card.schema_detection.columns.length - 10} colunas*\n`);
  }
  sections.push('');

  // Guardrails
  sections.push('### 🛡️ Guardrails (Anti-Alucinação)\n');
  sections.push(`- **Pontuação de Qualidade:** ${card.guardrails.quality_score}/100`);
  sections.push(`- **Seções Ativas:** ${card.guardrails.active_sections.length}`);

  if (card.guardrails.disabled_sections.length > 0) {
    sections.push(`- **Seções Desabilitadas:** ${card.guardrails.disabled_sections.length}\n`);
    sections.push('**Motivos:**');
    card.guardrails.disabled_sections.forEach(ds => {
      sections.push(`- **${ds.section}:** ${ds.reason}`);
    });
  }
  sections.push('');

  // Limitations
  if (card.limitations.length > 0) {
    sections.push('### ⚠️ Limitações\n');
    card.limitations.forEach(lim => sections.push(`- ${lim}`));
    sections.push('');
  }

  // Recommendations
  if (card.recommendations.length > 0) {
    sections.push('### 💡 Recomendações\n');
    card.recommendations.forEach(rec => sections.push(`- ${rec}`));
    sections.push('');
  }

  return sections.join('\n');
}

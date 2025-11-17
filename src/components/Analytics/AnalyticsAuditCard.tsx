/**
 * Analytics Audit Card - Transparency & Quality Indicators
 *
 * Shows users exactly what columns were detected and used in the analysis.
 * Displays quality score, compatibility score, and limitations.
 */

import { useState } from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  inferred_type?: string;
  confidence?: number;
  sample_values?: any[];
  canonical_name?: string;
}

interface DisabledSection {
  section: string;
  reason: string;
  missing_requirement: string;
  call_to_action: string;
}

interface AnalyticsAuditCardProps {
  detectedColumns: Column[];
  usedColumns: string[];
  playbookId: string;
  playbookName?: string;
  compatibilityScore: number;
  qualityScore: number;
  disabledSections?: DisabledSection[];
  warnings?: string[];
  rowCount: number;
}

export default function AnalyticsAuditCard({
  detectedColumns,
  usedColumns,
  playbookId,
  playbookName,
  compatibilityScore,
  qualityScore,
  disabledSections = [],
  warnings = [],
  rowCount
}: AnalyticsAuditCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Quality indicator
  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getQualityIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="w-4 h-4" />;
    if (score >= 70) return <AlertTriangle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const getQualityLabel = (score: number) => {
    if (score >= 90) return 'Excelente';
    if (score >= 70) return 'Boa';
    return 'Limitada';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      {/* Compact Header - Always Visible */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {/* Quality Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border ${getQualityColor(qualityScore)}`}>
              {getQualityIcon(qualityScore)}
              <span className="text-sm font-medium">
                {getQualityLabel(qualityScore)} ({qualityScore}/100)
              </span>
            </div>

            {/* Summary Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Info className="w-4 h-4 text-gray-400" />
                <span>
                  Baseado em <strong>{detectedColumns.length} colunas</strong> detectadas
                  {' '} · <strong>{rowCount}</strong> registros
                  {' '} · Playbook: <strong className="text-blue-600">{playbookName || playbookId}</strong>
                </span>
              </div>

              {/* Warnings Preview */}
              {warnings.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{warnings.length} avisos detectados</span>
                </div>
              )}

              {/* Disabled Sections Preview */}
              {disabledSections.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <XCircle className="w-3 h-3" />
                  <span>{disabledSections.length} seções desabilitadas</span>
                </div>
              )}
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-2 p-2 hover:bg-gray-100 rounded-md transition-colors"
            aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          {/* Compatibility Score */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                Score de Compatibilidade
              </div>
              <div className={`text-2xl font-bold ${compatibilityScore >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                {compatibilityScore}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {compatibilityScore >= 80 ? 'Playbook altamente compatível' : 'Compatibilidade abaixo do threshold'}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                Qualidade dos Dados
              </div>
              <div className={`text-2xl font-bold ${getQualityColor(qualityScore).split(' ')[0]}`}>
                {qualityScore}/100
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {getQualityLabel(qualityScore)} qualidade de dados
              </div>
            </div>
          </div>

          {/* Detected Columns */}
          <div>
            <div className="text-xs font-medium text-gray-700 uppercase mb-2">
              Colunas Detectadas ({detectedColumns.length})
            </div>
            <div className="bg-white rounded-md border border-gray-200 max-h-48 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nome</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Confiança</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Usada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {detectedColumns.map((col, idx) => {
                    const isUsed = usedColumns.includes(col.name);
                    return (
                      <tr key={idx} className={isUsed ? 'bg-blue-50' : ''}>
                        <td className="px-3 py-2 text-sm text-gray-900 font-mono">
                          {col.name}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                            ${col.inferred_type === 'numeric' ? 'bg-purple-100 text-purple-800' :
                              col.inferred_type === 'date' ? 'bg-blue-100 text-blue-800' :
                              col.inferred_type === 'text' ? 'bg-gray-100 text-gray-800' :
                              'bg-green-100 text-green-800'}`}>
                            {col.inferred_type || col.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {col.confidence ? `${col.confidence}%` : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {isUsed ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disabled Sections */}
          {disabledSections.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 uppercase mb-2">
                Seções Desabilitadas ({disabledSections.length})
              </div>
              <div className="space-y-2">
                {disabledSections.map((section, idx) => (
                  <div key={idx} className="bg-white border border-orange-200 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {formatSectionName(section.section)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <strong>Motivo:</strong> {section.reason}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <strong>Faltante:</strong> {section.missing_requirement}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {section.call_to_action}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 uppercase mb-2">
                Avisos ({warnings.length})
              </div>
              <div className="space-y-1">
                {warnings.map((warning, idx) => (
                  <div key={idx} className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatSectionName(section: string): string {
  const names: Record<string, string> = {
    'temporal_trend': 'Análise Temporal',
    'relationship': 'Análise de Correlação',
    'by_category': 'Análise por Categoria',
    'by_location': 'Análise por Localização',
    'by_group': 'Análise por Grupo',
    'overview': 'Visão Geral',
    'distribution': 'Análise de Distribuição',
    'significance': 'Análise de Significância Estatística'
  };

  return names[section] || section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

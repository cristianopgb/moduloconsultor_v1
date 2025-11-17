/**
 * Limitations Section - Always visible after analysis
 *
 * Shows users what analyses were NOT performed and why.
 * Provides clear call-to-actions to improve the dataset.
 */

import { AlertTriangle, TrendingUp, Database, Calendar, BarChart3 } from 'lucide-react';

interface DisabledSection {
  section: string;
  reason: string;
  missing_requirement: string;
  call_to_action: string;
}

interface LimitationsSectionProps {
  disabledSections: DisabledSection[];
  suggestions?: string[];
  isExploratoryFallback?: boolean;
  fallbackReason?: string;
}

export default function LimitationsSection({
  disabledSections,
  suggestions = [],
  isExploratoryFallback = false,
  fallbackReason
}: LimitationsSectionProps) {

  // If no limitations and not fallback, show success state
  if (disabledSections.length === 0 && !isExploratoryFallback) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-6">
        <div className="flex items-start gap-3">
          <BarChart3 className="w-6 h-6 text-green-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-green-900">
              ✅ Análise Completa
            </h3>
            <p className="text-sm text-green-700 mt-2">
              Todas as seções de análise foram executadas com sucesso. Não foram identificadas limitações significativas nos dados fornecidos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mt-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-orange-900">
            ⚠️ Limitações da Análise
          </h3>

          {/* Fallback explanation */}
          {isExploratoryFallback && fallbackReason && (
            <div className="mt-3 p-4 bg-white border border-orange-300 rounded-md">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Por que esta análise é exploratória?
              </div>
              <div className="text-sm text-gray-700">
                {fallbackReason}
              </div>
            </div>
          )}

          {/* Disabled sections */}
          {disabledSections.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-orange-800 mb-3">
                As seguintes análises não puderam ser realizadas devido a requisitos não atendidos:
              </p>

              <div className="space-y-3">
                {disabledSections.map((section, idx) => (
                  <div key={idx} className="bg-white border border-orange-200 rounded-md p-4">
                    <div className="flex items-start gap-3">
                      {getSectionIcon(section.section)}
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {idx + 1}. {formatSectionName(section.section)}
                        </div>

                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                          <div>
                            <span className="font-medium">Motivo:</span> {section.reason}
                          </div>
                          <div>
                            <span className="font-medium">Requisito faltante:</span>{' '}
                            <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                              {section.missing_requirement}
                            </code>
                          </div>
                        </div>

                        <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-xl">💡</div>
                          <div className="text-sm text-blue-800 font-medium flex-1">
                            {section.call_to_action}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable analyses (if fallback) */}
          {isExploratoryFallback && (
            <div className="mt-4 p-4 bg-white border border-orange-300 rounded-md">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Análises não disponíveis neste momento:
              </div>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>Análises específicas de domínio (estoque, vendas, logística, etc.)</li>
                <li>Modelos preditivos e forecasting</li>
                <li>Análises estatísticas avançadas</li>
                <li>Benchmarking e comparações setoriais</li>
              </ul>
            </div>
          )}

          {/* Suggestions to improve */}
          {(suggestions.length > 0 || disabledSections.length > 0) && (
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 mb-3">
                    💡 Como desbloquear análises avançadas:
                  </div>

                  <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                    <li>Certifique-se de que seu dataset contém as colunas necessárias para o tipo de análise desejado</li>
                    <li>Verifique os tipos de dados (datas devem estar no formato correto, números não devem conter texto)</li>
                    <li>Forneça um dataset com pelo menos 20-50 registros para análises robustas</li>
                    {suggestions.length > 0 && suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ol>

                  <div className="mt-4 p-3 bg-white border border-blue-300 rounded-md">
                    <div className="text-xs text-blue-800">
                      <strong>💡 Dica:</strong> Esta análise serve como ponto de partida. Enriqueça seu dataset seguindo as recomendações acima para obter insights mais profundos.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getSectionIcon(section: string) {
  const iconClass = "w-5 h-5 text-orange-600";

  switch (section) {
    case 'temporal_trend':
      return <Calendar className={iconClass} />;
    case 'relationship':
    case 'correlation':
      return <TrendingUp className={iconClass} />;
    case 'distribution':
      return <BarChart3 className={iconClass} />;
    default:
      return <BarChart3 className={iconClass} />;
  }
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

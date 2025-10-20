import { Sparkles, FileText, TrendingUp, BarChart3, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface Suggestion {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: () => void;
}

interface AnalysisSuggestionsCardProps {
  suggestions: Suggestion[];
  analysisType?: string;
  recordsAnalyzed?: number;
  className?: string;
}

export function AnalysisSuggestionsCard({
  suggestions,
  analysisType = 'dados',
  recordsAnalyzed = 0,
  className = ''
}: AnalysisSuggestionsCardProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={`bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border border-emerald-500/30 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-emerald-400 mb-1">
            Análise Concluída com Sucesso!
          </h3>
          <p className="text-xs text-gray-300">
            {recordsAnalyzed > 0
              ? `${recordsAnalyzed.toLocaleString('pt-BR')} registros analisados. O que deseja fazer a seguir?`
              : `Análise de ${analysisType} concluída. O que deseja fazer a seguir?`
            }
          </p>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.id}
              onClick={suggestion.action}
              className="w-full flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 hover:border-blue-500/50 transition-all group text-left"
            >
              <div className="p-1.5 bg-blue-500/10 rounded group-hover:bg-blue-500/20 transition-colors">
                <Icon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-100 group-hover:text-white transition-colors">
                  {suggestion.title}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {suggestion.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-2 text-xs text-gray-400">
        <AlertCircle className="w-3 h-3" />
        <span>Você também pode fazer perguntas específicas sobre os dados analisados</span>
      </div>
    </div>
  );
}

// Helper function to generate contextual suggestions based on analysis data
export function generateSuggestions(
  analysisData: any,
  onGeneratePresentation?: () => void,
  onDeepDive?: (topic: string) => void,
  onExportReport?: () => void,
  onFindAnomalies?: () => void
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Detect data type from column names
  const columns = analysisData?.columns || [];
  const columnNames = columns.map((c: any) => (c.name || '').toLowerCase()).join(' ');

  const isHRData = /funcionario|empregado|colaborador|departamento|salario|ferias|absenteismo/i.test(columnNames);
  const isFinancialData = /receita|despesa|custo|valor|preco|pagamento|faturamento/i.test(columnNames);
  const isSalesData = /venda|produto|cliente|pedido|quantidade|item/i.test(columnNames);

  // 1. Always suggest presentation if handler provided
  if (onGeneratePresentation) {
    suggestions.push({
      id: 'generate-presentation',
      icon: FileText,
      title: 'Gerar apresentação executiva',
      description: 'Crie slides profissionais com os principais insights encontrados',
      action: onGeneratePresentation
    });
  }

  // 2. Context-specific suggestions
  if (isHRData && onDeepDive) {
    suggestions.push({
      id: 'hr-analysis',
      icon: TrendingUp,
      title: 'Análise detalhada de RH',
      description: 'Explore absenteísmo, férias programadas e distribuição por departamento',
      action: () => onDeepDive('RH')
    });
  } else if (isFinancialData && onDeepDive) {
    suggestions.push({
      id: 'financial-analysis',
      icon: BarChart3,
      title: 'Análise financeira detalhada',
      description: 'Investigue tendências de receita, despesas e projeções',
      action: () => onDeepDive('Financeiro')
    });
  } else if (isSalesData && onDeepDive) {
    suggestions.push({
      id: 'sales-analysis',
      icon: TrendingUp,
      title: 'Análise de vendas avançada',
      description: 'Identifique top produtos, sazonalidade e performance por região',
      action: () => onDeepDive('Vendas')
    });
  } else if (onDeepDive) {
    suggestions.push({
      id: 'statistical-analysis',
      icon: BarChart3,
      title: 'Análise estatística avançada',
      description: 'Correlações, tendências e padrões nos dados',
      action: () => onDeepDive('Estatística')
    });
  }

  // 3. Always suggest anomaly detection if handler provided
  if (onFindAnomalies) {
    suggestions.push({
      id: 'find-anomalies',
      icon: AlertCircle,
      title: 'Identificar anomalias e outliers',
      description: 'Detecte valores atípicos e possíveis inconsistências',
      action: onFindAnomalies
    });
  }

  // 4. Export report if handler provided
  if (onExportReport) {
    suggestions.push({
      id: 'export-report',
      icon: FileSpreadsheet,
      title: 'Exportar relatório completo',
      description: 'Gere um documento detalhado com todos os resultados',
      action: onExportReport
    });
  }

  // Return max 3 suggestions
  return suggestions.slice(0, 3);
}

import React from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Activity, Target } from 'lucide-react';

interface EnhancedAnalysisDisplayProps {
  analysisData: any;
}

export default function EnhancedAnalysisDisplay({ analysisData }: EnhancedAnalysisDisplayProps) {
  const { visualizations, narrative, quality_report, confidence_score, methodology_used, warnings } = analysisData;

  if (!visualizations && !narrative) {
    return null; // Não é uma análise Enhanced
  }

  return (
    <div className="space-y-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
      {/* Header com badges */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Análise Executiva Completa
          </h2>
          {methodology_used && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Metodologia: <span className="font-medium">{methodology_used}</span>
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {quality_report && (
            <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Qualidade</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {quality_report.overallScore}/100
              </div>
            </div>
          )}
          {confidence_score && (
            <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">Confiança</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {confidence_score}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warnings importantes */}
      {warnings && warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Observações Importantes
              </h3>
              <ul className="space-y-1">
                {warnings.slice(0, 5).map((warning: string, idx: number) => (
                  <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* === SEÇÃO 1: INTRODUÇÃO === */}
      {narrative && (
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Introdução
            </h3>
          </div>

          {narrative.executiveSummary && (
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {narrative.executiveSummary}
              </p>
            </div>
          )}

          {narrative.context && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <strong>Contexto:</strong> {narrative.context}
            </div>
          )}
        </section>
      )}

      {/* === SEÇÃO 2: ANÁLISE (VISUALIZAÇÕES) === */}
      {visualizations && visualizations.charts && visualizations.charts.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Análise Detalhada
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visualizations.charts.map((chart: any, idx: number) => (
              <ChartCard key={idx} chart={chart} />
            ))}
          </div>
        </section>
      )}

      {/* === SEÇÃO 3: CONCLUSÕES === */}
      {narrative && narrative.findings && narrative.findings.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Principais Achados
            </h3>
          </div>

          <div className="space-y-4">
            {narrative.findings.map((finding: any, idx: number) => (
              <FindingCard key={idx} finding={finding} />
            ))}
          </div>

          {narrative.conclusions && narrative.conclusions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Conclusões</h4>
              <ul className="space-y-2">
                {narrative.conclusions.map((conclusion: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{conclusion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* === SEÇÃO 4: RECOMENDAÇÕES === */}
      {visualizations && visualizations.recommendations && (
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Plano de Ação
            </h3>
          </div>

          {/* Quick Wins */}
          {visualizations.recommendations.quickWins && visualizations.recommendations.quickWins.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">IMPACTO RÁPIDO</span>
                Vitórias Rápidas
              </h4>
              <div className="space-y-3">
                {visualizations.recommendations.quickWins.map((action: any, idx: number) => (
                  <ActionCard key={idx} action={action} />
                ))}
              </div>
            </div>
          )}

          {/* Strategic Actions */}
          {visualizations.recommendations.strategicActions && visualizations.recommendations.strategicActions.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded">ESTRATÉGICO</span>
                Ações de Longo Prazo
              </h4>
              <div className="space-y-3">
                {visualizations.recommendations.strategicActions.map((action: any, idx: number) => (
                  <ActionCard key={idx} action={action} isStrategic />
                ))}
              </div>
            </div>
          )}

          {/* Monitoring Points */}
          {visualizations.recommendations.monitoringPoints && visualizations.recommendations.monitoringPoints.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pontos de Monitoramento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {visualizations.recommendations.monitoringPoints.map((point: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 rounded px-3 py-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    {point}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Rodapé com metodologia */}
      {narrative && narrative.methodology && (
        <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          <strong>Metodologia:</strong> {narrative.methodology}
        </div>
      )}
    </div>
  );
}

// ========== COMPONENTES AUXILIARES ==========

function ChartCard({ chart }: { chart: any }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
        {chart.title}
      </h4>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
        {chart.description}
      </p>

      {/* Placeholder para gráfico (Chart.js será integrado posteriormente) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 min-h-[200px] flex items-center justify-center border border-gray-200 dark:border-gray-600">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {chart.type.toUpperCase()} Chart
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {chart.data?.length || 0} pontos de dados
          </p>
        </div>
      </div>

      {/* Insights do gráfico */}
      {chart.insights && chart.insights.length > 0 && (
        <div className="mt-4 space-y-2">
          {chart.insights.map((insight: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 rounded px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: any }) {
  const severityColors = {
    positive: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    negative: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    neutral: 'border-gray-400 bg-gray-50 dark:bg-gray-700/30'
  };

  const severityIcons = {
    positive: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
    negative: <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />,
    neutral: <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
  };

  const impactBadge = finding.impact === 'high' ? 'ALTO IMPACTO' : finding.impact === 'medium' ? 'MÉDIO IMPACTO' : 'BAIXO IMPACTO';
  const impactColor = finding.impact === 'high' ? 'bg-red-500' : finding.impact === 'medium' ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${severityColors[finding.severity as keyof typeof severityColors]}`}>
      <div className="flex items-start gap-3">
        {severityIcons[finding.severity as keyof typeof severityIcons]}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {finding.title}
            </h4>
            <span className={`text-xs text-white px-2 py-0.5 rounded ${impactColor}`}>
              {impactBadge}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {finding.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, isStrategic = false }: { action: any; isStrategic?: boolean }) {
  const priorityColors = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-blue-600 dark:text-blue-400'
  };

  const effortBadges = {
    low: 'Esforço Baixo',
    medium: 'Esforço Médio',
    high: 'Esforço Alto'
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${isStrategic ? 'border-purple-200 dark:border-purple-800' : 'border-green-200 dark:border-green-800'}`}>
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-semibold text-gray-900 dark:text-white flex-1">
          {action.title}
        </h5>
        <div className="flex gap-2 flex-shrink-0 ml-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[action.priority as keyof typeof priorityColors]} bg-gray-100 dark:bg-gray-700`}>
            {action.priority.toUpperCase()}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
            {effortBadges[action.effort as keyof typeof effortBadges]}
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {action.description}
      </p>
      <div className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
        <TrendingUp className="w-4 h-4" />
        Impacto: {action.expectedImpact}
      </div>
    </div>
  );
}

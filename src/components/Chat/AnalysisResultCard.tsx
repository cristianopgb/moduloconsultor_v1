import React, { useEffect, useState } from 'react'
import { BarChart3, Table, TrendingUp, Info, Loader2, AlertCircle, CheckCircle, Lightbulb, Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ChartRenderer } from '../Datasets/ChartRenderer'
import { KPIGrid } from '../Analytics/KPICard'

interface AnalysisData {
  id: string
  user_question: string
  executive_headline?: string
  executive_summary_text?: string
  llm_reasoning?: string
  generated_sql?: string
  query_results: any[]
  ai_response: {
    headline?: string
    executive_summary?: string
    kpi_cards?: Array<{
      label: string
      value: string
      trend?: string
      comparison?: string
      icon?: string
    }>
    key_insights?: Array<{
      title: string
      description: string
      numbers?: string[]
      importance?: 'high' | 'medium' | 'low'
      emoji?: string
    }>
    insights?: string[]
    summary?: string
    visualizations?: Array<{
      type: 'bar' | 'line' | 'pie' | 'table' | 'scatter'
      title: string
      data: any
      interpretation?: string
      insights?: string[]
    }>
    charts?: Array<{
      type: 'bar' | 'line' | 'pie'
      title: string
      data: any
    }>
    business_recommendations?: Array<{
      action: string
      rationale: string
      expected_impact: string
      priority?: 'high' | 'medium' | 'low'
    }>
    next_questions?: string[]
  }
  business_recommendations?: any[]
  next_questions?: string[]
  full_dataset_rows: number
  status: string
  error_message?: string
  created_at: string
}

interface AnalysisResultCardProps {
  analysisId: string
}

export function AnalysisResultCard({ analysisId }: AnalysisResultCardProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadAnalysis()
  }, [analysisId])

  const loadAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('data_analyses')
        .select('*')
        .eq('id', analysisId)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!data) throw new Error('Análise não encontrada')

      setAnalysis(data as AnalysisData)
    } catch (err: any) {
      console.error('Erro ao carregar análise:', err)
      setError(err.message || 'Erro ao carregar análise')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-sm text-gray-400">Carregando análise...</span>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-900/20 rounded-lg border border-red-800">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-sm text-red-400">{error || 'Análise não encontrada'}</span>
      </div>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-red-400">Análise Falhou</h3>
        </div>
        <p className="text-sm text-gray-400 mb-2">{analysis.user_question}</p>
        {analysis.error_message && (
          <p className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{analysis.error_message}</p>
        )}
      </div>
    )
  }

  const aiResponse = analysis.ai_response || {}
  const headline = analysis.executive_headline || aiResponse.headline
  const executiveSummary = analysis.executive_summary_text || aiResponse.executive_summary || aiResponse.summary || ''
  const kpiCards = aiResponse.kpi_cards || []
  const keyInsights = aiResponse.key_insights || []
  const insights = aiResponse.insights || []
  const visualizations = aiResponse.visualizations || aiResponse.charts || []
  const businessRecommendations = analysis.business_recommendations || aiResponse.business_recommendations || []
  const nextQuestions = analysis.next_questions || aiResponse.next_questions || []

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Análise de Dados</h3>
            </div>
            <p className="text-sm text-gray-300">{analysis.user_question}</p>
            <p className="text-xs text-gray-500 mt-1">
              {analysis.full_dataset_rows.toLocaleString()} linhas analisadas
            </p>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <Info className="w-4 h-4" />
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Headline Section */}
        {headline && (
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h2 className="text-xl font-bold text-white">{headline}</h2>
          </div>
        )}

        {/* Executive Summary */}
        {executiveSummary && (
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h4 className="text-base font-semibold text-white">Resumo Executivo</h4>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{executiveSummary}</p>
          </div>
        )}

        {/* KPI Cards Grid */}
        {kpiCards.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Métricas Principais
            </h4>
            <KPIGrid kpis={kpiCards} columns={kpiCards.length <= 2 ? 2 : 3} size="md" />
          </div>
        )}

        {/* Key Insights (enhanced) */}
        {keyInsights.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Principais Descobertas
            </h4>
            {keyInsights.map((insight: any, idx: number) => (
              <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border-l-4 border-blue-500">
                <div className="flex items-start gap-2 mb-2">
                  {insight.emoji && <span className="text-xl">{insight.emoji}</span>}
                  <h5 className="font-semibold text-white flex-1">{insight.title}</h5>
                  {insight.importance === 'high' && (
                    <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded">Alta</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-2">{insight.description}</p>
                {insight.numbers && insight.numbers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {insight.numbers.map((num: string, numIdx: number) => (
                      <span key={numIdx} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded">
                        {num}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legacy insights (simple list) */}
        {insights.length > 0 && keyInsights.length === 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Insights
            </h4>
            <ul className="space-y-1">
              {insights.map((insight: any, idx: number) => {
                const insightText = typeof insight === 'string'
                  ? insight
                  : insight?.content || insight?.description || insight?.title || JSON.stringify(insight)
                return (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{insightText}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Visualizations */}
        {visualizations.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Visualizações
            </h4>
            {visualizations.map((viz: any, idx: number) => {
              if (!viz || !viz.type || !viz.data) return null
              return (
                <div key={idx} className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                  <h5 className="text-sm font-medium text-white">{viz.title || 'Gráfico'}</h5>
                  {viz.type !== 'table' ? (
                    <ChartRenderer
                      type={viz.type}
                      data={viz.data}
                      title={viz.title || 'Gráfico'}
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-700">
                            {viz.data.columns?.map((col: string, colIdx: number) => (
                              <th key={colIdx} className="text-left p-2 text-gray-400 font-medium">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {viz.data.rows?.slice(0, 10).map((row: any[], rowIdx: number) => (
                            <tr key={rowIdx} className="border-b border-gray-800">
                              {row.map((cell: any, cellIdx: number) => (
                                <td key={cellIdx} className="p-2 text-gray-300">
                                  {typeof cell === 'number' ? cell.toLocaleString() : String(cell || '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {viz.interpretation && (
                    <p className="text-xs text-gray-400 italic">{viz.interpretation}</p>
                  )}
                  {viz.insights && viz.insights.length > 0 && (
                    <ul className="text-xs text-gray-400 space-y-1">
                      {viz.insights.map((insight: string, insightIdx: number) => (
                        <li key={insightIdx} className="flex items-start gap-1">
                          <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Business Recommendations */}
        {businessRecommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />
              Recomendações
            </h4>
            {businessRecommendations.map((rec: any, idx: number) => (
              <div key={idx} className="bg-gradient-to-r from-orange-900/20 to-gray-900/50 rounded-lg p-4 border-l-4 border-orange-500">
                <div className="flex items-start gap-2 mb-2">
                  <h5 className="font-semibold text-white flex-1">{rec.action}</h5>
                  {rec.priority === 'high' && (
                    <span className="px-2 py-0.5 bg-orange-900/50 text-orange-300 text-xs rounded">Prioridade Alta</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-2">{rec.rationale}</p>
                {rec.expected_impact && (
                  <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded">
                    <strong>Impacto Esperado:</strong> {rec.expected_impact}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Next Questions */}
        {nextQuestions.length > 0 && (
          <div className="bg-blue-900/10 rounded-lg p-4 border border-blue-800/30">
            <h4 className="text-sm font-semibold text-white mb-2">Próximas Perguntas Sugeridas</h4>
            <ul className="space-y-1">
              {nextQuestions.map((q: string, idx: number) => (
                <li key={idx} className="text-xs text-blue-300 flex items-start gap-2">
                  <span className="text-blue-400">❓</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.query_results && analysis.query_results.length > 0 && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Table className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-medium text-white">Dados</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    {Object.keys(analysis.query_results[0]).map((key) => (
                      <th key={key} className="text-left p-2 text-gray-400 font-medium">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.query_results.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-800">
                      {Object.values(row).map((value: any, cellIdx) => (
                        <td key={cellIdx} className="p-2 text-gray-300">
                          {typeof value === 'number' ? value.toLocaleString() : String(value || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {analysis.query_results.length > 10 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Mostrando 10 de {analysis.query_results.length} resultados
                </p>
              )}
            </div>
          </div>
        )}

        {showDetails && (
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-3">
            {analysis.llm_reasoning && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-1">Raciocínio da IA</h5>
                <p className="text-xs text-gray-500">{analysis.llm_reasoning}</p>
              </div>
            )}
            {analysis.generated_sql && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-1">SQL Executado</h5>
                <pre className="text-xs text-gray-500 bg-black/30 p-2 rounded overflow-x-auto">
                  {analysis.generated_sql}
                </pre>
              </div>
            )}
            <div className="text-xs text-gray-500">
              Criado em: {new Date(analysis.created_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

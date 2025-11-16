import React, { useEffect, useState } from 'react'
import { BarChart3, Table, TrendingUp, Info, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ChartRenderer } from '../Datasets/ChartRenderer'

interface AnalysisData {
  id: string
  user_question: string
  llm_reasoning?: string
  generated_sql?: string
  query_results: any[]
  ai_response: {
    insights?: string[]
    summary?: string
    charts?: Array<{
      type: 'bar' | 'line' | 'pie'
      title: string
      data: any
    }>
  }
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
  const insights = aiResponse.insights || []
  const summary = aiResponse.summary || ''
  const charts = aiResponse.charts || []

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

      <div className="p-4 space-y-4">
        {summary && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h4 className="text-sm font-medium text-white">Resumo</h4>
            </div>
            <p className="text-sm text-gray-300">{summary}</p>
          </div>
        )}

        {insights.length > 0 && (
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

        {charts.length > 0 && (
          <div className="space-y-4">
            {charts.map((chart: any, idx: number) => {
              if (!chart || !chart.type || !chart.data) return null
              return (
                <div key={idx} className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-3">{chart.title || 'Gráfico'}</h4>
                  <ChartRenderer
                    type={chart.type}
                    data={chart.data}
                    title={chart.title || 'Gráfico'}
                  />
                </div>
              )
            })}
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

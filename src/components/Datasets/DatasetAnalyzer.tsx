import React, { useState } from 'react'
import {
  X, Zap, Brain, BarChart3, PieChart, TrendingUp,
  Calculator, AlertTriangle, CheckCircle, Loader2,
  Eye, Download, Copy
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChartRenderer } from './ChartRenderer'
import { DatasetQueryBuilder } from './DatasetQueryBuilder'

interface Dataset {
  id: string
  original_filename: string
  statistical_summary: any
  data_quality_warnings: string[]
  row_count: number
  column_count: number
  has_queryable_data?: boolean
}

interface DatasetAnalyzerProps {
  dataset: Dataset
  onAnalysisCompleted: (result: any) => void
  onClose: () => void
}

export function DatasetAnalyzer({ dataset, onAnalysisCompleted, onClose }: DatasetAnalyzerProps) {
  const { user } = useAuth()
  const [analysisRequest, setAnalysisRequest] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'request' | 'analyzing' | 'results'>('request')

  const quickAnalyses = [
    'Faça uma análise geral dos dados e identifique tendências principais',
    'Calcule estatísticas descritivas para todas as colunas numéricas',
    'Identifique correlações entre as variáveis numéricas',
    'Analise a distribuição dos dados e identifique outliers',
    'Sugira gráficos mais adequados para visualizar estes dados',
    'Calcule métricas de qualidade e completude dos dados'
  ]

  const runAnalysis = async () => {
    if (!analysisRequest.trim()) {
      setError('Digite uma solicitação de análise')
      return
    }

    setAnalyzing(true)
    setStep('analyzing')
    setError('')

    try {
      console.log('[DEBUG] Iniciando análise para dataset:', dataset.id)

      // Use helper to call edge function (it will attempt supabase.functions.invoke then fetch with token)
      console.log('[DEBUG] Chamando analyze-data via helper...')
      const { data: result, error: fnErr } = await (await import('../../lib/functionsClient')).callEdgeFunction('analyze-data', {
        dataset_id: dataset.id,
        analysis_request: analysisRequest.trim()
      });

      if (fnErr) {
        // Mapear erros comuns retornados pelo helper
        const errObj = fnErr || {};
        const code = (errObj as any).status || (errObj as any).statusCode || null;
        let userMessage = (errObj as any).error || 'Erro ao analisar dataset';
        if (code === 403) userMessage = '🔒 Erro de permissão: Não foi possível acessar os dados.';
        if (code === 400) userMessage = `❌ Solicitação inválida: ${(errObj as any).error || 'Verifique sua pergunta'}`;
        if (code === 546) userMessage = '💥 Análise muito complexa. Tente simplificar sua pergunta.';
        if (code >= 500) userMessage = '🔧 Erro no servidor. Tente novamente em alguns instantes.';
        throw new Error(userMessage);
      }

      console.log('[DEBUG] Análise concluída via helper:', result)
      if (!result || !result.success) {
        throw new Error(result?.error || 'Falha na análise')
      }

      setAnalysisResult(result.result)
      setStep('results')
      onAnalysisCompleted(result)

    } catch (err: any) {
      console.error('[DEBUG] Erro na análise:', err)

      // Tratamento de erros de rede
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('🌐 Erro de conexão: Verifique sua internet e tente novamente.')
      } else if (err.message.includes('timeout') || err.message.includes('Timeout')) {
        setError('⏱️ Tempo esgotado: A análise está demorando muito. Tente simplificar sua pergunta.')
      } else {
        setError(err.message || '❌ Erro ao analisar dados. Tente novamente.')
      }

      setStep('request')
    } finally {
      setAnalyzing(false)
    }
  }

  const copyAnalysisJson = async () => {
    if (!analysisResult) return
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2))
      // Feedback visual simples
      const button = document.activeElement as HTMLButtonElement
      if (button) {
        const originalText = button.textContent
        button.textContent = 'Copiado!'
        setTimeout(() => {
          button.textContent = originalText
        }, 2000)
      }
    } catch {
      setError('Erro ao copiar JSON')
    }
  }

  const exportAnalysisReport = () => {
    if (!analysisResult) return

    const report = `
RELATÓRIO DE ANÁLISE DE DADOS
Dataset: ${dataset.original_filename}
Gerado em: ${new Date().toLocaleString('pt-BR')}

SOLICITAÇÃO:
${analysisRequest}

INSIGHTS IDENTIFICADOS:
${analysisResult.insights?.map((insight: any, i: number) => 
  `${i + 1}. ${insight.title} (Confiança: ${insight.confidence}%)
   ${insight.description}`
).join('\n\n') || 'Nenhum insight gerado'}

CÁLCULOS REALIZADOS:
${analysisResult.calculations?.map((calc: any, i: number) => 
  `${i + 1}. ${calc.metric}: ${calc.value}
   ${calc.interpretation}`
).join('\n\n') || 'Nenhum cálculo realizado'}

RECOMENDAÇÕES:
${analysisResult.recommendations?.map((rec: string, i: number) => 
  `${i + 1}. ${rec}`
).join('\n') || 'Nenhuma recomendação'}

NOTAS DE QUALIDADE:
${analysisResult.data_quality_notes?.join('\n') || 'Nenhuma nota de qualidade'}
    `.trim()

    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analise_${dataset.original_filename.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Análise Inteligente de Dados</h2>
              <p className="text-gray-400 text-sm">Dataset: {dataset.original_filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          {step === 'request' && (
            <div className="space-y-6">
              {/* Query Builder (if queryable data available) */}
              {dataset.has_queryable_data && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Query Dinâmica</h3>
                  <DatasetQueryBuilder
                    datasetId={dataset.id}
                    hasQueryableData={dataset.has_queryable_data}
                    onQueryExecuted={(result) => {
                      console.log('[DEBUG] Query executed in analyzer:', result)
                    }}
                  />
                </div>
              )}

              {/* Dataset Summary */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Resumo do Dataset</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{dataset.row_count.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm">Linhas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{dataset.column_count}</p>
                    <p className="text-gray-400 text-sm">Colunas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">
                      {dataset.statistical_summary?.data_quality_score || 0}%
                    </p>
                    <p className="text-gray-400 text-sm">Qualidade</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{dataset.data_quality_warnings.length}</p>
                    <p className="text-gray-400 text-sm">Avisos</p>
                  </div>
                </div>

                {/* Column Types Preview */}
                {dataset.statistical_summary?.columns && (
                  <div>
                    <h4 className="text-white font-medium mb-2">Tipos de Colunas:</h4>
                    <div className="flex flex-wrap gap-2">
                      {dataset.statistical_summary.columns.map((col: any, index: number) => (
                        <span key={index} className={`px-2 py-1 text-xs rounded-full ${
                          col.type === 'numeric' ? 'bg-blue-900/20 border border-blue-500/30 text-blue-400' :
                          col.type === 'text' ? 'bg-gray-900/20 border border-gray-500/30 text-gray-400' :
                          col.type === 'date' ? 'bg-green-900/20 border border-green-500/30 text-green-400' :
                          'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400'
                        }`}>
                          {col.name} ({col.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Request */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Solicitação de Análise</h3>
                
                {/* Quick Options */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Análises Rápidas
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                    {quickAnalyses.map((quick, index) => (
                      <button
                        key={index}
                        onClick={() => setAnalysisRequest(quick)}
                        className="text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                      >
                        {quick}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Request */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Solicitação Personalizada
                  </label>
                  <textarea
                    value={analysisRequest}
                    onChange={(e) => setAnalysisRequest(e.target.value)}
                    placeholder="Descreva que tipo de análise você gostaria de fazer com estes dados..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 resize-none"
                  />
                </div>

                <button
                  onClick={runAnalysis}
                  disabled={!analysisRequest.trim() || analyzing}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {analyzing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  {analyzing ? 'Analisando...' : 'Executar Análise'}
                </button>
              </div>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">IA Analisando Dados</h3>
              <p className="text-gray-400 text-sm mb-4">
                Processando resumo estatístico e gerando insights...
              </p>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 max-w-md mx-auto">
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <span>Analisando padrões nos dados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Calculando métricas avançadas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Gerando recomendações</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'results' && analysisResult && (
            <div className="space-y-6">
              {/* Analysis Header */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Resultados da Análise</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyAnalysisJson}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar JSON
                    </button>
                    <button
                      onClick={exportAnalysisReport}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Exportar
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  <strong>Solicitação:</strong> {analysisRequest}
                </p>
              </div>

              {/* Transparency Section */}
              {analysisResult.execution_details && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                  <h3 className="text-blue-400 font-semibold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Transparência da Análise
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {analysisResult.execution_details.total_rows_analyzed?.toLocaleString()}
                      </div>
                      <div className="text-blue-300 text-sm">Linhas Analisadas</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {analysisResult.execution_details.queries_executed}
                      </div>
                      <div className="text-blue-300 text-sm">Consultas SQL Executadas</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {analysisResult.execution_details.columns_available}
                      </div>
                      <div className="text-blue-300 text-sm">Colunas Disponíveis</div>
                    </div>
                  </div>
                  <p className="text-blue-200 text-sm mt-4">
                    A IA analisou dados reais, gerou SQL customizado, executou consultas no PostgreSQL e interpretou os resultados.
                  </p>
                </div>
              )}

              {/* Insights */}
              {analysisResult.insights && analysisResult.insights.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Insights Identificados
                  </h3>
                  <div className="space-y-3">
                    {analysisResult.insights.map((insight: any, index: number) => (
                      <div key={index} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium">{insight.title}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            insight.confidence >= 80 ? 'bg-green-900/20 border border-green-500/30 text-green-400' :
                            insight.confidence >= 60 ? 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400' :
                            'bg-red-900/20 border border-red-500/30 text-red-400'
                          }`}>
                            {insight.confidence}% confiança
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm">{insight.description}</p>
                        <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                          insight.type === 'trend' ? 'bg-blue-900/20 text-blue-400' :
                          insight.type === 'correlation' ? 'bg-purple-900/20 text-purple-400' :
                          insight.type === 'outlier' ? 'bg-red-900/20 text-red-400' :
                          'bg-gray-900/20 text-gray-400'
                        }`}>
                          {insight.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculations */}
              {analysisResult.calculations && analysisResult.calculations.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Cálculos Realizados
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysisResult.calculations.map((calc: any, index: number) => (
                      <div key={index} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-medium text-sm">{calc.metric}</h4>
                          <span className="text-blue-400 font-mono text-sm">{calc.value}</span>
                        </div>
                        {calc.formula && (
                          <p className="text-gray-500 text-xs font-mono mb-1">{calc.formula}</p>
                        )}
                        <p className="text-gray-300 text-xs">{calc.interpretation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charts */}
              {analysisResult.charts && analysisResult.charts.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Gráficos Sugeridos
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {analysisResult.charts.map((chart: any, index: number) => (
                      <ChartRenderer key={index} chartConfig={chart} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Recomendações
                  </h3>
                  <ul className="space-y-2">
                    {analysisResult.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-gray-300 text-sm">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data Quality Notes */}
              {analysisResult.data_quality_notes && analysisResult.data_quality_notes.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
                  <h3 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Notas de Qualidade dos Dados
                  </h3>
                  <ul className="space-y-1">
                    {analysisResult.data_quality_notes.map((note: string, index: number) => (
                      <li key={index} className="text-yellow-300 text-sm">• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-medium">Erro na análise</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
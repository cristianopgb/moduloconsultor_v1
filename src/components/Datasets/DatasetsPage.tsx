import React, { useState, useEffect } from 'react'
import {
  Upload, FileSpreadsheet, BarChart3, TrendingUp, AlertTriangle,
  CheckCircle, Eye, Download, Trash2, RefreshCw, Calculator,
  PieChart, Activity, Database, Clock, FileText
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DatasetUploader } from './DatasetUploader'
import { ChartRenderer } from './ChartRenderer'

interface Dataset {
  id: string
  user_id: string
  conversation_id?: string
  original_filename: string
  file_size: number
  mime_type: string
  storage_bucket: string
  storage_path: string
  normalized_csv_path?: string
  statistical_summary: any
  data_quality_warnings: string[]
  row_count: number
  column_count: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

interface Analysis {
  id: string
  dataset_id: string
  user_id: string
  analysis_request: string
  llm_response: any
  charts_config?: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

export function DatasetsPage() {
  const { user } = useAuth()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      const [datasetsResult, analysesResult] = await Promise.all([
        supabase
          .from('datasets')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('analyses')
          .select('*')
          .order('created_at', { ascending: false })
      ])

      if (datasetsResult.error) throw datasetsResult.error
      if (analysesResult.error) throw analysesResult.error

      setDatasets(datasetsResult.data || [])
      setAnalyses(analysesResult.data || [])

      console.log('[DEBUG] Dados carregados:', {
        datasets: datasetsResult.data?.length || 0,
        analyses: analysesResult.data?.length || 0
      })

    } catch (err: any) {
      console.error('[DEBUG] Erro ao carregar dados:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDatasetProcessed = (result: any) => {
    console.log('[DEBUG] Dataset processado:', result)
    setSuccess('Dataset processado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
    loadData() // Recarregar lista
    setShowUploader(false)
  }


  const deleteDataset = async (datasetId: string) => {
    if (!confirm('Tem certeza que deseja excluir este dataset?')) return

    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', datasetId)

      if (error) throw error

      setDatasets(prev => prev.filter(d => d.id !== datasetId))
      setSuccess('Dataset excluído com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const downloadCsv = async (dataset: Dataset) => {
    if (!dataset.normalized_csv_path) {
      setError('CSV normalizado não disponível')
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from('datasets')
        .download(dataset.normalized_csv_path)

      if (error) throw error

      const blob = new Blob([data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset.original_filename.replace(/\.[^/.]+$/, '')}_normalized.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-400" />
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-900/20 border-green-500/30'
      case 'processing':
        return 'text-blue-400 bg-blue-900/20 border-blue-500/30'
      case 'failed':
        return 'text-red-400 bg-red-900/20 border-red-500/30'
      default:
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Agora mesmo'
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h atrás`
    
    return `${Math.floor(diffInHours / 24)}d atrás`
  }

  const getDatasetAnalyses = (datasetId: string) => {
    return analyses.filter(a => a.dataset_id === datasetId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Análise de Dados</h1>
          <p className="text-gray-400">Pipeline seguro para processamento e análise de planilhas Excel</p>
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-5 h-5" />
          Upload Excel
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{datasets.length}</p>
            <p className="text-sm text-gray-400 mb-2">Datasets</p>
            <p className="text-xs text-gray-500">
              {datasets.filter(d => d.processing_status === 'completed').length} processados
            </p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{analyses.length}</p>
            <p className="text-sm text-gray-400 mb-2">Análises</p>
            <p className="text-xs text-gray-500">
              {analyses.filter(a => a.status === 'completed').length} concluídas
            </p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            
            <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
              <Calculator className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">
              {datasets.reduce((sum, d) => sum + d.row_count, 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mb-2">Linhas Processadas</p>
            <p className="text-xs text-gray-500">Total de registros</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">
              {Math.round(
                datasets.reduce((sum, d) => sum + (d.statistical_summary?.data_quality_score || 0), 0) / 
                Math.max(1, datasets.length)
              )}%
            </p>
            <p className="text-sm text-gray-400 mb-2">Qualidade Média</p>
            <p className="text-xs text-gray-500">Score dos dados</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Datasets List */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Datasets Processados</h2>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {datasets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum dataset processado</p>
            <p className="text-sm mb-4">Faça upload de uma planilha Excel para começar</p>
            <button
              onClick={() => setShowUploader(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5" />
              Upload Excel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {datasets.map((dataset) => {
              const datasetAnalyses = getDatasetAnalyses(dataset.id)
              const qualityScore = dataset.statistical_summary?.data_quality_score || 0
              
              return (
                <div key={dataset.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(dataset.processing_status)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-white font-semibold">{dataset.original_filename}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(dataset.processing_status)}`}>
                              {dataset.processing_status === 'completed' ? 'Processado' :
                               dataset.processing_status === 'processing' ? 'Processando' :
                               dataset.processing_status === 'failed' ? 'Falhou' : 'Pendente'}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full border ${
                              qualityScore >= 80 ? 'text-green-400 bg-green-900/20 border-green-500/30' :
                              qualityScore >= 60 ? 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30' :
                              'text-red-400 bg-red-900/20 border-red-500/30'
                            }`}>
                              Qualidade: {qualityScore}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{formatFileSize(dataset.file_size)}</p>
                          <p className="text-gray-400 text-xs">
                            {dataset.row_count.toLocaleString()} × {dataset.column_count} células
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(dataset.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          <span>{datasetAnalyses.length} análise(s)</span>
                        </div>
                        {dataset.data_quality_warnings.length > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            <span className="text-yellow-400">{dataset.data_quality_warnings.length} aviso(s)</span>
                          </div>
                        )}
                      </div>

                      {/* Data Quality Warnings */}
                      {dataset.data_quality_warnings.length > 0 && (
                        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-3">
                          <h4 className="text-yellow-400 font-medium text-sm mb-2">Avisos de Qualidade:</h4>
                          <ul className="text-yellow-300 text-xs space-y-1">
                            {dataset.data_quality_warnings.map((warning, index) => (
                              <li key={index}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Statistical Summary Preview */}
                      {dataset.statistical_summary?.columns && (
                        <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                          <h4 className="text-gray-300 font-medium text-sm mb-2">Resumo Estatístico:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            {dataset.statistical_summary.columns.slice(0, 4).map((col: any, index: number) => (
                              <div key={index} className="bg-gray-700/50 rounded p-2">
                                <div className="text-white font-medium truncate">{col.name}</div>
                                <div className="text-gray-400 capitalize">{col.type}</div>
                                {col.stats?.mean && (
                                  <div className="text-gray-500">Média: {col.stats.mean.toFixed(2)}</div>
                                )}
                              </div>
                            ))}
                            {dataset.statistical_summary.columns.length > 4 && (
                              <div className="bg-gray-700/50 rounded p-2 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">
                                  +{dataset.statistical_summary.columns.length - 4} colunas
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Recent Analyses */}
                      {datasetAnalyses.length > 0 && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                          <h4 className="text-blue-400 font-medium text-sm mb-2">Análises Recentes:</h4>
                          <div className="space-y-1">
                            {datasetAnalyses.slice(0, 2).map((analysis) => (
                              <div key={analysis.id} className="flex items-center justify-between text-xs">
                                <span className="text-blue-300 truncate">{analysis.analysis_request}</span>
                                <span className="text-gray-400 ml-2">{formatTime(analysis.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {dataset.processing_status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadCsv(dataset)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            CSV
                          </button>
                          <button
                            onClick={() => deleteDataset(dataset.id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showUploader && (
        <DatasetUploader
          onProcessed={handleDatasetProcessed}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  )
}
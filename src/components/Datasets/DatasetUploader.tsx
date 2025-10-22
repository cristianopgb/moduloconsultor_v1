import React, { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, X, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface DatasetUploaderProps {
  onProcessed: (result: any) => void
  onClose: () => void
}

export function DatasetUploader({ onProcessed, onClose }: DatasetUploaderProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'select' | 'processing' | 'completed'>('select')

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validações
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Apenas arquivos .xlsx são suportados')
      return
    }

    // Limite reduzido para 25MB para garantir performance e custos controlados
    const MAX_SIZE_MB = 25
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo permitido: ${MAX_SIZE_MB}MB. Para arquivos maiores, considere filtrar ou dividir os dados.`)
      return
    }

    setSelectedFile(file)
    setError('')
    console.log('[DEBUG] Arquivo selecionado:', {
      name: file.name,
      size: file.size,
      type: file.type,
      sizeMB: (file.size / 1024 / 1024).toFixed(2)
    })
  }

  const processFile = async () => {
    if (!selectedFile || !user) return

    setProcessing(true)
    setStep('processing')
    setError('')

    try {
      console.log('[DEBUG] Iniciando processamento do arquivo:', selectedFile.name)

      // Converter arquivo para Base64
      const arrayBuffer = await selectedFile.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      console.log('[DEBUG] Arquivo convertido para Base64, tamanho:', base64.length)

      // Obter token da sessão
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('Usuário não autenticado. Faça login novamente.')
      }

      // Chamar Edge Function (helper centralizado tentará supabase.functions.invoke ou fetch com token)
      console.log('[DEBUG] Chamando process-excel Edge Function via helper...')
      const { data: result, error: fnErr } = await (await import('../../lib/functionsClient')).callEdgeFunction('process-excel', {
        file_data: base64,
        filename: selectedFile.name,
        conversation_id: null
      });

      if (fnErr) {
        // try to map common errors if provided by the function
        const errorData = fnErr || {};

        // Mapear erros específicos para mensagens user-friendly
        let userMessage = errorData?.error || 'Erro ao processar arquivo via função'
        // If helper returned status details, map common codes
        if (errorData && typeof errorData === 'object') {
          const code = (errorData as any).status || (errorData as any).statusCode || null;
          if (code === 403) userMessage = '🔒 Erro de permissão: Não foi possível fazer upload do arquivo. Verifique sua conexão e tente novamente.'
          if (code === 400 && (errorData as any).error_type === 'FILE_TOO_LARGE') userMessage = '📁 Arquivo muito grande! O tamanho máximo é 25MB.'
          if (code === 400 && (errorData as any).error_type === 'DATASET_TOO_COMPLEX') userMessage = '⚡ Dataset muito complexo! Filtre os dados ou divida em partes menores.'
          if (code >= 500) userMessage = '🔧 Erro no servidor. Tente novamente em alguns instantes.'
        }
        throw new Error(userMessage)
      }

      console.log('[DEBUG] Processamento concluído via helper:', result)
      if (!result || !result.success) {
        throw new Error(result?.error || 'Falha no processamento')
      }

      setStep('completed')
      onProcessed(result)

    } catch (err: any) {
      console.error('[DEBUG] Erro no processamento:', err)

      // Tratamento de erros de rede
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('🌐 Erro de conexão: Verifique sua internet e tente novamente.')
      } else if (err.message.includes('timeout') || err.message.includes('Timeout')) {
        setError('⏱️ Tempo esgotado: O processamento está demorando muito. Tente com um arquivo menor.')
      } else {
        setError(err.message || '❌ Erro ao processar arquivo. Tente novamente.')
      }

      setStep('select')
    } finally {
      setProcessing(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Upload de Dataset Excel</h2>
              <p className="text-gray-400 text-sm">Pipeline seguro de processamento e análise</p>
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
        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-6">
              {/* File Selection */}
              <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-gray-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Selecione uma planilha Excel</p>
                <p className="text-gray-400 text-sm mb-2">Apenas arquivos .xlsx • Máximo 25MB</p>
                <p className="text-gray-500 text-xs">Limite ideal para análise interativa rápida (&lt; 45s)</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Escolher Arquivo
                </button>
              </div>

              {/* Selected File Info */}
              {selectedFile && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <FileSpreadsheet className="w-6 h-6 text-green-400" />
                    <div className="flex-1">
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-gray-400 text-sm">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>

                  {/* Estimativa de tempo */}
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 font-medium text-sm">⏱️ Tempo Estimado de Processamento</span>
                      <span className="text-green-300 font-bold">
                        {selectedFile.size < 5 * 1024 * 1024 ? '< 20s' :
                         selectedFile.size < 15 * 1024 * 1024 ? '20-35s' : '35-45s'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                    <h4 className="text-blue-400 font-medium text-sm mb-2">Pipeline de Processamento:</h4>
                    <ul className="text-blue-300 text-xs space-y-1">
                      <li>1. Parse e validação dos dados</li>
                      <li>2. Normalização e detecção de tipos</li>
                      <li>3. Cálculo de estatísticas determinísticas</li>
                      <li>4. Geração de CSV normalizado</li>
                      <li>5. Análise de qualidade dos dados</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Process Button */}
              {selectedFile && (
                <button
                  onClick={processFile}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Processar Dataset
                </button>
              )}
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Processando Dataset</h3>
              <p className="text-gray-400 text-sm mb-4">
                Analisando estrutura, calculando estatísticas e normalizando dados...
              </p>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 max-w-md mx-auto">
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Validando estrutura da planilha</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span>Detectando tipos de dados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Calculando estatísticas</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Dataset Processado!</h3>
              <p className="text-gray-400 text-sm mb-4">
                Arquivo analisado e normalizado com sucesso
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-medium">Erro no processamento</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
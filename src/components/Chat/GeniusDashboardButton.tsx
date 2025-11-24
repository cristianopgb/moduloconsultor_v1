import React, { useState, useEffect } from 'react'
import { BarChart3, Loader2, AlertCircle, Sparkles, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getGeniusCredits, type GeniusCreditsInfo } from '../../lib/geniusCredits'
import { GeniusApiService } from '../../services/geniusApi'

interface GeniusDashboardButtonProps {
  conversationId: string
  analysisId: string
  originalTaskId: string
  onDashboardCreated?: (taskId: string, message: any) => void
}

export function GeniusDashboardButton({
  conversationId,
  analysisId,
  originalTaskId,
  onDashboardCreated
}: GeniusDashboardButtonProps) {
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<GeniusCreditsInfo | null>(null)
  const [error, setError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    loadUserAndCredits()
  }, [])

  const loadUserAndCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserId(user.id)
    const creditsInfo = await getGeniusCredits(user.id)
    setCredits(creditsInfo)
  }

  const handleConfirm = async () => {
    setShowConfirmModal(false)
    setLoading(true)
    setError('')

    try {
      // 1. Verificar créditos
      if (!credits || credits.credits_available < 1) {
        setError('Créditos Genius insuficientes')
        return
      }

      // 2. Buscar análise original para obter dataset_id
      const { data: originalAnalysis } = await supabase
        .from('data_analyses')
        .select('dataset_id, file_metadata')
        .eq('id', analysisId)
        .maybeSingle()

      // 3. Preparar arquivo (reusar do dataset original se disponível)
      let file: { filename: string; content: string; size_bytes: number; mime_type: string } | null = null

      if (originalAnalysis?.dataset_id) {
        file = await prepareFileForGenius(originalAnalysis.dataset_id, originalAnalysis.file_metadata)
      }

      // 4. Montar prompt para dashboard interativo
      const dashboardPrompt = `
Baseado na análise anterior (Task ID: ${originalTaskId}), gere um dashboard web interativo HTML completo.

Requisitos:
- Visualizações gráficas dos principais KPIs e métricas
- Filtros interativos para exploração de dados
- Design responsivo e profissional (mobile-friendly)
- Tema escuro/claro
- Arquivo único HTML autocontido com CSS e JavaScript embutidos

Foco em apresentação executiva visual e interativa dos insights.
      `.trim()

      // 5. Adicionar mensagem do usuário
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: '📊 Solicitando dashboard interativo...',
          message_type: 'text',
          user_id: userId
        })

      // 6. Adicionar mensagem placeholder do assistente
      const { data: placeholderMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Gerando dashboard interativo com Genius AI...',
          message_type: 'genius_result',
          genius_status: 'pending',
          analysis_source_id: analysisId
        })
        .select()
        .single()

      if (!placeholderMsg) {
        throw new Error('Falha ao criar mensagem placeholder')
      }

      // 7. Criar tarefa no Manus
      const response = await GeniusApiService.createTask({
        prompt: dashboardPrompt,
        files: file ? [file] : [],
        conversationId,
        history: []
      })

      if (!response.success) {
        throw new Error(response.error || 'Falha ao criar tarefa Genius')
      }

      console.log('[GeniusDashboard] Task created successfully:', response.task_id)

      // 8. Atualizar placeholder com task_id
      const { data: updatedMsg } = await supabase
        .from('messages')
        .update({ external_task_id: response.task_id })
        .eq('id', placeholderMsg.id)
        .select()
        .single()

      // 9. Atualizar créditos localmente (otimista)
      setCredits(prev => prev ? {
        ...prev,
        credits_available: Math.max(0, prev.credits_available - 1),
        credits_used: prev.credits_used + 1
      } : null)

      // 10. Notificar callback
      const messageToAdd = updatedMsg || {
        ...placeholderMsg,
        external_task_id: response.task_id
      }
      onDashboardCreated?.(response.task_id, messageToAdd)

    } catch (err: any) {
      console.error('[GeniusDashboard] Error:', err)
      setError(err.message || 'Erro ao criar dashboard')
    } finally {
      setLoading(false)
    }
  }

  const prepareFileForGenius = async (
    datasetId: string,
    metadata: any
  ): Promise<{ filename: string; content: string; size_bytes: number; mime_type: string } | null> => {
    try {
      const { data: dataset } = await supabase
        .from('datasets')
        .select('storage_path, storage_bucket, original_filename, file_size, mime_type')
        .eq('id', datasetId)
        .maybeSingle()

      if (!dataset || !dataset.storage_path || dataset.storage_path.startsWith('memory://')) {
        return null
      }

      const bucket = dataset.storage_bucket || 'references'
      const { data: fileBlob } = await supabase.storage
        .from(bucket)
        .download(dataset.storage_path)

      if (!fileBlob) return null

      const base64 = await blobToBase64(fileBlob)

      return {
        filename: dataset.original_filename || metadata?.name || 'arquivo.csv',
        content: base64,
        size_bytes: dataset.file_size || metadata?.size || fileBlob.size,
        mime_type: dataset.mime_type || metadata?.mime_type || 'text/csv'
      }
    } catch (error) {
      console.error('[GeniusDashboard] Error preparing file:', error)
      return null
    }
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        const base64Data = base64.split(',')[1] || base64
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const hasCredits = credits && credits.credits_available > 0

  return (
    <>
      <div className="mt-4 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>

          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">
              Deseja um dashboard interativo?
            </h4>
            <p className="text-sm text-gray-300 mb-3">
              Visualize os dados com gráficos, métricas e filtros interativos em uma página web responsiva.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/30 p-2 rounded mb-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={loading || !hasCredits}
              className={`
                flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                font-medium text-sm transition-all duration-300
                ${hasCredits
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }
                ${loading ? 'opacity-75' : ''}
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  <span>Gerar Dashboard</span>
                  {credits && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      -1 <Sparkles className="w-3 h-3 inline" />
                    </span>
                  )}
                </>
              )}
            </button>

            {!hasCredits && !loading && (
              <p className="text-xs text-yellow-400/80 flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3" />
                Sem créditos Genius disponíveis
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-blue-500/30 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Dashboard Interativo</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-300 mb-4 leading-relaxed">
              O Genius vai criar um dashboard web completo com visualizações interativas,
              gráficos dinâmicos e filtros baseados na análise anterior.
            </p>

            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-200 font-medium">Custo adicional:</p>
                <p className="text-lg font-bold text-blue-300">1 crédito</p>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-300/70">Créditos disponíveis:</span>
                <span className="text-blue-200 font-semibold">
                  {credits?.credits_available || 0} <Sparkles className="w-3 h-3 inline" />
                </span>
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-300 mb-2">
                <strong>O que será gerado:</strong>
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Dashboard HTML interativo</li>
                <li>• Gráficos e visualizações dinâmicas</li>
                <li>• Filtros e controles interativos</li>
                <li>• Design responsivo (mobile-friendly)</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition shadow-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

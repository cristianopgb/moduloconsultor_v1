import React, { useState, useEffect } from 'react'
import { Wand2, Loader2, AlertCircle, CheckCircle, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getGeniusCredits, getCreditsErrorMessage, type GeniusCreditsInfo } from '../../lib/geniusCredits'
import { GeniusApiService } from '../../services/geniusApi'
import { prepareFilesForUpload } from '../../utils/geniusValidation'

interface GeniusUpgradeButtonProps {
  analysisId: string
  datasetId?: string
  fileMetadata: any
  userQuestion: string
  conversationId: string
  userId: string
  onGeniusCreated?: (taskId: string, message: any) => void
  disabled?: boolean
}

export function GeniusUpgradeButton({
  analysisId,
  datasetId,
  fileMetadata,
  userQuestion,
  conversationId,
  userId,
  onGeniusCreated,
  disabled = false
}: GeniusUpgradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<GeniusCreditsInfo | null>(null)
  const [error, setError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [existingGeniusId, setExistingGeniusId] = useState<string | null>(null)
  const [checkingExisting, setCheckingExisting] = useState(true)

  useEffect(() => {
    loadCreditsAndCheckExisting()
  }, [userId, analysisId])

  const loadCreditsAndCheckExisting = async () => {
    setCheckingExisting(true)

    // 1. Buscar créditos
    const creditsInfo = await getGeniusCredits(userId)
    setCredits(creditsInfo)

    // 2. Verificar se já existe análise Genius para esta análise
    const { data: existing } = await supabase
      .from('messages')
      .select('id, external_task_id, genius_status')
      .eq('conversation_id', conversationId)
      .eq('message_type', 'genius_result')
      .eq('analysis_source_id', analysisId)
      .maybeSingle()

    if (existing) {
      setExistingGeniusId(existing.id)
    }

    setCheckingExisting(false)
  }

  const handleClick = () => {
    if (existingGeniusId) {
      // Se já existe, fazer scroll até a mensagem
      scrollToGeniusMessage(existingGeniusId)
    } else {
      // Se não existe, abrir modal de confirmação
      setShowConfirmModal(true)
    }
  }

  const scrollToGeniusMessage = (messageId: string) => {
    const element = document.querySelector(`[data-message-id="${messageId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight temporário
      element.classList.add('ring-2', 'ring-purple-500')
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-purple-500')
      }, 2000)
    }
  }

  const handleConfirm = async () => {
    setShowConfirmModal(false)
    setLoading(true)
    setError('')

    try {
      // 1. Verificar créditos novamente
      if (!credits || credits.credits_available < 1) {
        setError('Créditos Genius insuficientes')
        return
      }

      // 2. Preparar arquivo
      if (!datasetId) {
        setError('Arquivo original não encontrado. Não é possível gerar análise Genius.')
        return
      }

      const file = await prepareFileForGenius(datasetId, fileMetadata)
      if (!file) {
        setError('Não foi possível recuperar o arquivo original.')
        return
      }

      // 3. Montar prompt enriquecido (focado em relatório executivo)
      const enrichedPrompt = `
${userQuestion}

Contexto: Análise aprofundada complementar solicitada pelo usuário.

Por favor, gere um relatório executivo detalhado respondendo a pergunta acima.
Foco em insights acionáveis e recomendações estratégicas para tomada de decisão.
      `.trim()

      // 4. Adicionar mensagem do usuário
      const { data: userMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: '✨ Solicitando análise aprofundada com Genius...',
          message_type: 'text',
          user_id: userId
        })
        .select()
        .single()

      // 5. Adicionar mensagem placeholder do assistente
      const { data: placeholderMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Processando análise avançada com Genius AI...',
          message_type: 'genius_result',
          genius_status: 'pending',
          analysis_source_id: analysisId
        })
        .select()
        .single()

      if (!placeholderMsg) {
        throw new Error('Falha ao criar mensagem placeholder')
      }

      // 6. Criar tarefa no Manus
      const response = await GeniusApiService.createTask({
        prompt: enrichedPrompt,
        files: [file],
        conversationId,
        history: []
      })

      if (!response.success) {
        throw new Error(response.error || 'Falha ao criar tarefa Genius')
      }

      console.log('[GeniusUpgrade] Task created successfully:', response.task_id)

      // 7. Atualizar placeholder com task_id
      const { data: updatedMsg } = await supabase
        .from('messages')
        .update({ external_task_id: response.task_id })
        .eq('id', placeholderMsg.id)
        .select()
        .single()

      // 8. Atualizar estado local
      setExistingGeniusId(placeholderMsg.id)

      // 9. Atualizar créditos localmente (otimista)
      setCredits(prev => prev ? {
        ...prev,
        credits_available: Math.max(0, prev.credits_available - 1),
        credits_used: prev.credits_used + 1
      } : null)

      // 10. Notificar callback COM A MENSAGEM COMPLETA para adicionar ao estado local
      const messageToAdd = updatedMsg || {
        ...placeholderMsg,
        external_task_id: response.task_id
      }
      onGeniusCreated?.(response.task_id, messageToAdd)

      // 11. Scroll automático será feito pelo ChatPage após adicionar mensagem
      // Não precisa mais fazer scroll aqui

    } catch (err: any) {
      console.error('[GeniusUpgrade] Error:', err)
      setError(err.message || 'Erro ao criar análise Genius')
    } finally {
      setLoading(false)
    }
  }

  // Preparar arquivo para Genius
  const prepareFileForGenius = async (
    datasetId: string,
    metadata: any
  ): Promise<{ filename: string; content: string; size_bytes: number; mime_type: string } | null> => {
    try {
      // Buscar dataset
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .select('storage_path, storage_bucket, original_filename, file_size, mime_type')
        .eq('id', datasetId)
        .maybeSingle()

      if (datasetError || !dataset) {
        console.error('[GeniusUpgrade] Dataset not found:', datasetId)
        return null
      }

      console.log('[GeniusUpgrade] Dataset found:', {
        id: datasetId,
        bucket: dataset.storage_bucket,
        path: dataset.storage_path,
        filename: dataset.original_filename
      })

      // Validar que não é um path "memory://"
      if (!dataset.storage_path || dataset.storage_path.startsWith('memory://')) {
        console.error('[GeniusUpgrade] Invalid storage_path (memory://). Dataset was not properly connected to storage.')
        return null
      }

      // Determinar bucket correto
      const bucket = dataset.storage_bucket || 'references'

      // Baixar arquivo do storage
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(dataset.storage_path)

      if (downloadError || !fileBlob) {
        console.error('[GeniusUpgrade] Failed to download file:', {
          error: downloadError,
          bucket,
          path: dataset.storage_path
        })
        return null
      }

      console.log('[GeniusUpgrade] File downloaded successfully:', {
        size: fileBlob.size,
        type: fileBlob.type
      })

      // Converter para base64
      const base64 = await blobToBase64(fileBlob)

      return {
        filename: dataset.original_filename || metadata.name || 'arquivo.csv',
        content: base64,
        size_bytes: dataset.file_size || metadata.size || fileBlob.size,
        mime_type: dataset.mime_type || metadata.mime_type || 'text/csv'
      }
    } catch (error) {
      console.error('[GeniusUpgrade] Error preparing file:', error)
      return null
    }
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        // Remover prefixo "data:*/*;base64,"
        const base64Data = base64.split(',')[1] || base64
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  if (checkingExisting) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Verificando...</span>
      </div>
    )
  }

  const buttonLabel = existingGeniusId ? 'Ver Análise Genius' : 'Aprofundar com Genius'
  const buttonIcon = existingGeniusId ? <CheckCircle className="w-4 h-4" /> : <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
  const hasCredits = credits && credits.credits_available > 0

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={handleClick}
          disabled={disabled || loading || (!existingGeniusId && !hasCredits)}
          className={`
            flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg
            font-medium text-sm transition-all duration-300 group
            ${existingGeniusId
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/40'
              : hasCredits
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }
            ${loading ? 'opacity-75' : ''}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              {buttonIcon}
              <span>{buttonLabel}</span>
              {!existingGeniusId && credits && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {credits.credits_available} <Sparkles className="w-3 h-3 inline" />
                </span>
              )}
            </>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 p-2 rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!existingGeniusId && !hasCredits && !loading && (
          <p className="text-xs text-yellow-400/80 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Sem créditos Genius disponíveis
          </p>
        )}
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-purple-500/30 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                <Wand2 className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Análise Genius</h3>
            </div>

            <p className="text-gray-300 mb-4 leading-relaxed">
              O Genius vai gerar um relatório executivo detalhado com insights acionáveis
              e recomendações estratégicas baseadas na sua pergunta original.
            </p>

            <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-purple-200 font-medium">Custo da análise:</p>
                <p className="text-lg font-bold text-purple-300">1 crédito</p>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-300/70">Créditos disponíveis:</span>
                <span className="text-purple-200 font-semibold">
                  {credits?.credits_available || 0} <Sparkles className="w-3 h-3 inline" />
                </span>
              </div>
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

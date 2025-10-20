import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Clipboard, FileText, Kanban } from 'lucide-react'
import { JornadaTimeline } from './Timeline/JornadaTimeline'
import { PainelEntregaveis } from './Entregaveis/PainelEntregaveis'
import { KanbanExecucao } from './Kanban/KanbanExecucao'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { JornadaConsultor } from '../../types/consultor'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface LateralConsultorProps {
  conversationId: string
}

const DOC_COUNT_KEY = (convId: string) => `consultor:last_doc_count:${convId}`
const LAST_CONV_KEY = 'last_consultor_conversation_id'

export function LateralConsultor({ conversationId }: LateralConsultorProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'jornada' | 'entregaveis' | 'kanban'>('jornada')
  const [jornada, setJornada] = useState<JornadaConsultor | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [newDeliverablesCount, setNewDeliverablesCount] = useState(0)

  // Um único canal com múltiplas escutas
  const channelRef = useRef<RealtimeChannel | null>(null)

  // ===== Helpers de contagem de docs (para badge persistente) =====
  const getStoredDocCount = useCallback((): number => {
    const raw = localStorage.getItem(DOC_COUNT_KEY(conversationId))
    return raw ? Number(raw) || 0 : 0
  }, [conversationId])

  const setStoredDocCount = useCallback((count: number) => {
    localStorage.setItem(DOC_COUNT_KEY(conversationId), String(count))
  }, [conversationId])

  // ===== Reset visual ao trocar de conversa =====
  const resetIfNewConversation = useCallback(() => {
    const lastConv = localStorage.getItem(LAST_CONV_KEY)
    if (lastConv !== conversationId) {
      localStorage.setItem(LAST_CONV_KEY, conversationId)
      setNewDeliverablesCount(0)
      setStoredDocCount(0)
    }
  }, [conversationId, setStoredDocCount])

  // ===== Busca a jornada existente pela conversa (alinhado ao índice único) =====
  const fetchExistingByConversation = useCallback(async () => {
    return supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle()
  }, [conversationId])

  // ===== Carrega/Cria jornada (idempotente; compatível com unique(conversation_id)) =====
  const loadJornada = useCallback(
    async (showLoader = true) => {
      if (!user?.id) {
        console.warn('[LateralConsultor] Usuário não autenticado')
        return
      }
      if (showLoader) setLoading(true)

      try {
        const { data, error } = await fetchExistingByConversation()
        if (error) throw error

        if (data) {
          // Já existe para esta conversa
          setJornada(data as JornadaConsultor)
        } else {
          // Cria uma vez para a conversa atual (alvo do índice único)
          const { data: upserted, error: upErr } = await supabase
            .from('jornadas_consultor')
            .upsert(
              {
                user_id: user.id,
                conversation_id: conversationId,
                etapa_atual: 'anamnese',
                progresso_geral: 0,
                contexto_coleta: {},
                resumo_etapa: {},
                aguardando_validacao: null,
              },
              // *** IMPORTANTE: precisa casar com o índice único ("uq_jornada_conversation") ***
              { onConflict: 'conversation_id' }
            )
            .select()
            .single()

          if (upErr) throw upErr
          setJornada(upserted as JornadaConsultor)
        }

        // Atualiza “última atualização”
        setLastUpdate(new Date())

        // Sincroniza contagem inicial de docs para badge persistente
        const jId = (data as any)?.id || (await fetchExistingByConversation()).data?.id
        if (jId) {
          const { count } = await supabase
            .from('entregaveis_consultor')
            .select('*', { count: 'exact', head: true })
            .eq('jornada_id', jId)
          const curr = count || 0
          const stored = getStoredDocCount()
          if (stored !== curr) setStoredDocCount(curr)
        }
      } catch (err) {
        console.error('[LateralConsultor] Erro ao carregar jornada:', err)
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [user?.id, conversationId, fetchExistingByConversation, getStoredDocCount, setStoredDocCount]
  )

  // ===== Inicialização =====
  useEffect(() => {
    resetIfNewConversation()
    void loadJornada()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId, user?.id, resetIfNewConversation, loadJornada])

  // ===== Realtime: só após termos a jornada (id) =====
  useEffect(() => {
    if (!user?.id || !conversationId || !jornada?.id) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const ch = supabase
      .channel(`consultor:${conversationId}:${jornada.id}`)
      // Jornada atualizada
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jornadas_consultor', filter: `id=eq.${jornada.id}` },
        () => { loadJornada(false) }
      )
      // Áreas de trabalho alteradas
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas_trabalho', filter: `jornada_id=eq.${jornada.id}` },
        () => { loadJornada(false) }
      )
      // Novo entregável
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'entregaveis_consultor', filter: `jornada_id=eq.${jornada.id}` },
        async () => {
          await loadJornada(false)
          if (activeTab !== 'entregaveis') {
            try {
              const { count } = await supabase
                .from('entregaveis_consultor')
                .select('*', { count: 'exact', head: true })
                .eq('jornada_id', jornada.id)
              const prev = getStoredDocCount()
              const curr = count || 0
              if (curr > prev) {
                setNewDeliverablesCount((n) => n + (curr - prev))
                setStoredDocCount(curr)
              }
            } catch {
              setNewDeliverablesCount((n) => (n > 0 ? n + 1 : 1))
            }
          }
        }
      )
      .subscribe()

    channelRef.current = ch

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id, jornada?.id, activeTab, getStoredDocCount, setStoredDocCount, loadJornada])

  // ===== Guard: usuário =====
  if (!user?.id) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-700 flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">Faça login para acessar</p>
      </div>
    )
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      {/* Barra superior */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between bg-gray-800/50">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
            title="Sincronização em tempo real ativa"
          />
          <span className="text-xs text-gray-400">
            Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="text-[11px] text-gray-500">Auto</div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('jornada')}
          className={`
            flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'jornada'
              ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }
          `}
        >
          <Clipboard className="w-3.5 h-3.5" />
          Jornada
        </button>

        <button
          onClick={() => {
            setActiveTab('entregaveis')
            setNewDeliverablesCount(0)
            if (jornada?.id) {
              supabase
                .from('entregaveis_consultor')
                .select('*', { count: 'exact', head: true })
                .eq('jornada_id', jornada.id)
                .then(({ count }) => setStoredDocCount(count || 0))
                .catch(() => void 0)
            }
          }}
          className={`
            relative flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'entregaveis'
              ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }
          `}
        >
          <FileText className="w-3.5 h-3.5" />
          Docs
          {newDeliverablesCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-amber-500/90 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce"
              title={`${newDeliverablesCount} novo${newDeliverablesCount > 1 ? 's' : ''} documento${newDeliverablesCount > 1 ? 's' : ''}`}
            >
              {newDeliverablesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('kanban')}
          className={`
            flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'kanban'
              ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }
          `}
        >
          <Kanban className="w-3.5 h-3.5" />
          Kanban
        </button>
      </div>

      {/* Conteúdo da lateral */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2" />
              <p className="text-sm">Carregando...</p>
            </div>
          </div>
        ) : activeTab === 'jornada' ? (
          <JornadaTimeline jornada={jornada} />
        ) : activeTab === 'entregaveis' ? (
          <PainelEntregaveis jornadaId={jornada?.id} />
        ) : jornada?.id ? (
          <KanbanExecucao jornadaId={jornada.id} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 p-4 text-center">
            <p className="text-sm">Nenhuma jornada ativa</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default LateralConsultor


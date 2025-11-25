import React, { useEffect, useState, useRef, useCallback } from 'react'
import { CheckCircle2, Play, Lock, ChevronDown, ChevronRight, Award } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import type { JornadaConsultor, AreaTrabalho, GamificacaoConsultor } from '../../../types/consultor'

// ====== CONSTANTES COM FALLBACK (sem require / compatível ESM) ======
type EtapaJornada = { id: string; nome: string; cor?: string }

const DEFAULT_ETAPAS_JORNADA: EtapaJornada[] = [
  { id: 'apresentacao', nome: 'Apresentação', cor: 'bg-fuchsia-600/30 text-fuchsia-200' },
  { id: 'anamnese', nome: 'Anamnese', cor: 'bg-amber-600/30 text-amber-200' },
  { id: 'mapeamento', nome: 'Mapeamento Geral', cor: 'bg-indigo-600/30 text-indigo-200' },
  { id: 'priorizacao', nome: 'Priorização', cor: 'bg-emerald-600/30 text-emerald-200' },
  { id: 'execucao', nome: 'Execução', cor: 'bg-blue-600/30 text-blue-200' },
]

// Permite override via window.PROCEDA?.constants.* sem quebrar build
function pickConstantsFromWindow() {
  const anyWin = typeof window !== 'undefined' ? (window as any) : {}
  const c = anyWin?.PROCEDA?.constants || {}

  // ETAPAS_JORNADA pode ser array ou objeto
  let etapasJornada: EtapaJornada[] = DEFAULT_ETAPAS_JORNADA
  const ej = c?.ETAPAS_JORNADA
  if (Array.isArray(ej)) etapasJornada = ej
  else if (ej && typeof ej === 'object') etapasJornada = Object.values(ej)

  // ETAPAS_AREA pode ser enum/objeto
  const DEFAULT_ETAPAS_AREA = {
    AGUARDANDO: 'aguardando',
    AS_IS: 'as_is',
    DIAGNOSTICO: 'diagnostico',
    TO_BE: 'to_be',
    CONCLUIDA: 'concluida',
  }
  const ea = c?.ETAPAS_AREA
  const etapasArea =
    ea && typeof ea === 'object' ? { ...DEFAULT_ETAPAS_AREA, ...ea } : DEFAULT_ETAPAS_AREA

  // XP por nível (padrão 100)
  const xpn = Number.isFinite(c?.XP_POR_NIVEL) && c?.XP_POR_NIVEL > 0 ? c?.XP_POR_NIVEL : 100

  return { etapasJornada, etapasArea, xpPorNivel: xpn }
}

const { etapasJornada: ETAPAS_JORNADA, etapasArea: ETAPAS_AREA, xpPorNivel: XP_POR_NIVEL } =
  pickConstantsFromWindow()

// ====== Props
interface JornadaTimelineProps {
  jornada: JornadaConsultor | null
  onRefresh?: () => void // compat
}

// ====== Componente
export function JornadaTimeline({ jornada }: JornadaTimelineProps) {
  const { user } = useAuth()
  const jornadaId = jornada?.id

  // Áreas e UI
  const [areas, setAreas] = useState<AreaTrabalho[]>([])
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())

  // Gamificação
  const [gamificacao, setGamificacao] = useState<GamificacaoConsultor | null>(null)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ nivelAntigo: number; nivelNovo: number; xpTotal: number } | null>(null)
  const [showConquista, setShowConquista] = useState(false)
  const [conquistaData, setConquistaData] = useState<any>(null)

  const previousLevel = useRef<number>(0)
  const previousConquistas = useRef<string[]>([])
  const gamificationChannelRef = useRef<RealtimeChannel | null>(null)
  const checklistChannelRef = useRef<RealtimeChannel | null>(null)
  const areasChannelRef = useRef<RealtimeChannel | null>(null)

  // ===== Persistência local para não repetir modais
  const STORAGE_KEY = 'gamification_displayed'
  function getDisplayed() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"levelUps":{}, "conquistas":[]}')
    } catch {
      return { levelUps: {}, conquistas: [] as string[] }
    }
  }
  function markLevelUpDisplayed(jId: string, lvl: number) {
    const d = getDisplayed()
    d.levelUps[jId] = lvl
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  }
  function markConquistaDisplayed(id: string) {
    const d = getDisplayed()
    if (!d.conquistas.includes(id)) d.conquistas.push(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  }

  // ===== Loaders
  const loadAreas = useCallback(async () => {
    if (!jornadaId) return
    const { data, error } = await supabase
      .from('areas_trabalho')
      .select('*')
      .eq('jornada_id', jornadaId)
      .order('posicao_prioridade', { ascending: true })
    if (!error && data) setAreas(data as AreaTrabalho[])
  }, [jornadaId])

  const loadGamificacao = useCallback(async () => {
    if (!jornadaId) return
    const { data, error } = await supabase
      .from('gamificacao_consultor')
      .select('*')
      .eq('jornada_id', jornadaId)
      .maybeSingle()
    if (error) {
      console.error('[JornadaTimeline] Erro gamificação:', error)
      return
    }
    const g = (data as GamificacaoConsultor) || null
    if (!g) {
      setGamificacao(null)
      return
    }

    // Level Up
    if (previousLevel.current && (g.nivel ?? 0) > previousLevel.current) {
      setLevelUpData({
        nivelAntigo: previousLevel.current,
        nivelNovo: g.nivel ?? previousLevel.current,
        xpTotal: g.xp_total ?? 0,
      })
      setShowLevelUp(true)
      markLevelUpDisplayed(jornadaId, g.nivel ?? previousLevel.current)
    }
    previousLevel.current = g.nivel ?? previousLevel.current

    // Conquistas novas
    const conquistasIds = (g.conquistas || []).map((x: any) => String(x?.id))
    const conquistasNovas = conquistasIds.filter((id) => !previousConquistas.current.includes(id))
    if (conquistasNovas.length > 0) {
      const idx = conquistasIds.findIndex((id) => id === conquistasNovas[0])
      const c = (g.conquistas || [])[idx]
      setConquistaData(c)
      setShowConquista(true)
      if (c?.id) markConquistaDisplayed(String(c.id))
    }
    previousConquistas.current = conquistasIds

    setGamificacao(g)
  }, [jornadaId])

  // ===== Realtime (somente o necessário)
  const setupGamificacaoRealtime = useCallback(() => {
    if (!jornadaId) return
    if (gamificationChannelRef.current) {
      supabase.removeChannel(gamificationChannelRef.current)
      gamificationChannelRef.current = null
    }
    const ch = supabase
      .channel(`gamificacao:${jornadaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gamificacao_consultor', filter: `jornada_id=eq.${jornadaId}` },
        () => void loadGamificacao()
      )
      .subscribe()
    gamificationChannelRef.current = ch
  }, [jornadaId, loadGamificacao])

  const setupChecklistRealtime = useCallback(() => {
    if (!jornadaId) return
    if (checklistChannelRef.current) {
      supabase.removeChannel(checklistChannelRef.current)
      checklistChannelRef.current = null
    }
    const ch = supabase
      .channel(`checklist:${jornadaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'framework_checklist', filter: `jornada_id=eq.${jornadaId}` },
        () => {
          // checklist altera etapas no backend → refletimos na UI via reload da jornada pelo pai (opcional)
          // Aqui apenas recarregamos áreas (progresso por área costuma mudar com checklist)
          void loadAreas()
        }
      )
      .subscribe()
    checklistChannelRef.current = ch
  }, [jornadaId, loadAreas])

  const setupAreasRealtime = useCallback(() => {
    if (!jornadaId) return
    if (areasChannelRef.current) {
      supabase.removeChannel(areasChannelRef.current)
      areasChannelRef.current = null
    }
    const ch = supabase
      .channel(`areas:${jornadaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas_trabalho', filter: `jornada_id=eq.${jornadaId}` },
        () => void loadAreas()
      )
      .subscribe()
    areasChannelRef.current = ch
  }, [jornadaId, loadAreas])

  // ===== Boot/Cleanup
  useEffect(() => {
    if (!user?.id || !jornadaId) return
    void loadAreas()
    void loadGamificacao()
    setupGamificacaoRealtime()
    setupChecklistRealtime()
    setupAreasRealtime()
    return () => {
      if (gamificationChannelRef.current) supabase.removeChannel(gamificationChannelRef.current)
      if (checklistChannelRef.current) supabase.removeChannel(checklistChannelRef.current)
      if (areasChannelRef.current) supabase.removeChannel(areasChannelRef.current)
      gamificationChannelRef.current = null
      checklistChannelRef.current = null
      areasChannelRef.current = null
    }
  }, [user?.id, jornadaId, loadAreas, loadGamificacao, setupGamificacaoRealtime, setupChecklistRealtime, setupAreasRealtime])

  // ===== Debug: Log quando etapa_atual muda
  useEffect(() => {
    if (jornada?.etapa_atual) {
      console.log('[JornadaTimeline] Etapa atual changed to:', jornada.etapa_atual)
    }
  }, [jornada?.etapa_atual])

  // ===== Render (sem feed de linha do tempo; apenas Jornada + Gamificação)
  return (
    <div className="p-4 space-y-4">
      {/* Cabeçalho da Jornada + gamificação */}
      <div className="text-center mt-1 mb-4">
        <h3 className="text-lg font-semibold text-gray-100 mb-1">Jornada de Transformação</h3>
        {jornada?.empresa_nome && <p className="text-sm text-gray-400">{jornada.empresa_nome}</p>}

        {/* Barra de XP / Nível */}
        <div className="mt-3 w-full max-w-sm mx-auto">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Nível {gamificacao?.nivel ?? 1}</span>
            </div>
            <span>
              {(gamificacao?.xp_total ?? 0) % XP_POR_NIVEL}/{XP_POR_NIVEL} XP
            </span>
          </div>
          <div className="h-2 rounded bg-gray-800 overflow-hidden border border-gray-700">
            <div
              className="h-2 rounded"
              style={{
                width: `${Math.round(
                  ((((gamificacao?.xp_total ?? 0) % XP_POR_NIVEL) / XP_POR_NIVEL) || 0) * 100
                )}%`,
                background: 'linear-gradient(90deg, #4ade80, #22d3ee)',
                transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Etapas da Jornada + Áreas */}
      <div className="grid grid-cols-1 gap-4">
        {(ETAPAS_JORNADA || []).map((etapa, idx) => {
          const etapaAtualId = jornada?.etapa_atual
          const etapaIndex = (ETAPAS_JORNADA || []).findIndex((e) => e.id === etapaAtualId)
          const isCompleted = etapaIndex >= 0 && idx < etapaIndex
          const isCurrent = etapaIndex >= 0 && idx === etapaIndex

          const bubbleClass = isCompleted
            ? 'border-blue-500 bg-blue-500 text-white'
            : isCurrent
            ? `${etapa.cor || 'bg-blue-600/30 text-blue-200'} animate-pulse`
            : 'border-gray-700 bg-gray-800 text-gray-600'

          return (
            <div key={etapa.id || idx} className="relative">
              {idx < (ETAPAS_JORNADA?.length || 0) - 1 && (
                <div className={`absolute left-4 top-10 w-0.5 h-12 ${isCompleted ? 'bg-blue-500' : 'bg-gray-700'}`} />
              )}

              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${bubbleClass}`}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isCurrent ? <Play className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-medium ${isCurrent ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>
                      {etapa.nome || etapa.id}
                    </h4>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-400 rounded-full border border-blue-500/30">
                        Em Andamento
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full border border-emerald-500/30">
                        Concluída
                      </span>
                    )}
                  </div>

                  {(etapa.id === 'mapeamento' || etapa.id === 'execucao') && (
                    <div className="mt-3 space-y-2">
                      {areas.length === 0 && <div className="text-xs text-gray-500">Nenhuma área cadastrada ainda.</div>}

                      {areas.map((area) => {
                        const isExpanded = expandedAreas.has(area.id)
                        const subEtapas = [
                          { key: ETAPAS_AREA.AGUARDANDO, label: 'Aguardando' },
                          { key: ETAPAS_AREA.AS_IS, label: 'AS-IS' },
                          { key: ETAPAS_AREA.DIAGNOSTICO, label: 'Diagnóstico' },
                          { key: ETAPAS_AREA.TO_BE, label: 'TO-BE' },
                          { key: ETAPAS_AREA.CONCLUIDA, label: 'Concluída' },
                        ]

                        return (
                          <div key={area.id} className="rounded border border-gray-700 bg-gray-900/40">
                            <button
                              className="w-full px-3 py-2 flex items-center justify-between"
                              onClick={() =>
                                setExpandedAreas((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(area.id)) next.delete(area.id)
                                  else next.add(area.id)
                                  return next
                                })
                              }
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-xs font-medium text-gray-300">
                                  {area.posicao_prioridade}. {area.nome_area}
                                </span>
                              </div>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  area.etapa_area === ETAPAS_AREA.CONCLUIDA
                                    ? 'bg-green-600/30 text-green-400'
                                    : area.etapa_area === ETAPAS_AREA.AGUARDANDO
                                    ? 'bg-gray-600/30 text-gray-400'
                                    : 'bg-blue-600/30 text-blue-400'
                                }`}
                              >
                                {area.etapa_area === ETAPAS_AREA.AGUARDANDO
                                  ? 'Aguardando'
                                  : area.etapa_area === ETAPAS_AREA.CONCLUIDA
                                  ? 'Concluída'
                                  : 'Em Andamento'}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 pl-6 space-y-1">
                                {subEtapas.map((sub, i) => {
                                  const currentIndex = subEtapas.findIndex((s) => s.key === area.etapa_area)
                                  const thisIndex = i
                                  const isSubCompleted = currentIndex >= 0 && thisIndex < currentIndex
                                  const isSubCurrent = currentIndex >= 0 && thisIndex === currentIndex

                                  return (
                                    <div key={String(sub.key)} className="flex items-center gap-2">
                                      <div
                                        className={`w-3 h-3 rounded-full ${
                                          isSubCompleted
                                            ? 'bg-emerald-500'
                                            : isSubCurrent
                                            ? 'bg-blue-500 animate-pulse'
                                            : 'bg-gray-600'
                                        }`}
                                      />
                                      <span className={`text-[11px] ${isSubCurrent ? 'text-gray-100' : 'text-gray-400'}`}>
                                        {sub.label}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            <div className="mt-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-700 rounded-full h-1 overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full transition-all duration-500"
                                    style={{ width: `${Math.max(0, Math.min(100, area.progresso_area || 0))}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400">
                                  {Math.max(0, Math.min(100, area.progresso_area || 0))}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modais de Gamificação */}
      {levelUpData && (
        <LevelUpModal
          isOpen={showLevelUp}
          onClose={() => setShowLevelUp(false)}
          nivelAntigo={levelUpData.nivelAntigo}
          nivelNovo={levelUpData.nivelNovo}
          xpTotal={levelUpData.xpTotal}
        />
      )}
      {conquistaData && (
        <ConquistaModal isOpen={showConquista} onClose={() => setShowConquista(false)} conquista={conquistaData} />
      )}
    </div>
  )
}

import { LevelUpModal } from '../Gamificacao/LevelUpModal'
import { ConquistaModal } from '../Gamificacao/ConquistaModal'

export default JornadaTimeline

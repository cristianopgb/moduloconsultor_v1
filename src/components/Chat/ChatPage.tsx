// web/src/components/Chat/ChatPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Send, Plus, X, MessageSquare, FileText, Eye, Sparkles,
  Bot, User, Loader2, AlertCircle, Trash2, Pencil, Check, XCircle,
  ChevronDown, Link as LinkIcon, BarChart3, Wand2
} from 'lucide-react'

import { supabase, Conversation, Message, Model, ChatMode } from '../../lib/supabase'
import { callEdgeFunction } from '../../lib/functionsClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { detectAndParseCSV, getDelimiterName } from '../../utils/csvDetector'
import ThinkingAnimation from './ThinkingAnimation'
import DocumentGeneratingAnimation from './DocumentGeneratingAnimation'
import { uploadHtmlAndOpenPreview } from '../../lib/storagePreview'
import { DiscreteMenu } from './DiscreteMenu'
import MessageContent from './MessageContent'
import TemplateSelectorPanel from './TemplateSelectorPanel'
import { ChatModeToggle } from './ChatModeToggle'
import { AnalysisStateIndicator, type AnalysisState } from './AnalysisStateIndicator'
import { ContextQuestionsPanel } from './ContextQuestionsPanel'
import { AnalysisSuggestionsCard, generateSuggestions } from './AnalysisSuggestionsCard'
import { LateralConsultor } from '../Consultor/LateralConsultor'
import { GeniusChat } from './GeniusChat'

import AttachmentTrigger from '../References/AttachmentTrigger'
import type { CreatedRef } from '../References/ReferenceUploader'
import { FormularioModal } from './FormularioModal'
import { detectFormMarker, removeFormMarkers } from '../../utils/form-markers'
import { XPCelebrationPopup } from '../Consultor/Gamificacao/XPCelebrationPopup'
import { ValidateScopeButton } from './ValidateScopeButton'
import { callConsultorRAG, getOrCreateSessao } from '../../lib/consultor/rag-adapter'
// NOTE: Refactored - executeRAGActions and updateSessaoContext removed
// Actions are no longer used in the simplified architecture

async function loadXLSX() {
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm')
  return mod as any
}
async function loadPDFJS() {
  const pdfjsLib: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/+esm')
  try { if (pdfjsLib?.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = undefined } catch {}
  return pdfjsLib
}
async function loadMammoth() {
  const mammoth: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js/+esm')
  return mammoth?.default || mammoth
}
async function loadJSZip() {
  const JSZip: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')
  return JSZip?.default || JSZip
}
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as ArrayBuffer)
    fr.onerror = reject
    fr.readAsArrayBuffer(file)
  })
}
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    const enc = 'utf-8'
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = reject
    fr.readAsText(file, enc)
  })
}
function getExt(name?: string) {
  const n = (name || '').toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/i)
  return m ? m[1] : ''
}
async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjs = await loadPDFJS()
  const buf = await readAsArrayBuffer(file)
  const loadingTask = pdfjs.getDocument({ data: buf })
  const pdf = await loadingTask.promise
  let text = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const strings = content.items.map((it: any) => it.str).filter(Boolean)
    text += strings.join(' ') + '\n\n'
  }
  return text.trim()
}
async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await loadMammoth()
  const buf = await readAsArrayBuffer(file)
  if (mammoth.extractRawText) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
    return String(value || '').trim()
  }
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.textContent || '').trim()
}
async function extractTextFromPptx(file: File): Promise<string> {
  const JSZip = await loadJSZip()
  const buf = await readAsArrayBuffer(file)
  const zip = await JSZip.loadAsync(buf)
  const slideFiles = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10)
    const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10)
    return na - nb
  })
  let all = ''
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string')
    const plain = xml
      .replace(/<a:t[^>]*>/g, '')
      .replace(/<\/a:t>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (plain) all += plain + '\n\n'
  }
  return all.trim()
}
async function extractTextFromXlsx(file: File): Promise<string> {
  const XLSX = await loadXLSX()
  const buf = await readAsArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const sheets = wb.SheetNames || []
  let out = ''
  sheets.slice(0, 5).forEach((name: string) => {
    const ws = wb.Sheets[name]
    if (!ws) return
    const csv = XLSX.utils.sheet_to_csv(ws)
    out += `# ${name}\n${csv}\n`
  })
  return out.trim()
}

async function extractTextFromCsv(file: File): Promise<string> {
  try {
    const { text, delimiter, confidence, encoding } = await detectAndParseCSV(file)
    console.log(`[ChatPage CSV] Delimiter: ${getDelimiterName(delimiter)}, Confidence: ${confidence}%, Encoding: ${encoding}`)

    if (confidence < 50) {
      console.warn('[ChatPage CSV] Low confidence, using XLSX fallback')
      const XLSX = await loadXLSX()
      const buf = await readAsArrayBuffer(file)
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      return XLSX.utils.sheet_to_csv(ws)
    }

    return text
  } catch (error) {
    console.error('[ChatPage CSV] Error:', error)
    const XLSX = await loadXLSX()
    const buf = await readAsArrayBuffer(file)
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_csv(ws)
  }
}
async function extractTextFromHtml(file: File): Promise<string> {
  const txt = await readAsText(file)
  const div = document.createElement('div')
  div.innerHTML = txt
  return (div.textContent || '').trim()
}
async function extractTextFromGenericText(file: File): Promise<string> {
  const txt = await readAsText(file)
  return txt.trim()
}

function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
const emojiMap: Array<[RegExp, string]> = [
  [/^#{1,6}\s*resumo/i, '📝 '],
  [/^#{1,6}\s*objetivos?/i, '🎯 '],
  [/^#{1,6}\s*metas?/i, '🏆 '],
  [/^#{1,6}\s*prazo/i, '⏳ '],
  [/^#{1,6}\s*finance/i, '💰 '],
  [/^#{1,6}\s*cta/i, '👉 '],
  [/^#{1,6}\s*conclus/i, '✅ '],
]
function mdLikeToHtml(input: string) {
  const raw = (input || '').trim()
  const safe = escapeHtml(raw)
  let html = safe.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/^(#{1,6})\s*(.+)$/gm, (_m, h, t) => {
    let label = t
    const line = `${'#'.repeat(String(h).length)} ${t}`
    for (const [rx, emo] of emojiMap) { if (rx.test(line)) { label = emo + t; break } }
    return `<div class="mt-3 mb-2 text-[0.95rem] font-semibold">${label}</div>`
  })
  html = html.replace(/^(?:-|\*)\s+(.+)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="space-y-1 list-disc">$1</ul>')
  html = html.replace(/^(?!<div|<ul|<li)(.+)$/gm, '<p class="mb-1">$1</p>')
  return html
}

function cleanGeneratedHtml(input: string) {
  if (!input) return ''
  let t = input.trim()
  if (/^```/i.test(t)) t = t.replace(/^```(?:html|htm)?\s*/i, '').replace(/```+$/i, '').trim()
  t = t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  return t
}

type MessageWithAnalysis = Message & {
  analysisData?: any
  analysis_id?: string
}

function ChatPage() {
  const { user } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [current, setCurrent] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<MessageWithAnalysis[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)
  const [templates, setTemplates] = useState<Model[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [selectedTemplate, setSelectedTemplate] = useState<Model | null>(null)

  const [generatedHtml, setGeneratedHtml] = useState('')
  const [generating, setGenerating] = useState(false)
  const generatingLock = useRef(false)
  const [genLog, setGenLog] = useState<string[]>([])
  const rawHtmlRef = useRef<string>('')
  const hasAutoStarted = useRef(false)
  const lastSentMessage = useRef({ content: '', timestamp: 0 })

  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const [readyReason, setReadyReason] = useState('')

  const [attachedRefs, setAttachedRefs] = useState<CreatedRef[]>([])
  const [justAttachedBlink, setJustAttachedBlink] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // hadAnalysis state removed (was unused)

  const [chatMode, setChatMode] = useState<ChatMode>('analytics')

  // Dialogue Flow States (NEW SYSTEM)
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [showDialoguePanel, setShowDialoguePanel] = useState(false)
  const [dialogueStateId, setDialogueStateId] = useState<string | null>(null)
  const [lastAnalysisData, setLastAnalysisData] = useState<any>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [pendingConsultorActions, setPendingConsultorActions] = useState<any[] | null>(null)

  // Formulário dinâmico — ADICIONADO 'atributos_processo' no union
  const [showFormModal, setShowFormModal] = useState(false)
  const [formType, setFormType] = useState<
    'anamnese' | 'canvas' | 'cadeia_valor' | 'matriz_priorizacao' | 'processo_as_is' | 'atributos_processo' | null
  >(null)
  const [formData, setFormData] = useState<any>(null)
  const [formInitialProcesso, setFormInitialProcesso] = useState<any | null>(null)
  // modalJornadaId removed (we only keep modalProcessos)
  const [modalProcessos, setModalProcessos] = useState<any[] | null>(null)
  const [modalJornadaId, setModalJornadaId] = useState<string | null>(null)

  // Gamificação - Popup de XP
  const [showXPCelebration, setShowXPCelebration] = useState(false)
  const [xpCelebrationData, setXPCelebrationData] = useState<{ xpGanho: number; xpTotal: number; nivel: number; motivo: string } | null>(null)
  const lastKnownXpRef = useRef<number | null>(null)

  // Validação de Escopo - Botão de validação quando aguardando_validacao_escopo = true
  const [showValidateScopeButton, setShowValidateScopeButton] = useState(false)

  // Genius mode - arquivos para envio
  const [geniusFiles, setGeniusFiles] = useState<File[]>([])

  // Note: gamificacao_conversa table removed - gamification now at jornada level only
  // Keeping stub for backward compatibility during transition
  async function pollGamification() {
    // No longer polls gamificacao_conversa (table removed)
    // Gamification is now handled per jornada via gamificacao_consultor table
    return false
  }

  const { ref: listRef, notifyNew, scrollToBottom, pending } = useAutoScroll<HTMLDivElement>()
  const formatTime = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (s: string) => {
    const d = new Date(s), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1)
    if (d.toDateString() === t.toDateString()) return 'Hoje'
    if (d.toDateString() === y.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR')
  }
  const title = useMemo(() => current?.title || 'Nova Conversa', [current?.title])
  function log(line: string) { console.log(line); setGenLog(prev => [...prev, line]) }

  useEffect(() => {
    if (!user?.id) return

    let retryCount = 0
    const maxRetries = 3

    const loadConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })

        if (error) {
          if (error.code === 'PGRST205' && retryCount < maxRetries) {
            retryCount++
            console.warn(`⚠️ Schema cache desatualizado, tentativa ${retryCount}/${maxRetries}...`)
            setTimeout(loadConversations, 2000 * retryCount)
            return
          }

          console.error('Erro ao carregar conversas:', error)
          setConversations([])
        } else {
          setConversations(data || [])
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar conversas:', err)
        setConversations([])
      }
    }

    loadConversations()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    let retryCount = 0
    const maxRetries = 3

    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('models')
          .select('*')
          .or('template_type.is.null,template_type.eq.presentation')
          .order('name', { ascending: true })

        if (error) {
          if (error.code === 'PGRST205' && retryCount < maxRetries) {
            retryCount++
            console.warn(`⚠️ Schema cache desatualizado, tentativa ${retryCount}/${maxRetries}...`)
            setTimeout(loadTemplates, 2000 * retryCount)
            return
          }

          console.warn('Falha ao carregar templates:', error.message)
          setTemplates([])
        } else {
          setTemplates(data || [])
          if (data && data.length > 0) {
            console.log(`✅ ${data.length} templates carregados`)
          }
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar templates:', err)
        setTemplates([])
      }
    }

    loadTemplates()
  }, [user?.id])

  function resetForConversation() {
    setMessages([]); setInput(''); setErr('')
  setGeneratedHtml(''); setGenerating(false); setGenLog([]); generatingLock.current = false
  setReadyReason(''); rawHtmlRef.current = ''
  setAttachedRefs([]); setSelectedTemplate(null)
    setChatMode('analytics')
    // Reset dialogue states
    setAnalysisState('idle')
    setShowDialoguePanel(false)
    setDialogueStateId(null)
    setLastAnalysisData(null)
    setShowSuggestions(false)
  }

  // Listener de gamificação para mostrar popup de XP
  useEffect(() => {
    if (!current?.id || chatMode !== 'consultor') return

    // gamificacao_conversa table removed - no realtime subscription needed
    // Gamification now handled at jornada level via gamificacao_consultor
    console.log('[GAMIFICATION] realtime subscription disabled (gamificacao_conversa removed)')

    return () => {
      // No cleanup needed
    }
  }, [current?.id, chatMode])

  // Listener para detectar quando mostrar botão de validação de escopo
  useEffect(() => {
    if (!current?.id || chatMode !== 'consultor') {
      setShowValidateScopeButton(false)
      return
    }

    // Verificar estado inicial - CHECK BOTH SOURCES
    const checkValidationStatus = async () => {
      try {
        // Check framework_checklist
        const { data: checklistData, error: checklistError } = await supabase
          .from('framework_checklist')
          .select('aguardando_validacao_escopo, escopo_validado_pelo_usuario')
          .eq('conversation_id', current.id)
          .maybeSingle()

        // Check jornadas_consultor
        const { data: jornadaData, error: jornadaError } = await supabase
          .from('jornadas_consultor')
          .select('aguardando_validacao')
          .eq('conversation_id', current.id)
          .maybeSingle()

        // Show button if EITHER source indicates awaiting validation
        const checklistNeedsValidation = !checklistError && checklistData?.aguardando_validacao_escopo === true && checklistData?.escopo_validado_pelo_usuario === false
        const jornadaNeedsValidation = !jornadaError && jornadaData?.aguardando_validacao === 'priorizacao'

        const shouldShow = checklistNeedsValidation || jornadaNeedsValidation
        setShowValidateScopeButton(shouldShow)
        console.log('[VALIDATE-SCOPE] Initial check:', {
          checklistAguardando: checklistData?.aguardando_validacao_escopo,
          checklistValidado: checklistData?.escopo_validado_pelo_usuario,
          jornadaAguardando: jornadaData?.aguardando_validacao,
          shouldShow
        })
      } catch (err) {
        console.warn('[VALIDATE-SCOPE] Error checking initial status:', err)
      }
    }

    checkValidationStatus()

    // Listener Realtime para mudanças em AMBAS as tabelas (framework_checklist E jornadas_consultor)
    const channel = supabase
      .channel(`framework-validation-${current.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'framework_checklist',
          filter: `conversation_id=eq.${current.id}`
        },
        () => {
          // Re-check validation status when framework_checklist changes
          checkValidationStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jornadas_consultor',
          filter: `conversation_id=eq.${current.id}`
        },
        () => {
          // Re-check validation status when jornadas_consultor changes
          checkValidationStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [current?.id, chatMode])

  useEffect(() => {
    if (!current?.id) { resetForConversation(); return }
    resetForConversation()
    ;(async () => {
      // gamificacao_conversa removed - gamification now at jornada level
      lastKnownXpRef.current = 0
      setLoadingAnalyses(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*, analysis_id, message_type, template_used_id')
        .eq('conversation_id', current.id)
        .order('created_at', { ascending: true })
      if (error) { setErr('Falha ao carregar mensagens.'); setLoadingAnalyses(false); return }

  const messagesWithAnalysis: MessageWithAnalysis[] = []
      for (const msg of (data || [])) {
        if (msg.analysis_id) {
          try {
            const { data: rows, error: rpcErr } = await supabase.rpc('get_analysis_safe', { aid: msg.analysis_id })
            if (rpcErr) throw rpcErr
            const row = Array.isArray(rows) ? rows[0] : rows
            if (row) {
              messagesWithAnalysis.push({
                ...msg,
                analysisData: row.interpretation || row.charts_config,
                analysis_id: msg.analysis_id
              })
              // analysis loaded
            } else {
              messagesWithAnalysis.push({ ...msg, analysis_id: msg.analysis_id })
            }
          } catch (e) {
            console.warn('[ChatPage] Failed to load analysis via RPC:', e)
            messagesWithAnalysis.push(msg)
          }
        } else {
          messagesWithAnalysis.push(msg)
        }
      }

    setMessages(messagesWithAnalysis)
      setLoadingAnalyses(false)
      setTimeout(() => notifyNew(), 80)

      // Check for active dialogue state
      const { data: dialogueData } = await supabase
        .from('dialogue_states')
        .select('id, state')
        .eq('conversation_id', current.id)
        .in('state', ['conversing', 'ready_to_analyze'])
        .maybeSingle();

      if (dialogueData) {
        console.log('[ChatPage] Dialogue ativo encontrado:', dialogueData);
        setShowDialoguePanel(true);
        setDialogueStateId(dialogueData.id);
        setAnalysisState('collecting_context');
      }

      const lastAssistant = [...messagesWithAnalysis].reverse().find(m => m.role !== 'user')
      if (lastAssistant?.content) {
        const endsLikeDraft = !/[\?\!]\s*$/.test(lastAssistant.content.trim())
        if (endsLikeDraft) setReadyReason('histórico: draft')
      }
    })()
  }, [current?.id])

  async function createConversation() {
    if (!user?.id) return
    resetForConversation()
    const { data, error } = await supabase.from('conversations').insert([{ user_id: user.id, title: 'Nova Conversa', chat_mode: 'analytics' }]).select().single()
    if (error) { setErr(error.message); return }

    // gamificacao_conversa table removed - gamification now at jornada level only
    // No need to create conversation-level gamification records anymore

    setCurrent(data)
    setChatMode(data.chat_mode || 'analytics')
    const list = await supabase.from('conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setConversations(list.data || [])
  }

  const saveEditTitle = async (c: Conversation) => {
    const { error } = await supabase.from('conversations').update({ title: editingTitle }).eq('id', c.id)
    if (!error) {
      setConversations(prev => prev.map(x => x.id === c.id ? { ...x, title: editingTitle } : x))
      if (current?.id === c.id) setCurrent({ ...c, title: editingTitle })
    }
    setEditingConvId(null); setEditingTitle('')
  }
  async function deleteConversation(id: string) {
    if (!confirm('Excluir esta conversa?')) return
    await supabase.from('conversations').delete().eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (current?.id === id) setCurrent(null)
  }

  async function handleUploadFiles(files: File[]) {
    if (!user?.id || !current?.id) return
    const MAX_SIZE = 20 * 1024 * 1024
    const oversizedFiles = Array.from(files).filter(f => f.size > MAX_SIZE)
    if (oversizedFiles.length > 0) {
      setErr(`Arquivo(s) muito grande(s): ${oversizedFiles.map(f => f.name).join(', ')}. Limite: 20MB`)
      return
    }

    setIsUploading(true)
    const bucket = 'references'
    const news: CreatedRef[] = []

    for (const file of files) {
      try {
        console.log('[DEBUG ChatPage] Iniciando upload do arquivo:', file.name)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Token de acesso não encontrado. Faça login novamente.')

        // envia via Edge (Service Role)
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
        })
        reader.readAsDataURL(file)
        const content_base64 = await base64Promise

        const { data: uploadResult, error: uploadErr } = await callEdgeFunction('upload-reference', { filename: file.name, content_base64, bucket })
        if (uploadErr) {
          throw uploadErr
        }
        const path = uploadResult?.path

        // extração local (rápido, só para contexto)
        let text = ''
        const ext = getExt(file.name)
        try {
          if (ext === 'pdf') text = await extractTextFromPDF(file)
          else if (ext === 'docx') text = await extractTextFromDocx(file)
          else if (ext === 'pptx') text = await extractTextFromPptx(file)
          else if (ext === 'xlsx' || ext === 'xls') text = await extractTextFromXlsx(file)
          else if (ext === 'csv') text = await extractTextFromCsv(file)
          else if (ext === 'html' || ext === 'htm') text = await extractTextFromHtml(file)
          else text = await extractTextFromGenericText(file)
        } catch { text = '' }

        const insertData = {
          user_id: user.id,
          conversation_id: current.id,
          title: file.name,
          type: getExt(file.name) || (file.type || 'file'),
          storage_bucket: bucket,
          storage_path: path,
          source_url: null,
          extracted_text: text,
          metadata: { size: file.size, mime: file.type, ext }
        }

        const { data, error } = await supabase
          .from('references')
          .insert([insertData])
          .select('id')
          .single()
        if (error) throw error

        news.push({
          id: data.id,
          title: file.name,
          type: (getExt(file.name) as any),
          storage_bucket: bucket,
          storage_path: path
        })
      } catch (e: any) {
        console.error('[Attachment] falha ao anexar arquivo:', e?.message)
        setErr('Falha ao anexar arquivo: ' + (e?.message || 'erro'))
      }
    }

    setIsUploading(false)
    if (news.length) {
      setAttachedRefs(prev => [...prev, ...news])
      setJustAttachedBlink(true); setTimeout(() => setJustAttachedBlink(false), 2000)
    }
  }

  async function handleAddUrl(url: string) {
    if (!user?.id || !current?.id) return
    try {
      const { data, error } = await supabase
        .from('references')
        .insert([{
          user_id: user.id,
          conversation_id: current.id,
          title: url,
          type: 'url',
          source_url: url,
          extracted_text: ''
        }])
        .select('id')
        .single()
      if (error) throw error

      const newRef: CreatedRef = { id: data.id, title: url, type: 'url' as any }
      setAttachedRefs(prev => [...prev, newRef])
      setJustAttachedBlink(true); setTimeout(() => setJustAttachedBlink(false), 2000)

      try {
        await supabase.functions.invoke('extract-reference-text', { body: { reference_id: data.id } })
      } catch (e) {
        console.warn('[Attachment] extract-reference-text falhou:', (e as any)?.message)
      }
    } catch (e: any) {
      console.error('[Attachment] falha ao anexar URL:', e?.message)
      setErr('Falha ao anexar URL: ' + (e?.message || 'erro'))
    }
  }


  // Handler: Responder perguntas do diálogo (NEW SYSTEM)
  async function handleDialogueAnswer(answer: string) {
    if (!answer.trim() || !current?.id) return;

    console.log('[ChatPage] Enviando resposta do diálogo:', answer);
    setLoading(true);

    try {
      // Get dialogue state to retrieve context
      const { data: dialogueState } = await supabase
        .from('dialogue_states')
        .select('*')
        .eq('conversation_id', current.id)
        .single();

      if (!dialogueState) {
        console.error('[ChatPage] Dialogue state não encontrado');
        return;
      }

      // Find last attached file for reanalysis
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      const lastRef = attachedRefs[attachedRefs.length - 1];

      if (!lastRef) {
        console.error('[ChatPage] Nenhum arquivo anexado para reanálise');
        setErr('Erro: arquivo não encontrado para continuar análise');
        setLoading(false);
        return;
      }

      // Get file data from reference
      const { data: refData } = await supabase
        .from('references')
        .select('storage_path, metadata')
        .eq('id', lastRef.id)
        .single();

      if (!refData?.storage_path) {
        console.error('[ChatPage] storage_path não encontrado');
        setLoading(false);
        return;
      }

      // Download file from storage
      const { data: fileBlob } = await supabase.storage
        .from('references')
        .download(refData.storage_path);

      if (!fileBlob) {
        console.error('[ChatPage] Falha ao baixar arquivo');
        setLoading(false);
        return;
      }

      // Convert to base64
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Call analyze-file with user response and existing context
      const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('analyze-file', {
        body: {
          file_data: base64,
          filename: refData.metadata?.original_name || 'file',
          user_question: answer,
          conversation_id: current.id,
          message_id: lastUserMsg?.id,
          existing_context: dialogueState.context_data,
          force_analysis: false
        }
      });

      if (analysisError) throw analysisError;

      // Check if still needs more dialogue
      if (analysisResponse?.needs_dialogue) {
        console.log('[ChatPage] LLM precisa de mais informações');
        setLoading(false);
        return;
      }

      // Analysis completed!
      console.log('[ChatPage] Análise completada!');
      setShowDialoguePanel(false);
      setDialogueStateId(null);
      setAnalysisState('ready_to_answer');

      const { result, analysis_id } = analysisResponse;
      const summary = result?.summary || 'Análise concluída. Veja os detalhes abaixo.';

      const assistantMessage: MessageWithAnalysis = {
        id: `temp-assistant-${Date.now()}`,
        conversation_id: current.id,
        role: 'assistant',
        content: summary,
        created_at: new Date().toISOString(),
        message_type: 'analysis_result',
        analysis_id: analysis_id,
        analysisData: result,
      };

      setMessages(prev => [...prev, assistantMessage]);
      await supabase.from('messages').insert({
        conversation_id: current.id,
        role: 'assistant',
        content: summary,
        analysis_id: analysis_id,
        message_type: 'analysis_result',
      });

  // hadAnalysis flag removed - no-op
    } catch (error: any) {
      console.error('[ChatPage] Erro ao processar resposta:', error);
      setErr('Erro ao processar resposta: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Handler: Pular diálogo e analisar mesmo assim (NEW SYSTEM)
  async function handleSkipDialogue() {
    if (!current?.id) return;

    console.log('[ChatPage] Usuário pulou diálogo - forçando análise');
    setLoading(true);

    try {
      // Get last reference
      const lastRef = attachedRefs[attachedRefs.length - 1];
      if (!lastRef) {
        setErr('Erro: arquivo não encontrado');
        setLoading(false);
        return;
      }

      const { data: refData } = await supabase
        .from('references')
        .select('storage_path, metadata')
        .eq('id', lastRef.id)
        .single();

      if (!refData?.storage_path) {
        setLoading(false);
        return;
      }

      const { data: fileBlob } = await supabase.storage
        .from('references')
        .download(refData.storage_path);

      if (!fileBlob) {
        setLoading(false);
        return;
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Get dialogue state
      const { data: dialogueState } = await supabase
        .from('dialogue_states')
        .select('*')
        .eq('conversation_id', current.id)
        .single();

      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');

      // Call with force_analysis: true
      const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('analyze-file', {
        body: {
          file_data: base64,
          filename: refData.metadata?.original_name || 'file',
          user_question: lastUserMsg?.content || 'Analisar dados',
          conversation_id: current.id,
          message_id: lastUserMsg?.id,
          existing_context: dialogueState?.context_data,
          force_analysis: true // FORÇA ANÁLISE
        }
      });

      if (analysisError) throw analysisError;

      if (!analysisResponse?.success) {
        throw new Error(analysisResponse?.error || 'Falha na análise');
      }

      // Hide panel and show results
      setShowDialoguePanel(false);
      setDialogueStateId(null);
      setAnalysisState('ready_to_answer');

      const { result, analysis_id } = analysisResponse;
      const summary = result?.summary || 'Análise concluída com dados disponíveis.';

        const assistantMessage: MessageWithAnalysis = {
        id: `temp-assistant-${Date.now()}`,
        conversation_id: current.id,
        role: 'assistant',
        content: summary,
        created_at: new Date().toISOString(),
          message_type: 'analysis_result',
        analysis_id: analysis_id,
        analysisData: result,
      };

      setMessages(prev => [...prev, assistantMessage]);
      await supabase.from('messages').insert({
        conversation_id: current.id,
        role: 'assistant',
        content: summary,
        analysis_id: analysis_id,
        message_type: 'analysis_result',
      });

  // hadAnalysis flag removed - no-op
    } catch (error: any) {
      console.error('[ChatPage] Erro ao pular diálogo:', error);
      setErr('Erro ao analisar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // SUGGESTION HANDLERS
  // =========================
  function handleSuggestionClick(action: string) {
    console.log('[ChatPage] Suggestion clicked:', action);
    setShowSuggestions(false);

    switch (action) {
      case 'generate-presentation':
        if (selectedTemplate) {
          generateDocument();
        } else {
          setInput('Gere uma apresentação executiva com os principais insights desta análise');
        }
        break;
      case 'deep-dive':
        setInput('Faça uma análise mais detalhada dos dados, incluindo correlações e tendências');
        break;
      case 'find-anomalies':
        setInput('Identifique anomalias, outliers e valores atípicos nos dados analisados');
        break;
      case 'export-report':
        setInput('Gere um relatório completo e detalhado desta análise');
        break;
    }
  }

  // =========================
  // NOVA FUNÇÃO sendMessage — validação de arquivos feita no backend (analyze-data)
  // =========================
  async function sendMessage(customText?: string) {
    const text = (customText || input).trim();
    if (!text || !current || loading || generating) return;

    // Prevent duplicate sends within 2 seconds
    const now = Date.now();
    if (lastSentMessage.current.content === text &&
        (now - lastSentMessage.current.timestamp) < 2000) {
      console.log('[sendMessage] Duplicate send prevented:', text.substring(0, 30));
      return;
    }

    // Track this message
    lastSentMessage.current = { content: text, timestamp: now };

    // Hide suggestions when user sends a new message
    setShowSuggestions(false);

    setLoading(true);
    setErr('');
    if (!customText) setInput('');

    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      conversation_id: current.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      message_type: 'text'
    };
    setMessages(prev => [...prev, userMessage]);

    const isAnalyticsMode = chatMode === 'analytics';
    const isConsultorMode = chatMode === 'consultor';
    const hasDataFiles = attachedRefs.some(ref => /\.(xlsx|xls|csv)$/i.test(ref.title || ''));

    try {
      if (isConsultorMode) {
        console.log('[CONSULTOR MODE] Chamando consultor-rag (sistema inteligente)...');

        // Buscar ou criar sessão RAG para esta conversa
        const sessaoId = await getOrCreateSessao(user!.id, current.id, text);

        if (!sessaoId) {
          throw new Error('Falha ao criar sessão de consultoria RAG');
        }

        // Chamar sistema RAG inteligente
        const ragResponse = await callConsultorRAG({
          message: text,
          userId: user!.id,
          conversationId: current.id,
          sessaoId: sessaoId
        });

        console.log('[CONSULTOR MODE] RAG response:', {
          sessaoId: ragResponse.sessaoId,
          estado: ragResponse.estado,
          progresso: ragResponse.progresso,
          actionsCount: ragResponse.actions?.length || 0,
          methodologies: ragResponse.ragInfo?.methodologies
        });

        const reply = ragResponse.text || 'Não consegui processar sua mensagem.';
        const etapaAtual = ragResponse.estado;
        const jornadaId = null;

        // Use actions directly from enforcer (already validated)
        const actions = Array.isArray(ragResponse.actions) ? ragResponse.actions : [];

        // Anti-loop: only execute if we have real actions
        if (actions.length > 0 && sessaoId) {
          console.log('[RAG-EXECUTOR] Executing', actions.length, 'enforced actions...');
          try {
            const { data: sessaoData } = await supabase
              .from('consultor_sessoes')
              .select('contexto_negocio, estado_atual')
              .eq('id', sessaoId)
              .single();

            // REFACTORED: Actions removed - context is handled automatically by Edge Function
            // const contexto = {
            //   ...(sessaoData?.contexto_negocio || {}),
            //   ...(ragResponse.contexto_incremental || {}),
            //   estado_atual: sessaoData?.estado_atual || 'coleta'
            // };
            // await executeRAGActions(actions, sessaoId, user!.id, contexto);
            // console.log('[RAG-EXECUTOR] All actions executed successfully');

            window.dispatchEvent(new CustomEvent('entregavel:created', { detail: { sessaoId } }));
          } catch (execError) {
            console.error('[RAG-EXECUTOR] Failed to execute actions:', execError);
          }
        } else {
          console.warn('[CONSULTOR MODE] No actions to execute - waiting for user input (anti-loop)');
        }

        // If backend returned jornada_id, fetch its contexto_coleta to use for modal processes
        if (jornadaId) {
          try {
            const { data: jornadaRow } = await supabase.from('jornadas_consultor').select('contexto_coleta').eq('id', jornadaId).single();
            const ctx = jornadaRow?.contexto_coleta || {};
            const procs = ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || null;
            setModalProcessos(procs);
            setModalJornadaId(jornadaId);
          } catch (e) {
            console.warn('[ChatPage] falha ao buscar contexto da jornada para modal:', e);
            setModalProcessos(null);
          }
        } else {
            setModalProcessos(null);
        }

        // Fallback: tentar detectar ganho de XP com polling seguro
        try {
          if (!ragResponse?.gamification && current?.id) {
            // pollGamification atualiza lastKnownXpRef e dispara popup se detectar ganho
            void pollGamification(4, 600)
          }
        } catch (e) {
          console.warn('[GAMIFICATION] fallback poll erro:', e)
        }

        // Log para debug
        console.log('[CONSULTOR MODE] Resposta recebida:', {
          reply: reply,
          etapa: etapaAtual,
          jornada_id: jornadaId,
          hasFormMarker: reply.includes('[EXIBIR_FORMULARIO:'),
          actions: actions
        });

        // PRIORITY 1: Check for form actions from backend (most reliable)
        let formAction = actions.find((a: any) => a.type === 'exibir_formulario');

        // SAFEGUARD: não abrir modal para matriz_priorizacao (é ENTREGÁVEL, não form)
        if (formAction && formAction.params?.tipo === 'matriz_priorizacao') {
          console.log('[FORMULARIO] Ignorando abertura de form para matriz_priorizacao (gerar entregável).');
          formAction = undefined;
        }

        // We'll append the assistant message first, then open any form modal after a short delay

        // Remover marcadores da mensagem exibida (APÓS detecção)
        const cleanReply = removeFormMarkers(reply);

        const assistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          conversation_id: current.id,
          role: 'assistant',
          content: cleanReply,
          created_at: new Date().toISOString(),
          message_type: 'text'
        };

        setMessages(prev => [...prev, assistantMessage]);

        // CRÍTICO: Salvar ambas mensagens (user + assistant) no banco para o RAG adapter poder carregar histórico
        await supabase.from('messages').insert([
          {
            conversation_id: current.id,
            role: 'user',
            content: text,
            message_type: 'text'
          },
          {
            conversation_id: current.id,
            role: 'assistant',
            content: cleanReply,
            message_type: 'text'
          }
        ]);

        setLoading(false);

        // IMPORTANTE: No modo Consultor (RAG), NÃO detectamos formulários
        // O sistema RAG funciona com conversação natural contínua (pergunta/resposta)
        // Formulários só são abertos via actions explícitas do backend (não implementadas ainda)
        if (!isConsultorMode) {
          // open modal after rendering assistant message so user reads it before the form appears
          setTimeout(() => {
            if (formAction && formAction.params?.tipo && formAction.params?.tipo !== 'matriz_priorizacao') {
              console.log('[FORMULARIO] ✅ Action detectada do backend (post-render):', formAction.params.tipo);
                setFormType(formAction.params.tipo as any);
                // If backend included processo param, propagate to modal
                if (formAction.params?.processo) setFormInitialProcesso(formAction.params.processo);
                else setFormInitialProcesso(null);
                setShowFormModal(true);
              return;
            }

            const formMarker = detectFormMarker(reply);
            if (formMarker && formMarker.tipo !== 'matriz_priorizacao') {
              console.log('[FORMULARIO] ⚠️ Marcador detectado no texto (fallback, post-render):', formMarker.tipo);
              setFormType(formMarker.tipo as any);
              setShowFormModal(true);
            } else {
              console.log('[FORMULARIO] ❌ Nenhum formulário detectado (post-render)');
            }
          }, 120);
        } else {
          console.log('[CONSULTOR-RAG] Modo conversacional ativo - formulários desabilitados');
        }

  // limpa ações pendentes após alguns segundos (se não usadas)
  setTimeout(() => setPendingConsultorActions(null), 45_000);

      } else if (isAnalyticsMode && hasDataFiles) {
        console.log('[ANALYTICS MODE - NEW] Iniciando fluxo simplificado de análise...');
        const dataFileRef = attachedRefs.find(ref => /\.(xlsx|xls|csv)$/i.test(ref.title || ''));
        if (!dataFileRef) throw new Error('Nenhum arquivo de dados (Excel/CSV) encontrado para análise.');

        console.log('[ANALYTICS MODE - NEW] Arquivo de dados:', dataFileRef);

        // Baixar o arquivo do storage para enviar à nova função
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(dataFileRef.storage_bucket || 'references')
          .download(dataFileRef.storage_path!);

        if (downloadError || !fileData) {
          throw new Error(`Falha ao baixar arquivo: ${downloadError?.message || 'Arquivo não encontrado'}`);
        }

        // Converte para base64
        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const file_data_base64 = btoa(binary);

        console.log('[ANALYTICS MODE - NEW] Arquivo baixado e convertido para base64');

        // Update state to analyzing
        setAnalysisState('analyzing');
        setLoading(false); // Hide generic loading, use analysisState instead

        // 🎯 NOVA ARQUITETURA: Chama analyze-file diretamente
        const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('analyze-file', {
          body: {
            file_data: file_data_base64,
            filename: dataFileRef.title || 'arquivo.xlsx',
            user_question: text,
            conversation_id: current.id,
            existing_context: dialogueStateId,  // Send existing dialogue state ID (legacy)
            force_analysis: true  // SEMPRE TRUE: Pula diálogo e analisa direto
          }
        });

        console.log('[ANALYTICS MODE - NEW] Resposta:', { analysisResponse, analysisError });

        if (analysisError) {
          console.error('[ANALYTICS MODE - NEW] Erro na chamada:', analysisError);
          throw analysisError;
        }

        if (!analysisResponse?.success) {
          console.error('[ANALYTICS MODE - NEW] Resposta de falha:', analysisResponse);
          throw new Error(analysisResponse?.error || 'Falha na análise.');
        }

        // Analysis completed successfully
        setAnalysisState('ready_to_answer');
        setShowDialoguePanel(false);
        setDialogueStateId(null);

        const { result, analysis_id, full_dataset_rows } = analysisResponse;
        const summary = result?.summary || 'Análise concluída. Veja os detalhes abaixo.';

        console.log(`[ANALYTICS MODE - NEW] ✅ Análise concluída em ${full_dataset_rows} linhas completas`);

        // Save analysis data for suggestions
        setLastAnalysisData({
          ...result,
          recordsAnalyzed: full_dataset_rows,
          analysis_id: analysis_id
        });
        setShowSuggestions(true);

        const assistantMessage: MessageWithAnalysis = {
          id: `temp-assistant-${Date.now()}`,
          conversation_id: current.id,
          role: 'assistant',
          content: summary,
          created_at: new Date().toISOString(),
          analysis_id: analysis_id,
          analysisData: result,
          message_type: 'analysis_result'
        };

        setMessages(prev => [...prev, assistantMessage]);
        await supabase.from('messages').insert({
          conversation_id: current.id,
          role: 'assistant',
          content: summary,
          analysis_id: analysis_id,
          message_type: 'analysis_result',
        });

  // hadAnalysis flag removed - no-op
      } else {
        console.log('[PRESENTATION/DEFAULT MODE] Usando chat-assistant...');
        const reference_ids = attachedRefs.map(r => r.id);
        const { data, error } = await supabase.functions.invoke('chat-assistant', {
          body: {
            conversation_id: current.id,
            message: text,
            template_id: selectedTemplate?.id ?? null,
            reference_ids: reference_ids.length > 0 ? reference_ids : undefined,
          }
        });

        if (error) throw error;
        const reply = (data?.message || 'Não consegui processar sua solicitação.').trim();

        // Se vier HTML de documento e existir template selecionado, habilita fluxo de geração
        const looksLikeHtml = /<!doctype html|<html/i.test(reply);
        if (looksLikeHtml && selectedTemplate) {
          const cleaned = cleanGeneratedHtml(reply)
          rawHtmlRef.current = cleaned
          setGeneratedHtml(cleaned)
          // canGenerate removed - rely on generatedHtml state
          setReadyReason('IA devolveu HTML no chat')
          const shortMsg = '📄 **Documento rascunho preparado.** Use **Gerar** para finalizar e **Preview** para visualizar/editar.'
          await supabase.from('messages').insert([{ conversation_id: current.id, role: 'assistant', content: shortMsg, message_type: 'presentation' }])

          const { data: msgs2 } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', current.id)
            .order('created_at', { ascending: true })
          setMessages(msgs2 || [])
          setTimeout(() => notifyNew(), 60)
          setLoading(false)
          return
        }

        const assistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          conversation_id: current.id,
          role: 'assistant',
          content: reply,
          created_at: new Date().toISOString(),
          message_type: 'text'
        };
        setMessages(prev => [...prev, assistantMessage]);
        await supabase.from('messages').insert({ conversation_id: current.id, role: 'assistant', content: reply, message_type: 'text' });
      }

      // Auto-rename da conversa nas primeiras mensagens
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', current.id)
        .order('created_at', { ascending: true })

      if ((msgs?.length || 0) <= 2) {
        try {
          const firstUserMsg = messages.find(m => m.role === 'user')?.content || text
          const newTitle = (firstUserMsg || 'Nova Conversa').substring(0, 50).trim().replace(/\n/g, ' ')
          await supabase.functions.invoke('rename-conversation', { body: { conversation_id: current.id, new_title: newTitle } })
          const list = await supabase.from('conversations').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false })
          setConversations(list.data || [])
          const updatedCurrent = list.data?.find(c => c.id === current.id)
          if (updatedCurrent) setCurrent(updatedCurrent)
        } catch (e) {
          console.warn('[ChatPage] Auto-rename failed:', e)
        }
      }
    } catch (e: any) {
      console.error('[sendMessage] Error:', e);

      // Reset all states on error
      setAnalysisState('idle');
      setShowDialoguePanel(false);
      setDialogueStateId(null);

      // User-friendly error message
      const userFriendlyMessage = 'Não foi possível realizar a análise no momento. Tente novamente mais tarde ou entre em contato com o suporte.';
      setErr(userFriendlyMessage);

      // Add error message to chat for better UX
      const errorMessage: Message = {
        id: `temp-error-${Date.now()}`,
        conversation_id: current?.id || '',
        role: 'assistant',
        content: '❌ ' + userFriendlyMessage,
        created_at: new Date().toISOString(),
        message_type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }
  // =========================
  // FIM da NOVA sendMessage
  // =========================

  // Auto-iniciar consultor com primeira mensagem
  useEffect(() => {
    if (!current?.id || !user?.id || chatMode !== 'consultor') {
      hasAutoStarted.current = false;
      return;
    }

    let isCancelled = false;
    let executionLock = false;

    const autoStartConsultor = async () => {
      if (executionLock) {
        console.log('[AUTO-START] Lock ativo, ignorando');
        return;
      }

      executionLock = true;

      try {
        if (hasAutoStarted.current) {
          console.log('[AUTO-START] Já executado para esta conversa, ignorando');
          return;
        }

        const { data: existingMessages, error } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', current.id)
          .limit(1);

        if (error) {
          console.error('[AUTO-START] Erro ao verificar mensagens:', error);
          return;
        }

        if (existingMessages && existingMessages.length > 0) {
          console.log('[AUTO-START] Conversa já tem mensagens, pulando auto-start');
          hasAutoStarted.current = true;
          return;
        }

        if (isCancelled) return;

        hasAutoStarted.current = true;

        console.log('[AUTO-START] Enviando mensagem inicial automática...');

        await new Promise(resolve => setTimeout(resolve, 300));

        if (isCancelled) {
          hasAutoStarted.current = false;
          return;
        }

        sendMessage('Olá');
      } finally {
        executionLock = false;
      }
    };

    autoStartConsultor();

    return () => {
      isCancelled = true;
    };
  }, [current?.id, chatMode, user?.id]);

  async function generateDocument(): Promise<string | null> {
    if (!current || !selectedTemplate || generatingLock.current) return null
    generatingLock.current = true
    setGenerating(true); setErr('')
    setGeneratedHtml(''); setGenLog([])

    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) throw new Error('Sessão inválida')
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`
      log('[DEBUG] STREAM POST URL: ' + url)

      const reference_ids = attachedRefs.length ? attachedRefs.map(r => r.id) : undefined

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          stream: 'generate',
          conversation_id: current.id,
          template_id: selectedTemplate.id,
          template: selectedTemplate.name,
          ...(reference_ids ? { reference_ids } : {})
        })
      })
      if (!resp.body) throw new Error(`Sem corpo de resposta (status ${resp.status})`)
      if (!resp.ok) {
        const t = await resp.text().catch(()=> '')
        throw new Error(`Falha na geração (status ${resp.status}): ${t || 'sem detalhe'}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let finalHtml: string | null = null

      function processBuffer() {
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const chunk of parts) {
          const line = chunk.split('\n').find(l => l.startsWith('data:'))
          if (!line) continue
          const json = line.replace(/^data:\s*/, '')
          try {
            const evt = JSON.parse(json)
            if (evt.event === 'log')        log(evt.message || '')
            else if (evt.event === 'done') {
              const raw = evt.html || ''
              const html = cleanGeneratedHtml(raw)
              rawHtmlRef.current = html
              setGeneratedHtml(html)
              finalHtml = html
              setGenerating(false); generatingLock.current = false
            } else if (evt.event === 'error') {
              log(`[ERROR] ${evt.message || 'falha'}`)
            }
          } catch (e) { log('[WARN] Evento inválido: ' + json) }
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        processBuffer()
      }
      if (buffer) processBuffer()
      return finalHtml
    } catch (e: any) {
      console.error('[DEBUG] generateDocument erro:', e?.message)
      setErr('Erro ao gerar: ' + e.message)
      setGenerating(false); generatingLock.current = false
      return null
    }
  }

  const looksLikeDraftFromAssistant = (text: string) => {
    const t = text || ''
    const endsWithQuestion = /\?\s*$/.test(t.trim())
    const hasCodeFence = /```/.test(t)
    const longish = t.length >= 400 || t.split('\n').length >= 10
    return !hasCodeFence && !endsWithQuestion && longish
  }

  async function openPreviewInNewTab() {
    try {
      const html = generatedHtml
      if (!html) { setErr('Gere o documento primeiro para visualizar.'); return }
      await uploadHtmlAndOpenPreview({
        html: cleanGeneratedHtml(html),
        title: selectedTemplate?.name || current?.title || 'documento',
        conversationId: current?.id,
        userId: user?.id
      })
    } catch (error: any) {
      console.error('[DEBUG] Erro ao abrir preview via Storage]:', error?.message || error)
      setErr('Erro ao abrir preview')
    }
  }

  const requestImprovements = () => {
    const tmpl = selectedTemplate?.name ? ` no template "${selectedTemplate.name}"` : ''
    const msg =
      `✨ Quero melhorar o material${tmpl}.
1) Traga **sugestões objetivas** de conteúdo/estrutura.
2) Liste **dados que faltam**.
3) Propor **ajustes de tom/estilo** e CTA.`
    sendMessage(msg)
  }

  const renderInlineActionsIfDraft = (m: Message, isLastAssistant: boolean) => {
    if (!selectedTemplate) return null
    if (m.role !== 'user' && m.role !== 'assistant') return null
    const draft = looksLikeDraftFromAssistant(m.content)
    if (!draft || !isLastAssistant) return null
    return (
      <div className="mt-2 flex gap-2">
        <button
          onClick={generateDocument}
          disabled={generating}
          className="px-3 py-2 rounded-xl text-white flex items-center gap-2 disabled:opacity-60
                     bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500"
          title="Gerar documento"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>Gerar</span>
        </button>
        <button
          onClick={requestImprovements}
          className="px-3 py-2 rounded-xl text-white flex items-center gap-2
                     bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500"
          title="Sugerir melhorias"
          disabled={generating}
        >
          <Wand2 className="w-4 h-4" />
          <span>Melhorar material</span>
        </button>
        {generatedHtml && !generating && (
          <button
            onClick={openPreviewInNewTab}
            className="px-3 py-2 rounded-xl text-white flex items-center gap-2
                       bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            title="Abrir documento"
          >
            <Eye className="w-4 h-4" />
            <span>Ver documento</span>
          </button>
        )}
        {/* CTA para validação enviada pelo backend (ex: SET_VALIDACAO:priorizacao) */}
        {isLastAssistant && pendingConsultorActions && pendingConsultorActions.some((a:any)=> a.type==='set_validacao') && (
          <div className="flex items-center gap-2">
            {pendingConsultorActions.filter((a:any)=> a.type==='set_validacao').map((act:any, idx:number) => (
              <button
                key={idx}
                onClick={async () => {
                  try {
                    const tipo = act.params?.tipo || 'priorizacao'
                    setLoading(true)
                    const { data, error } = await supabase.functions.invoke('consultor-chat', {
                      body: { message: `[SET_VALIDACAO:${tipo}]`, conversation_id: current?.id, user_id: user?.id }
                    })
                    if (error) throw error
                    // refresh conversation/jornada state
                    try {
                      const { data: convs } = await supabase.from('conversations').select('*').eq('user_id', user?.id).order('updated_at', { ascending: false })
                      setConversations(convs || [])
                    } catch (e) {}
                  } catch (e:any) {
                    console.error('Erro ao enviar validação:', e)
                    alert('Falha ao enviar validação: ' + (e?.message || e))
                  } finally {
                    setLoading(false)
                    setPendingConsultorActions(null)
                  }
                }}
                className="px-3 py-2 rounded-xl text-white bg-amber-500 hover:bg-amber-600"
              >
                Validar Priorização
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-900 overflow-hidden">
      <div className="flex-1 flex">
        {/* Esquerda: Conversas */}
        <div className="w-60 bg-gray-800/70 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">Conversas</span>
              <button onClick={createConversation} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg" title="Nova conversa">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`p-2.5 rounded-lg cursor-pointer transition ${current?.id === c.id ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'}`}
                onClick={() => { setCurrent(c); setChatMode(c.chat_mode || 'analytics') }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="text-[11px] opacity-75">{formatDate(c.updated_at)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e)=>{e.stopPropagation(); setEditingConvId(c.id); setEditingTitle(c.title)}} className="p-1 hover:bg-gray-700 rounded" title="Renomear">
                      <Pencil className="w-3 h-3"/>
                    </button>
                    <button onClick={(e)=>{ e.stopPropagation(); deleteConversation(c.id) }} className="p-1 hover:bg-red-600 rounded" title="Excluir">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {editingConvId === c.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={editingTitle} onChange={(e)=>setEditingTitle(e.target.value)}
                      className="w-40 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm" autoFocus />
                    <button onClick={(e)=>{e.stopPropagation(); saveEditTitle(c)}} className="p-1 bg-green-600 rounded text-white" title="Salvar título">
                      <Check className="w-3 h-3"/>
                    </button>
                    <button onClick={(e)=>{e.stopPropagation(); setEditingConvId(null); setEditingTitle('')}} className="p-1 bg-gray-600 rounded text-white" title="Cancelar">
                      <XCircle className="w-3 h-3"/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800"><DiscreteMenu /></div>
        </div>

        {/* Centro: Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
            <div className="flex items-center gap-2 text-white mb-3">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{title}</div>
                {selectedTemplate && <div className="text-xs text-gray-400 truncate">Template: {selectedTemplate.name}</div>}
              </div>
            </div>
            {current && (
              <ChatModeToggle
                currentMode={chatMode}
                onModeChange={async (newMode) => {
                  setChatMode(newMode)
                  await supabase.from('conversations').update({ chat_mode: newMode }).eq('id', current.id)
                  setConversations(prev => prev.map(c => c.id === current.id ? { ...c, chat_mode: newMode } : c))
                }}
                disabled={loading || generating}
              />
            )}
          </div>

          {/* Genius Mode - Render dedicated component */}
          {chatMode === 'genius' && current && user ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* File upload button */}
              <div className="border-b border-gray-700 p-4">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition">
                  <Plus className="w-5 h-5" />
                  <span>Adicionar Arquivos (máx. 5)</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.docx,.pptx"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setGeniusFiles(prev => [...prev, ...files].slice(0, 5));
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                {geniusFiles.length > 0 && (
                  <span className="ml-3 text-sm text-gray-400">
                    {geniusFiles.length} arquivo(s) selecionado(s)
                  </span>
                )}
              </div>
              <GeniusChat
                conversationId={current.id}
                userId={user.id}
                messages={messages}
                onMessagesUpdate={setMessages}
                attachedFiles={geniusFiles}
                onClearFiles={() => setGeniusFiles([])}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-w-0">
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 chat-messages">
              {!current ? (
                <div className="h-full flex items-center justify-center text-center text-gray-300">
                  <div>
                    <MessageSquare className="w-16 h-16 mx-auto mb-3 text-gray-500" />
                    <div className="text-xl mb-1">Bem-vindo ao Chat IA</div>
                    <div className="text-gray-400 mb-4">Crie uma nova conversa para começar.</div>
                    <button onClick={createConversation} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Nova Conversa</button>
                  </div>
                </div>
              ) : messages.length === 0 && !loading ? (
              chatMode === 'consultor' ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="max-w-2xl mx-auto p-8">
                    <Bot className="w-20 h-20 mx-auto mb-6 text-blue-500" />
                    <h2 className="text-3xl font-bold mb-4 text-white">Consultor Proceda IA</h2>
                    <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                      Pronto para transformar sua empresa? Vou te guiar em uma jornada completa de diagnóstico, mapeamento e ações práticas para escalar seu negócio.
                    </p>
                    <button
                      onClick={() => {
                        setInput('Preciso melhorar a performance e resultados da minha empresa, vamos começar');
                        setTimeout(() => {
                          const sendBtn = document.querySelector('[data-send-btn]') as HTMLButtonElement;
                          if (sendBtn) sendBtn.click();
                        }, 100);
                      }}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                    >
                      Preciso melhorar a performance e resultados da minha empresa, vamos começar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-gray-300">
                  <div>
                    <Bot className="w-16 h-16 mx-auto mb-3 text-blue-400" />
                    <div className="text-xl mb-1">Como posso ajudar?</div>
                    <div className="text-gray-400 mb-4">Digite sua primeira mensagem abaixo.</div>
                  </div>
                </div>
              )
            ) : (
              <>
                {messages.map((m, idx) => {
                  const isAssistant = m.role !== 'user'
                  const isLastAssistant = isAssistant && messages.slice(idx+1).every(x => x.role === 'user')
                  return (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[72%] p-3 rounded-2xl shadow border ${m.role === 'user'
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border-blue-500'
                        : 'bg-gray-800 text-gray-100 border-gray-700'}`}>
                        <div className="flex gap-2">
                          <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0">
                            {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-blue-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            {m.analysisData ? (
                              <MessageContent
                                content={m.content}
                                analysisData={m.analysisData}
                                onGenerateDocument={selectedTemplate ? generateDocument : undefined}
                                analysisId={m.analysis_id}
                                conversationId={current.id}
                                messageType={m.message_type}
                              />
                            ) : (
                              <div
                                className="leading-relaxed text-[15px] [&_strong]:text-white/90"
                                dangerouslySetInnerHTML={{ __html: mdLikeToHtml(m.content) }}
                              />
                            )}
                            <div className="text-[11px] opacity-75 mt-1">{formatTime(m.created_at)}</div>
                            {!m.analysisData && renderInlineActionsIfDraft(m, isLastAssistant)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Botão de Validação de Escopo - mostrar quando aguardando validação */}
                {chatMode === 'consultor' && showValidateScopeButton && current && user && (
                  <ValidateScopeButton
                    conversationId={current.id}
                    userId={user.id}
                    onValidated={() => {
                      setShowValidateScopeButton(false)
                      // Reload messages to show next step
                      loadMessages(current.id)
                    }}
                  />
                )}

                {/* Show ThinkingAnimation only if NOT in analytics mode with active state */}
                {loading && !(chatMode === 'analytics' && analysisState !== 'idle') && <ThinkingAnimation />}
                {generating && <DocumentGeneratingAnimation log={genLog} />}
                {loadingAnalyses && (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <span className="ml-3 text-gray-400">Carregando análises...</span>
                  </div>
                )}

                {/* Analysis State Indicator - ONLY for analytics mode */}
                {chatMode === 'analytics' && analysisState !== 'idle' && (
                  <div className="mb-4">
                    <AnalysisStateIndicator
                      state={analysisState}
                    />
                  </div>
                )}

                {/* Analysis Suggestions - Show after successful analysis */}
                {showSuggestions && lastAnalysisData && analysisState === 'ready_to_answer' && (
                  <div className="mb-4">
                    <AnalysisSuggestionsCard
                      suggestions={generateSuggestions(
                        lastAnalysisData,
                        selectedTemplate ? () => handleSuggestionClick('generate-presentation') : undefined,
                        () => handleSuggestionClick('deep-dive'),
                        () => handleSuggestionClick('export-report'),
                        () => handleSuggestionClick('find-anomalies')
                      )}
                      recordsAnalyzed={lastAnalysisData.recordsAnalyzed || 0}
                    />
                  </div>
                )}

                {/* Context Questions Panel - NEW SYSTEM */}
                {showDialoguePanel && current && (
                  <div className="mb-4">
                    <ContextQuestionsPanel
                      conversationId={current.id}
                      onAnswerSubmit={handleDialogueAnswer}
                      onSkip={handleSkipDialogue}
                    />
                  </div>
                )}
              </>
            )}

            {(pending > 0 || generating || loading || messages.length > 3) && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
              <button
                onClick={scrollToBottom}
                className="px-3 py-2 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center gap-2 transition-all"
                title="Ir para a última mensagem"
              >
                <ChevronDown className="w-5 h-5" />
                {pending > 0 && (
                  <span className="text-xs bg-white text-blue-600 px-1.5 rounded-full">
                    {pending}
                  </span>
                )}
              </button>
            </div>
          )}

          {err && (
            <div className="mx-4 mb-3 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> <span className="flex-1">{err}</span>
              <button onClick={() => setErr('')} className="p-1 hover:bg-red-800/30 rounded" title="Fechar aviso"><X className="w-3 h-3"/></button>
            </div>
          )}

          {current && (
            <div className="bg-gray-900 border-t border-gray-800 p-3">
              {attachedRefs.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs text-gray-300 font-medium inline-flex items-center gap-2 ${justAttachedBlink ? 'animate-pulse' : ''}`}>
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      Anexos ({attachedRefs.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attachedRefs.map(ref => (
                      <div
                        key={ref.id}
                        className="group inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-700 bg-gray-800/70 text-gray-100"
                      >
                        {(ref.type === 'url')
                          ? <LinkIcon className="w-4 h-4 text-sky-400" />
                          : <FileText className="w-4 h-4 text-indigo-300" />}
                        <span className="max-w-[220px] truncate text-sm">
                          {ref.title || (ref.type === 'url' ? 'URL' : 'Arquivo')}
                        </span>
                        <button
                          onClick={() => setAttachedRefs(prev => prev.filter(r => r.id !== ref.id))}
                          className="opacity-70 hover:opacity-100 hover:text-red-300 transition"
                          title="Remover anexo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="relative flex-1">
                  <textarea
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={
                      selectedTemplate
                        ? `Descreva o conteúdo para "${selectedTemplate.name}"…`
                        : chatMode === 'analytics'
                          ? 'Peça uma análise (ex.: "ticket médio por mês", "top 5 categorias"…)'
                          : chatMode === 'presentation'
                            ? 'Peça um esboço de apresentação…'
                            : 'Digite sua mensagem…'
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pr-12 pl-12 text-white placeholder-gray-400"
                    disabled={loading || generating}
                  />

                  {/* 🔘 Seletor de modo (só ícones), dentro da caixa, lado esquerdo (oposto ao clipe) */}
                  <div className="absolute left-2 bottom-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setChatMode(prev => (prev === 'presentation' ? 'analytics' : 'presentation'))}
                      title="Modo Apresentação"
                      className={`p-2 rounded-md transition
                        ${chatMode === 'presentation'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                      aria-label="Modo Apresentação"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setChatMode(prev => (prev === 'analytics' ? 'presentation' : 'analytics'))}
                      title="Modo Analytics"
                      className={`p-2 rounded-md transition
                        ${chatMode === 'analytics'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                      aria-label="Modo Analytics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute right-2 bottom-2">
                    <AttachmentTrigger
                      onPickLocal={(fileList) => handleUploadFiles(Array.from(fileList))}
                      onInsertUrl={(url) => handleAddUrl(url)}
                      isUploading={isUploading}
                    />
                  </div>
                </div>

                <button
                  data-send-btn
                  onClick={() => sendMessage()}
                  disabled={(!input.trim() && attachedRefs.length === 0) || loading || generating}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:bg-gray-600"
                  title="Enviar para o agente"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {attachedRefs.length > 0 && (
                    <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-sky-600/30 text-sky-300 border border-sky-700/40">
                      {attachedRefs.length}
                    </span>
                  )}
                </button>
              </div>


              {readyReason && <div className="sr-only">ready-reason:{readyReason}</div>}
            </div>
          )}
          </div>
          </div>
        )}

        {/* Direita: Templates ou Consultor */}
        {chatMode === 'consultor' ? (
          current && <LateralConsultor conversationId={current.id} />
        ) : chatMode === 'genius' ? null : (
          <div className="w-80 border-l border-gray-800 flex flex-col">
            <TemplateSelectorPanel
              templates={templates}
              selectedTemplateId={selectedTemplate?.id}
              onSelect={(template) => setSelectedTemplate(template)}
            />
          </div>
        )}
      </div>

      {/* Modal de Formulário Dinâmico */}
      {showFormModal && formType && (
        <FormularioModal
          tipo={formType as any}
            onClose={() => {
            setShowFormModal(false);
            setFormType(null);
            setFormInitialProcesso(null);
            setModalJornadaId(null);
          }}
          onComplete={async (dados) => {
            console.log('[FORMULARIO] Dados coletados:', dados);
            setFormData(dados);
            setShowFormModal(false);
            setFormType(null);
            setFormInitialProcesso(null);

            // Send form data directly to backend via consultor-chat
            if (!current?.id || !user?.id) return;

            setLoading(true);
            try {
              // Structure payload with is_form_submission flag
              const payload = {
                tipo_form: formType,
                dados,
                is_form_submission: true
              };

              // Create formatted message for display
              const formattedMessage = [
                '💾 **Formulário enviado**',
                '```json',
                JSON.stringify(payload, null, 2),
                '```'
              ].join('\n');

              // Persistir uma mensagem de usuário com o payload estruturado
              try {
                await supabase.from('messages').insert({
                  conversation_id: current.id,
                  role: 'user',
                  content: formattedMessage,
                  user_id: user.id,
                  message_type: 'text'
                });
              } catch (e) {
                console.warn('[FORMULARIO] falha ao persistir mensagem de form:', e);
              }

              // REFACTORED: Form data now sent directly as message to consultor-rag
              if (isConsultorMode) {
                const sessaoId = await getOrCreateSessao(user.id, current.id, formattedMessage);

                // Send form data as regular message - Edge Function handles context automatically
                const ragResponse = await callConsultorRAG({
                  message: formattedMessage,
                  userId: user.id,
                  conversationId: current.id,
                  sessaoId: sessaoId
                });

                const reply = ragResponse.text || 'Formulário recebido com sucesso!';
                const cleanReply = removeFormMarkers(reply);

                // Execute any actions returned by RAG
                if (ragResponse.sessaoId) {
                  const actions: any[] = [];
                  if (ragResponse.needsForm) {
                    actions.push({
                      type: 'coletar_info',
                      params: { tipo_form: ragResponse.formType }
                    });
                  }
                  // REFACTORED: Actions removed - Edge Function handles everything
                  // Document generation will be handled by LLM when appropriate
                  window.dispatchEvent(new CustomEvent('entregavel:created', { detail: { sessaoId: ragResponse.sessaoId } }));
                }
              } else {
                // Fallback to old consultor-chat for non-consultor mode
                const { data: consultorData, error: consultorError } = await supabase.functions.invoke('consultor-chat', {
                  body: {
                    text: formattedMessage,
                    conversation_id: current.id,
                    user_id: user.id,
                    is_form_submission: true,
                    form_type: formType,
                    form_data: dados
                  }
                });

                if (consultorError) throw consultorError;
                var reply = consultorData?.response || 'Formulário recebido com sucesso!';
                var cleanReply = removeFormMarkers(reply);
              }

              // Add user message showing form was submitted
              const userMessage: Message = {
                id: `temp-user-${Date.now()}`,
                conversation_id: current.id,
                role: 'user',
                content: `✅ Formulário ${formType} preenchido`,
                created_at: new Date().toISOString(),
                message_type: 'text'
              };

              const assistantMessage: Message = {
                id: `temp-assistant-${Date.now()}`,
                conversation_id: current.id,
                role: 'assistant',
                content: cleanReply,
                created_at: new Date().toISOString(),
                message_type: 'text'
              };

              setMessages(prev => [...prev, userMessage, assistantMessage]);

              // Tentar detectar prêmio/XP via polling (caso backend não retorne gamification no response)
              try { void pollGamification(4, 600) } catch (e) { console.warn('[GAMIFICATION] poll after form erro:', e) }

              // Check for new form actions (only in non-consultor mode)
              if (!isConsultorMode) {
                const actions = (consultorData as any)?.actions || [];
                const formAction = actions.find((a: any) => a.type === 'exibir_formulario' && a.params?.tipo !== 'matriz_priorizacao');
                if (formAction && formAction.params?.tipo) {
                  console.log('[FORMULARIO] Novo formulário detectado:', formAction.params.tipo);
                  setFormType(formAction.params.tipo as any);
                  if (formAction.params?.processo) setFormInitialProcesso(formAction.params.processo);
                  else setFormInitialProcesso(null);
                  setShowFormModal(true);
                }
              }
            } catch (error: any) {
              console.error('[FORMULARIO] Erro ao enviar:', error);
              setErr('Erro ao enviar formulário: ' + error.message);
            } finally {
              setLoading(false);
            }
          }}
          dadosIniciais={formData}
          processos={modalProcessos || undefined}
          processoInicial={formInitialProcesso || undefined}
          // pass ids so the inner form can submit with correct jornada/conversation context
          // @ts-ignore - permissive prop passing
          conversationId={current?.id}
          // @ts-ignore
          userId={user?.id}
          // @ts-ignore
          jornadaId={modalJornadaId}
        />
      )}

      {/* Popup de Celebração de XP */}
      {showXPCelebration && xpCelebrationData && (
        <XPCelebrationPopup
          xpGanho={xpCelebrationData.xpGanho}
          xpTotal={xpCelebrationData.xpTotal}
          nivel={xpCelebrationData.nivel}
          motivo={xpCelebrationData.motivo}
          onClose={() => {
            setShowXPCelebration(false)
            setXPCelebrationData(null)
          }}
        />
      )}
    </div>
  )
}

export { ChatPage }
export default ChatPage

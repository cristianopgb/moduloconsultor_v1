import React, { useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, Code, Database, Calendar, User,
  AlertCircle, Loader2, Eye, FileCode, Tag, Sparkles,
  ThumbsUp, ThumbsDown, Clock, Filter, Search, Edit2,
  Copy, Trash2, RefreshCw, Zap, ChevronDown, ChevronUp,
  Settings, TrendingUp, BarChart3, Info, HelpCircle, BookOpen,
  Plus, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface CustomSQLAttempt {
  id: string
  user_id: string
  user_question: string
  generated_sql: string
  dataset_columns: any[]
  query_results_sample: any[]
  execution_success: boolean
  execution_error: string | null
  status: 'pending' | 'approved' | 'rejected' | 'duplicate'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  approved_template_id: string | null
  notes: string | null
}

interface ApprovalFormData {
  template_name: string
  template_category: string
  template_description: string
  semantic_tags: string[]
  required_columns: Record<string, PlaceholderConfig>
}

interface PlaceholderConfig {
  type: 'numeric' | 'text' | 'date' | 'boolean'
  description: string
  default?: string
}

interface AnalyticsTemplate {
  id: string
  name: string
  category: string
  description: string
  sql_template: string
  required_columns: Record<string, PlaceholderConfig>
  semantic_tags: string[]
  created_at: string
  updated_at: string
  usage_count?: number
}

type TabType = 'pending' | 'approved' | 'rejected' | 'templates'

export function LearningPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<CustomSQLAttempt[]>([])
  const [templates, setTemplates] = useState<AnalyticsTemplate[]>([])
  const [filteredAttempts, setFilteredAttempts] = useState<CustomSQLAttempt[]>([])
  const [selectedTab, setSelectedTab] = useState<TabType>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttempt, setSelectedAttempt] = useState<CustomSQLAttempt | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<AnalyticsTemplate | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false)
  const [approvalForm, setApprovalForm] = useState<ApprovalFormData>({
    template_name: '',
    template_category: 'Analytics',
    template_description: '',
    semantic_tags: [],
    required_columns: {}
  })
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [activeModalTab, setActiveModalTab] = useState<'basic' | 'columns' | 'preview'>('basic')
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [suggestingTags, setSuggestingTags] = useState(false)
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    category: 'Analytics',
    description: '',
    sql_template: '',
    semantic_tags: [] as string[],
    required_columns: {} as Record<string, PlaceholderConfig>
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterAttempts()
  }, [attempts, selectedTab, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 [LearningPage] Iniciando carregamento de dados...')

      const [attemptsResult, templatesResult] = await Promise.all([
        supabase
          .from('custom_sql_attempts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('models')
          .select('*')
          .eq('template_type', 'analytics')
          .order('created_at', { ascending: false })
      ])

      console.log('📊 [LearningPage] Attempts:', attemptsResult)
      console.log('📋 [LearningPage] Templates:', templatesResult)

      if (attemptsResult.error) throw attemptsResult.error
      if (templatesResult.error) throw templatesResult.error

      setAttempts(attemptsResult.data || [])
      setTemplates(templatesResult.data || [])

      console.log('✅ [LearningPage] Dados carregados:', {
        attempts: attemptsResult.data?.length || 0,
        templates: templatesResult.data?.length || 0
      })
    } catch (err: any) {
      console.error('❌ [LearningPage] Erro ao carregar dados:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filterAttempts = () => {
    let filtered = attempts

    if (selectedTab !== 'templates') {
      filtered = filtered.filter(a => a.status === selectedTab)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.user_question.toLowerCase().includes(term) ||
        a.generated_sql.toLowerCase().includes(term)
      )
    }

    setFilteredAttempts(filtered)
  }

  const extractPlaceholders = (sql: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g
    const matches = []
    let match
    while ((match = regex.exec(sql)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1])
      }
    }
    return matches
  }

  const suggestPlaceholderType = (name: string, columns: any[]): PlaceholderConfig => {
    const lowerName = name.toLowerCase()

    if (lowerName.includes('date') || lowerName.includes('time')) {
      return { type: 'date', description: `Coluna de data/hora para ${name}` }
    }

    if (lowerName.includes('value') || lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('total')) {
      return { type: 'numeric', description: `Coluna numérica para ${name}` }
    }

    if (lowerName.includes('group') || lowerName.includes('category') || lowerName.includes('name')) {
      return { type: 'text', description: `Coluna de texto para agrupamento/categoria` }
    }

    if (lowerName.includes('limit') || lowerName.includes('top')) {
      return { type: 'numeric', description: 'Limite de resultados', default: '10' }
    }

    return { type: 'text', description: `Configurar tipo para ${name}` }
  }

  const autoDetectPlaceholders = (sql: string, columns: any[]) => {
    const placeholders = extractPlaceholders(sql)
    setDetectedPlaceholders(placeholders)

    const newRequiredColumns: Record<string, PlaceholderConfig> = {}

    placeholders.forEach(placeholder => {
      newRequiredColumns[placeholder] = suggestPlaceholderType(placeholder, columns)
    })

    setApprovalForm(prev => ({
      ...prev,
      required_columns: newRequiredColumns
    }))
  }

  const suggestSemanticTags = async (question: string) => {
    try {
      setSuggestingTags(true)

      const { data, error } = await (await import('../../lib/functionsClient')).callEdgeFunction('chat-assistant', {
        messages: [
          { role: 'system', content: 'Você extrai palavras-chave relevantes de perguntas. Retorne APENAS um array JSON de strings, sem explicações.' },
          { role: 'user', content: `Extraia 5-10 palavras-chave em português desta pergunta para busca semântica: "${question}"` }
        ],
        temperature: 0.3
      });

      if (error) throw new Error('Erro ao sugerir tags: ' + JSON.stringify(error));

      const content = data?.choices?.[0]?.message?.content || '[]'

      let suggestedTags: string[] = []
      try {
        suggestedTags = JSON.parse(content)
      } catch {
        const matches = content.match(/"([^"]+)"/g)
        if (matches) {
          suggestedTags = matches.map((m: string) => m.replace(/"/g, ''))
        }
      }

      if (suggestedTags.length > 0) {
        setApprovalForm(prev => ({
          ...prev,
          semantic_tags: [...new Set([...prev.semantic_tags, ...suggestedTags.slice(0, 10)])]
        }))
      }
    } catch (err: any) {
      console.error('Erro ao sugerir tags:', err)
    } finally {
      setSuggestingTags(false)
    }
  }

  const openApprovalModal = (attempt: CustomSQLAttempt) => {
    setSelectedAttempt(attempt)
    setError(null) // Limpar erros anteriores

    const suggestedName = attempt.user_question.split('?')[0].trim()
    const capitalizedName = suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1)

    setApprovalForm({
      template_name: capitalizedName.substring(0, 100),
      template_category: 'Analytics',
      template_description: attempt.user_question,
      semantic_tags: [],
      required_columns: {}
    })

    autoDetectPlaceholders(attempt.generated_sql, attempt.dataset_columns)
    setActiveModalTab('basic')
    setShowApprovalModal(true)

    // Auto-sugerir tags semânticas ao abrir modal
    if (attempt.user_question) {
      suggestSemanticTags(attempt.user_question)
    }
  }

  const openRejectModal = (attempt: CustomSQLAttempt) => {
    setSelectedAttempt(attempt)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const openEditTemplateModal = (template: AnalyticsTemplate) => {
    setSelectedTemplate(template)
    setApprovalForm({
      template_name: template.name,
      template_category: template.category,
      template_description: template.description,
      semantic_tags: template.semantic_tags || [],
      required_columns: template.required_columns || {}
    })
    setDetectedPlaceholders(extractPlaceholders(template.sql_template))
    setShowEditTemplateModal(true)
  }

  const handleApprove = async () => {
    if (!selectedAttempt || !user) return

    // Validação 1: Nome do template
    if (!approvalForm.template_name.trim()) {
      setError('Nome do template é obrigatório')
      return
    }

    // Validação 2: Tags semânticas (mínimo 1, máximo 10)
    if (approvalForm.semantic_tags.length === 0) {
      setError('Adicione pelo menos uma tag semântica para detecção automática')
      return
    }

    if (approvalForm.semantic_tags.length > 10) {
      setError('Máximo de 10 tags semânticas permitidas')
      return
    }

    // Validação 3: Configuração de placeholders
    if (detectedPlaceholders.length > 0) {
      const unmappedPlaceholders = detectedPlaceholders.filter(
        p => !approvalForm.required_columns[p] || !approvalForm.required_columns[p].type
      )

      if (unmappedPlaceholders.length > 0) {
        setError(`Placeholders não configurados: ${unmappedPlaceholders.join(', ')}`)
        setActiveModalTab('columns') // Leva usuário para aba de configuração
        return
      }

      // Validação 4: Descrição de placeholders
      const placeholdersWithoutDescription = detectedPlaceholders.filter(
        p => !approvalForm.required_columns[p]?.description?.trim()
      )

      if (placeholdersWithoutDescription.length > 0) {
        setError(`Placeholders sem descrição: ${placeholdersWithoutDescription.join(', ')}`)
        setActiveModalTab('columns')
        return
      }
    }

    // Validação 5: Verificar tipos de dados dos parâmetros
    if (!Array.isArray(approvalForm.semantic_tags)) {
      setError('Erro interno: semantic_tags deve ser um array')
      console.error('semantic_tags type:', typeof approvalForm.semantic_tags, approvalForm.semantic_tags)
      return
    }

    if (typeof approvalForm.required_columns !== 'object' || Array.isArray(approvalForm.required_columns)) {
      setError('Erro interno: required_columns deve ser um objeto')
      console.error('required_columns type:', typeof approvalForm.required_columns, approvalForm.required_columns)
      return
    }

    try {
      setProcessing(true)
      setError(null)

      // CRÍTICO: Supabase RPC com parâmetros JSONB requer objetos nativos JavaScript
      // NÃO usar JSON.stringify - o Supabase converte automaticamente
      const { data: templateId, error: approveError } = await supabase
        .rpc('approve_custom_sql_as_template', {
          p_custom_sql_id: selectedAttempt.id,
          p_template_name: approvalForm.template_name,
          p_template_category: approvalForm.template_category,
          p_template_description: approvalForm.template_description,
          p_semantic_tags: approvalForm.semantic_tags, // Array nativo, não JSON.stringify
          p_required_columns: approvalForm.required_columns, // Objeto nativo, não JSON.stringify
          p_reviewer_id: user.id
        })

      if (approveError) {
        console.error('Erro detalhado ao aprovar:', approveError)
        throw approveError
      }

      console.log('Template aprovado com sucesso! ID:', templateId)

      await createNotificationForMasters('template_approved', {
        title: 'Novo Template Aprovado',
        message: `Template "${approvalForm.template_name}" foi criado com sucesso`,
        template_id: templateId
      })

      setShowApprovalModal(false)
      setSelectedAttempt(null)
      await loadData()

      // Feedback visual de sucesso - melhorado
      const successMessage = `✅ Template aprovado com sucesso!\n\n` +
        `📋 Nome: ${approvalForm.template_name}\n` +
        `🏷️ Tags: ${approvalForm.semantic_tags.length} configuradas\n` +
        `🔧 Placeholders: ${detectedPlaceholders.length} mapeados\n\n` +
        `✨ O template já está disponível para uso automático!`

      alert(successMessage)
      setError(null)
    } catch (err: any) {
      console.error('Erro ao aprovar:', err)
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedAttempt || !user) return

    if (!rejectionReason.trim()) {
      setError('Motivo da rejeição é obrigatório')
      return
    }

    try {
      setProcessing(true)
      setError(null)

      const { error: rejectError } = await supabase
        .from('custom_sql_attempts')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', selectedAttempt.id)

      if (rejectError) {
        console.error('Erro ao rejeitar:', rejectError)
        throw rejectError
      }

      console.log('SQL customizado rejeitado com sucesso')

      setShowRejectModal(false)
      setSelectedAttempt(null)
      await loadData()

      const rejectMessage = `❌ SQL rejeitado\n\n` +
        `Motivo: ${rejectionReason.substring(0, 100)}${rejectionReason.length > 100 ? '...' : ''}\n\n` +
        `O registro foi marcado como rejeitado e não aparecerá mais em pendentes.`

      alert(rejectMessage)
      setError(null)
    } catch (err: any) {
      console.error('Erro ao rejeitar:', err)
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleEditTemplate = async () => {
    if (!selectedTemplate || !user) return

    if (!approvalForm.template_name.trim()) {
      setError('Nome do template é obrigatório')
      return
    }

    try {
      setProcessing(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('models')
        .update({
          name: approvalForm.template_name,
          category: approvalForm.template_category,
          description: approvalForm.template_description,
          semantic_tags: approvalForm.semantic_tags,
          required_columns: approvalForm.required_columns,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplate.id)

      if (updateError) throw updateError

      setShowEditTemplateModal(false)
      setSelectedTemplate(null)
      await loadData()
      setError(null)
    } catch (err: any) {
      console.error('Erro ao editar template:', err)
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja deletar este template? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      await loadData()
    } catch (err: any) {
      console.error('Erro ao deletar template:', err)
      setError(err.message)
    }
  }

  const handleCreateTemplate = async () => {
    if (!user) return

    // Validações
    if (!newTemplateForm.name.trim()) {
      setError('Nome do template é obrigatório')
      return
    }

    if (!newTemplateForm.sql_template.trim()) {
      setError('SQL template é obrigatório')
      return
    }

    if (newTemplateForm.semantic_tags.length === 0) {
      setError('Adicione pelo menos uma tag semântica')
      return
    }

    // Validar placeholders configurados
    const placeholders = extractPlaceholders(newTemplateForm.sql_template)
    if (placeholders.length > 0) {
      const unmappedPlaceholders = placeholders.filter(
        p => !newTemplateForm.required_columns[p] || !newTemplateForm.required_columns[p].type
      )

      if (unmappedPlaceholders.length > 0) {
        setError(`Placeholders não configurados: ${unmappedPlaceholders.join(', ')}`)
        setActiveModalTab('columns')
        return
      }
    }

    try {
      setProcessing(true)
      setError(null)

      const { data: newTemplate, error: insertError } = await supabase
        .from('models')
        .insert({
          name: newTemplateForm.name,
          category: newTemplateForm.category,
          description: newTemplateForm.description,
          template_type: 'analytics',
          file_type: null,
          sql_template: newTemplateForm.sql_template,
          required_columns: newTemplateForm.required_columns,
          semantic_tags: newTemplateForm.semantic_tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) throw insertError

      console.log('Template criado com sucesso!', newTemplate)

      setShowCreateTemplateModal(false)
      setNewTemplateForm({
        name: '',
        category: 'Analytics',
        description: '',
        sql_template: '',
        semantic_tags: [],
        required_columns: {}
      })
      await loadData()

      alert(`✅ Template criado com sucesso!\n\n📋 Nome: ${newTemplateForm.name}\n🏷️ Tags: ${newTemplateForm.semantic_tags.length} configuradas\n\n✨ O template já está disponível para uso automático!`)
      setError(null)
    } catch (err: any) {
      console.error('Erro ao criar template:', err)
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const openCreateTemplateModal = () => {
    setNewTemplateForm({
      name: '',
      category: 'Analytics',
      description: '',
      sql_template: '',
      semantic_tags: [],
      required_columns: {}
    })
    setDetectedPlaceholders([])
    setActiveModalTab('basic')
    setShowCreateTemplateModal(true)
  }

  const updateNewTemplateForm = (field: string, value: any) => {
    setNewTemplateForm(prev => ({
      ...prev,
      [field]: value
    }))

    // Auto-detectar placeholders quando SQL muda
    if (field === 'sql_template') {
      autoDetectPlaceholdersForNewTemplate(value)
    }
  }

  const autoDetectPlaceholdersForNewTemplate = (sql: string) => {
    const placeholders = extractPlaceholders(sql)
    setDetectedPlaceholders(placeholders)

    const newRequiredColumns: Record<string, PlaceholderConfig> = {}

    placeholders.forEach(placeholder => {
      // Manter configuração existente se já existe
      if (newTemplateForm.required_columns[placeholder]) {
        newRequiredColumns[placeholder] = newTemplateForm.required_columns[placeholder]
      } else {
        newRequiredColumns[placeholder] = suggestPlaceholderType(placeholder, [])
      }
    })

    setNewTemplateForm(prev => ({
      ...prev,
      required_columns: newRequiredColumns
    }))
  }

  const updateNewTemplatePlaceholder = (placeholder: string, field: keyof PlaceholderConfig, value: any) => {
    setNewTemplateForm(prev => ({
      ...prev,
      required_columns: {
        ...prev.required_columns,
        [placeholder]: {
          ...prev.required_columns[placeholder],
          [field]: value
        }
      }
    }))
  }

  const addTagToNewTemplate = () => {
    if (!tagInput.trim()) return
    if (newTemplateForm.semantic_tags.includes(tagInput.trim())) return
    if (newTemplateForm.semantic_tags.length >= 10) {
      setError('Máximo de 10 tags permitidas')
      return
    }

    setNewTemplateForm(prev => ({
      ...prev,
      semantic_tags: [...prev.semantic_tags, tagInput.trim()]
    }))
    setTagInput('')
  }

  const removeTagFromNewTemplate = (tag: string) => {
    setNewTemplateForm(prev => ({
      ...prev,
      semantic_tags: prev.semantic_tags.filter(t => t !== tag)
    }))
  }

  const suggestTagsForNewTemplate = async () => {
    if (!newTemplateForm.description && !newTemplateForm.name) {
      setError('Preencha o nome ou descrição primeiro para sugerir tags')
      return
    }

    try {
      setSuggestingTags(true)

      const questionText = newTemplateForm.description || newTemplateForm.name

      const { data, error } = await callEdgeFunction('chat-assistant', {
        messages: [
          { role: 'system', content: 'Você extrai palavras-chave relevantes de perguntas. Retorne APENAS um array JSON de strings, sem explicações.' },
          { role: 'user', content: `Extraia 5-10 palavras-chave em português desta pergunta para busca semântica: "${questionText}"` }
        ],
        temperature: 0.3
      })
      if (error) throw error
      const content = data?.choices?.[0]?.message?.content || '[]'

      let suggestedTags: string[] = []
      try {
        suggestedTags = JSON.parse(content)
      } catch {
        const matches = content.match(/"([^"]+)"/g)
        if (matches) {
          suggestedTags = matches.map((m: string) => m.replace(/"/g, ''))
        }
      }

      if (suggestedTags.length > 0) {
        setNewTemplateForm(prev => ({
          ...prev,
          semantic_tags: [...new Set([...prev.semantic_tags, ...suggestedTags.slice(0, 10)])]
        }))
      }
    } catch (err: any) {
      console.error('Erro ao sugerir tags:', err)
    } finally {
      setSuggestingTags(false)
    }
  }

  const createNotificationForMasters = async (type: string, data: any) => {
    try {
      // Verify user is authenticated before making query
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.warn('Cannot create notification: No active session')
        return
      }

      const { data: masters, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('role', 'master')

      if (error) {
        console.error('Error fetching masters for notification:', {
          message: error.message,
          code: error.code,
          details: error.details
        })
        return
      }

      if (masters && masters.length > 0) {
        console.log('Notificações enviadas para masters:', masters.length)
      }
    } catch (err) {
      console.error('Unexpected error creating notification:', err)
    }
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    if (approvalForm.semantic_tags.includes(tagInput.trim())) return
    if (approvalForm.semantic_tags.length >= 10) {
      setError('Máximo de 10 tags permitidas')
      return
    }

    setApprovalForm({
      ...approvalForm,
      semantic_tags: [...approvalForm.semantic_tags, tagInput.trim()]
    })
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setApprovalForm({
      ...approvalForm,
      semantic_tags: approvalForm.semantic_tags.filter(t => t !== tag)
    })
  }

  const updatePlaceholderConfig = (placeholder: string, field: keyof PlaceholderConfig, value: any) => {
    setApprovalForm(prev => ({
      ...prev,
      required_columns: {
        ...prev.required_columns,
        [placeholder]: {
          ...prev.required_columns[placeholder],
          [field]: value
        }
      }
    }))
  }

  const toggleCardExpanded = (id: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCards(newExpanded)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const highlightPlaceholders = (sql: string) => {
    return sql.replace(/\{\{([^}]+)\}\}/g, '<span class="bg-yellow-500/20 text-yellow-300 px-1 rounded">{{$1}}</span>')
  }

  const getPendingCount = () => attempts.filter(a => a.status === 'pending').length
  const getApprovedCount = () => attempts.filter(a => a.status === 'approved').length
  const getRejectedCount = () => attempts.filter(a => a.status === 'rejected').length
  const getApprovalRate = () => {
    const total = attempts.length
    if (total === 0) return 0
    return Math.round((getApprovedCount() / total) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Sistema de Aprendizado
          </h1>
          <p className="text-gray-400 mt-1">
            Revise e aprove SQL customizados para criar novos templates analytics
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openCreateTemplateModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-lg transition-colors"
            title="Criar novo template manualmente"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Novo Template</span>
          </button>
          <a
            href="/KNOWLEDGE_BASE_USER_GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg transition-colors"
            title="Abrir guia completo do usuário"
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden sm:inline">Guia do Usuário</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-400">{getPendingCount()}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500/20" />
          </div>
        </div>

        <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Aprovados</p>
              <p className="text-2xl font-bold text-green-400">{getApprovedCount()}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500/20" />
          </div>
        </div>

        <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Templates Ativos</p>
              <p className="text-2xl font-bold text-blue-400">{templates.length}</p>
            </div>
            <Database className="w-8 h-8 text-blue-500/20" />
          </div>
        </div>

        <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Taxa de Aprovação</p>
              <p className="text-2xl font-bold text-purple-400">{getApprovalRate()}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500/20" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3 animate-shake">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 font-medium">Erro na Operação</p>
            <p className="text-gray-300 text-sm">{error}</p>
            <p className="text-gray-400 text-xs mt-2">
              💡 Dica: Verifique se todos os campos obrigatórios estão preenchidos
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Fechar"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 mb-6">
        <div className="flex items-center gap-2 p-2 border-b border-gray-800 overflow-x-auto">
          <button
            onClick={() => setSelectedTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedTab === 'pending'
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Pendentes ({getPendingCount()})
          </button>
          <button
            onClick={() => setSelectedTab('approved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedTab === 'approved'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Aprovados ({getApprovedCount()})
          </button>
          <button
            onClick={() => setSelectedTab('rejected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedTab === 'rejected'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Rejeitados ({getRejectedCount()})
          </button>
          <button
            onClick={() => setSelectedTab('templates')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedTab === 'templates'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Templates Ativos ({templates.length})
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por pergunta ou SQL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {selectedTab === 'templates' ? (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="text-center py-12 bg-[#1e1e1e] rounded-lg border border-gray-800">
              <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum template analytics encontrado</p>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="bg-[#1e1e1e] rounded-lg border border-gray-800 p-5 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-medium text-lg mb-1">{template.name}</h3>
                    <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {template.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(template.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {template.semantic_tags && template.semantic_tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          {template.semantic_tags.length} tags
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditTemplateModal(template)}
                      className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-blue-400 transition-colors"
                      title="Editar template"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(template.sql_template)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                      title="Copiar SQL"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-colors"
                      title="Deletar template"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#2a2a2a] rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-400 font-medium">SQL Template</span>
                  </div>
                  <pre className="text-sm text-gray-300 overflow-x-auto">
                    <code dangerouslySetInnerHTML={{ __html: highlightPlaceholders(template.sql_template) }} />
                  </pre>
                </div>

                {template.semantic_tags && template.semantic_tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {template.semantic_tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAttempts.length === 0 ? (
            <div className="text-center py-12 bg-[#1e1e1e] rounded-lg border border-gray-800">
              <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {selectedTab === 'pending'
                  ? 'Nenhum SQL customizado pendente de revisão'
                  : 'Nenhum resultado encontrado'
                }
              </p>
            </div>
          ) : (
            filteredAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="bg-[#1e1e1e] rounded-lg border border-gray-800 p-5 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        attempt.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        attempt.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {attempt.status === 'pending' ? 'Pendente' :
                         attempt.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                      {!attempt.execution_success && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          Erro de Execução
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium mb-1">{attempt.user_question}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(attempt.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        {attempt.dataset_columns.length} colunas
                      </span>
                    </div>
                  </div>
                  {attempt.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openApprovalModal(attempt)}
                        className="p-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-green-400 transition-colors"
                        title="Aprovar como template"
                      >
                        <ThumbsUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openRejectModal(attempt)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-colors"
                        title="Rejeitar"
                      >
                        <ThumbsDown className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-[#2a2a2a] rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-400 font-medium">SQL Gerado</span>
                    </div>
                    <button
                      onClick={() => toggleCardExpanded(attempt.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      {expandedCards.has(attempt.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <pre className={`text-sm text-gray-300 overflow-x-auto ${expandedCards.has(attempt.id) ? '' : 'max-h-24 overflow-hidden'}`}>
                    <code>{attempt.generated_sql}</code>
                  </pre>
                </div>

                {expandedCards.has(attempt.id) && attempt.query_results_sample && attempt.query_results_sample.length > 0 && (
                  <div className="mt-3 bg-[#2a2a2a] rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-400 font-medium">
                        Preview dos Resultados ({attempt.query_results_sample.length} linhas)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            {Object.keys(attempt.query_results_sample[0] || {}).map((key) => (
                              <th key={key} className="text-left py-2 px-3 text-gray-400 font-medium">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {attempt.query_results_sample.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-800">
                              {Object.values(row).map((val: any, i) => (
                                <td key={i} className="py-2 px-3 text-gray-300">
                                  {String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {attempt.rejection_reason && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm text-red-400">
                      <strong>Motivo da rejeição:</strong> {attempt.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showApprovalModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 max-w-4xl w-full my-8">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Aprovar como Template Analytics
                </h2>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setActiveModalTab('basic')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeModalTab === 'basic'
                    ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Informações Básicas
              </button>
              <button
                onClick={() => setActiveModalTab('columns')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeModalTab === 'columns'
                    ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Mapeamento de Colunas
                {detectedPlaceholders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                    {detectedPlaceholders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveModalTab('preview')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeModalTab === 'preview'
                    ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Preview
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {activeModalTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome do Template *
                    </label>
                    <input
                      type="text"
                      value={approvalForm.template_name}
                      onChange={(e) => setApprovalForm({ ...approvalForm, template_name: e.target.value })}
                      placeholder="Ex: Análise de Vendas por Região"
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Categoria
                    </label>
                    <input
                      type="text"
                      value={approvalForm.template_category}
                      onChange={(e) => setApprovalForm({ ...approvalForm, template_category: e.target.value })}
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={approvalForm.template_description}
                      onChange={(e) => setApprovalForm({ ...approvalForm, template_description: e.target.value })}
                      rows={3}
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Tags Semânticas * (para detecção automática)
                      </label>
                      <button
                        onClick={() => suggestSemanticTags(selectedAttempt.user_question)}
                        disabled={suggestingTags}
                        className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                      >
                        {suggestingTags ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Sugerindo...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3" />
                            Sugerir com IA
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Ex: vendas, receita, ticket médio..."
                        className="flex-1 bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={addTag}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {approvalForm.semantic_tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-sm"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {approvalForm.semantic_tags.length}/10 tags
                    </p>
                  </div>
                </div>
              )}

              {activeModalTab === 'columns' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-400 font-medium text-sm">Sobre Placeholders</p>
                      <p className="text-gray-300 text-sm mt-1">
                        Placeholders são variáveis no formato {`{{nome}}`} que serão substituídas por colunas reais do dataset.
                        Configure o tipo e descrição de cada placeholder para tornar o template reutilizável.
                      </p>
                      <p className="text-gray-400 text-xs mt-2">
                        💡 <strong>Dica:</strong> O sistema detectou automaticamente os placeholders e sugeriu tipos baseados nos nomes.
                        Revise e ajuste conforme necessário antes de aprovar.
                      </p>
                    </div>
                  </div>

                  {detectedPlaceholders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum placeholder detectado no SQL</p>
                      <p className="text-sm mt-1">Placeholders devem usar o formato {`{{nome}}`}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">
                          Placeholders Detectados ({detectedPlaceholders.length})
                        </h3>
                        <button
                          onClick={() => autoDetectPlaceholders(selectedAttempt.generated_sql, selectedAttempt.dataset_columns)}
                          className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Re-detectar
                        </button>
                      </div>

                      {detectedPlaceholders.map((placeholder) => (
                        <div
                          key={placeholder}
                          className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm font-mono">
                              {`{{${placeholder}}}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Tipo *
                              </label>
                              <select
                                value={approvalForm.required_columns[placeholder]?.type || 'text'}
                                onChange={(e) => updatePlaceholderConfig(placeholder, 'type', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                              >
                                <option value="text">Texto</option>
                                <option value="numeric">Numérico</option>
                                <option value="date">Data</option>
                                <option value="boolean">Booleano</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Valor Padrão (opcional)
                              </label>
                              <input
                                type="text"
                                value={approvalForm.required_columns[placeholder]?.default || ''}
                                onChange={(e) => updatePlaceholderConfig(placeholder, 'default', e.target.value)}
                                placeholder="Ex: 10"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Descrição *
                            </label>
                            <textarea
                              value={approvalForm.required_columns[placeholder]?.description || ''}
                              onChange={(e) => updatePlaceholderConfig(placeholder, 'description', e.target.value)}
                              placeholder="Descreva o que este placeholder representa..."
                              rows={2}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'preview' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-medium">SQL Template</h3>
                      <button
                        onClick={() => copyToClipboard(selectedAttempt.generated_sql)}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </button>
                    </div>
                    <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4">
                      <pre className="text-sm text-gray-300 overflow-x-auto">
                        <code dangerouslySetInnerHTML={{ __html: highlightPlaceholders(selectedAttempt.generated_sql) }} />
                      </pre>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h4 className="text-blue-400 font-medium mb-2">Resumo da Aprovação</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nome:</span>
                        <span className="text-white font-medium">{approvalForm.template_name || '(não definido)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Categoria:</span>
                        <span className="text-white">{approvalForm.template_category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tags Semânticas:</span>
                        <span className="text-white">{approvalForm.semantic_tags.length} tags</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Placeholders:</span>
                        <span className="text-white">{detectedPlaceholders.length} detectados</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Placeholders Configurados:</span>
                        <span className={`font-medium ${
                          Object.keys(approvalForm.required_columns).length === detectedPlaceholders.length
                            ? 'text-green-400'
                            : 'text-yellow-400'
                        }`}>
                          {Object.keys(approvalForm.required_columns).length}/{detectedPlaceholders.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {detectedPlaceholders.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Configuração dos Placeholders</h4>
                      <div className="space-y-2">
                        {detectedPlaceholders.map((placeholder) => {
                          const config = approvalForm.required_columns[placeholder]
                          return (
                            <div
                              key={placeholder}
                              className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-yellow-300 font-mono text-sm">{`{{${placeholder}}}`}</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  config?.type && config?.description
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {config?.type && config?.description ? 'Configurado' : 'Pendente'}
                                </span>
                              </div>
                              {config && (
                                <div className="mt-2 text-sm text-gray-400">
                                  <p><strong>Tipo:</strong> {config.type}</p>
                                  <p><strong>Descrição:</strong> {config.description || '(não definida)'}</p>
                                  {config.default && <p><strong>Padrão:</strong> {config.default}</p>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false)
                  setSelectedAttempt(null)
                }}
                disabled={processing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aprovando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Aprovar Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 max-w-lg w-full">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <XCircle className="w-6 h-6 text-red-500" />
                Rejeitar SQL Customizado
              </h2>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Motivo da Rejeição *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Explique por que este SQL não deve ser aprovado como template..."
                className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedAttempt(null)
                }}
                disabled={processing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejeitando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Rejeitar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditTemplateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 max-w-3xl w-full my-8">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-6 h-6 text-blue-500" />
                  Editar Template
                </h2>
                <button
                  onClick={() => setShowEditTemplateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  value={approvalForm.template_name}
                  onChange={(e) => setApprovalForm({ ...approvalForm, template_name: e.target.value })}
                  className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categoria
                </label>
                <input
                  type="text"
                  value={approvalForm.template_category}
                  onChange={(e) => setApprovalForm({ ...approvalForm, template_category: e.target.value })}
                  className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={approvalForm.template_description}
                  onChange={(e) => setApprovalForm({ ...approvalForm, template_description: e.target.value })}
                  rows={3}
                  className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags Semânticas
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Adicionar tag..."
                    className="flex-1 bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {approvalForm.semantic_tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => setShowEditTemplateModal(false)}
                disabled={processing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditTemplate}
                disabled={processing}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1e1e1e] rounded-lg border border-gray-800 max-w-4xl w-full my-8">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-green-500" />
                  Criar Novo Template Analytics
                </h2>
                <button
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setActiveModalTab('basic')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeModalTab === 'basic'
                    ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Informações Básicas
              </button>
              <button
                onClick={() => setActiveModalTab('columns')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeModalTab === 'columns'
                    ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                SQL & Placeholders
                {detectedPlaceholders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                    {detectedPlaceholders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveModalTab('preview')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeModalTab === 'preview'
                    ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Preview
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {activeModalTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome do Template *
                    </label>
                    <input
                      type="text"
                      value={newTemplateForm.name}
                      onChange={(e) => updateNewTemplateForm('name', e.target.value)}
                      placeholder="Ex: Análise de Conversão por Canal"
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Categoria
                    </label>
                    <select
                      value={newTemplateForm.category}
                      onChange={(e) => updateNewTemplateForm('category', e.target.value)}
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Analytics">Analytics</option>
                      <option value="Vendas">Vendas</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="RH">RH</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Logística">Logística</option>
                      <option value="Operações">Operações</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={newTemplateForm.description}
                      onChange={(e) => updateNewTemplateForm('description', e.target.value)}
                      rows={3}
                      placeholder="Descreva o que este template faz e quando deve ser usado..."
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Tags Semânticas * (para detecção automática)
                      </label>
                      <button
                        onClick={suggestTagsForNewTemplate}
                        disabled={suggestingTags}
                        className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                      >
                        {suggestingTags ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Sugerindo...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3" />
                            Sugerir com IA
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTagToNewTemplate())}
                        placeholder="Ex: conversão, funil, canal..."
                        className="flex-1 bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={addTagToNewTemplate}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newTemplateForm.semantic_tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-sm"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                          <button
                            onClick={() => removeTagFromNewTemplate(tag)}
                            className="ml-1 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {newTemplateForm.semantic_tags.length}/10 tags
                    </p>
                  </div>
                </div>
              )}

              {activeModalTab === 'columns' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SQL Template *
                    </label>
                    <p className="text-gray-400 text-xs mb-2">
                      Use placeholders no formato {`{{nome_placeholder}}`} para variáveis que serão substituídas por colunas do dataset.
                    </p>
                    <textarea
                      value={newTemplateForm.sql_template}
                      onChange={(e) => updateNewTemplateForm('sql_template', e.target.value)}
                      rows={10}
                      placeholder="SELECT {{group_col}} as categoria, AVG({{value_col}}) as media&#10;FROM temp_data&#10;GROUP BY {{group_col}}&#10;ORDER BY media DESC"
                      className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {detectedPlaceholders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum placeholder detectado no SQL</p>
                      <p className="text-sm mt-1">Adicione placeholders usando o formato {`{{nome}}`}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">
                          Placeholders Detectados ({detectedPlaceholders.length})
                        </h3>
                      </div>

                      {detectedPlaceholders.map((placeholder) => (
                        <div
                          key={placeholder}
                          className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm font-mono">
                              {`{{${placeholder}}}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Tipo *
                              </label>
                              <select
                                value={newTemplateForm.required_columns[placeholder]?.type || 'text'}
                                onChange={(e) => updateNewTemplatePlaceholder(placeholder, 'type', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                              >
                                <option value="text">Texto</option>
                                <option value="numeric">Numérico</option>
                                <option value="date">Data</option>
                                <option value="boolean">Booleano</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Valor Padrão (opcional)
                              </label>
                              <input
                                type="text"
                                value={newTemplateForm.required_columns[placeholder]?.default || ''}
                                onChange={(e) => updateNewTemplatePlaceholder(placeholder, 'default', e.target.value)}
                                placeholder="Ex: 10"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Descrição *
                            </label>
                            <textarea
                              value={newTemplateForm.required_columns[placeholder]?.description || ''}
                              onChange={(e) => updateNewTemplatePlaceholder(placeholder, 'description', e.target.value)}
                              placeholder="Descreva o que este placeholder representa..."
                              rows={2}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'preview' && (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h4 className="text-blue-400 font-medium mb-2">Resumo do Template</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nome:</span>
                        <span className="text-white font-medium">{newTemplateForm.name || '(não definido)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Categoria:</span>
                        <span className="text-white">{newTemplateForm.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tags Semânticas:</span>
                        <span className="text-white">{newTemplateForm.semantic_tags.length} tags</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Placeholders:</span>
                        <span className="text-white">{detectedPlaceholders.length} detectados</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Placeholders Configurados:</span>
                        <span className={`font-medium ${
                          Object.keys(newTemplateForm.required_columns).length === detectedPlaceholders.length
                            ? 'text-green-400'
                            : 'text-yellow-400'
                        }`}>
                          {Object.keys(newTemplateForm.required_columns).length}/{detectedPlaceholders.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {newTemplateForm.sql_template && (
                    <div>
                      <h4 className="text-white font-medium mb-3">SQL Template</h4>
                      <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4">
                        <pre className="text-sm text-gray-300 overflow-x-auto">
                          <code dangerouslySetInnerHTML={{ __html: highlightPlaceholders(newTemplateForm.sql_template) }} />
                        </pre>
                      </div>
                    </div>
                  )}

                  {detectedPlaceholders.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Configuração dos Placeholders</h4>
                      <div className="space-y-2">
                        {detectedPlaceholders.map((placeholder) => {
                          const config = newTemplateForm.required_columns[placeholder]
                          return (
                            <div
                              key={placeholder}
                              className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-yellow-300 font-mono text-sm">{`{{${placeholder}}}`}</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  config?.type && config?.description
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {config?.type && config?.description ? 'Configurado' : 'Pendente'}
                                </span>
                              </div>
                              {config && (
                                <div className="mt-2 text-sm text-gray-400">
                                  <p><strong>Tipo:</strong> {config.type}</p>
                                  <p><strong>Descrição:</strong> {config.description || '(não definida)'}</p>
                                  {config.default && <p><strong>Padrão:</strong> {config.default}</p>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false)
                  setNewTemplateForm({
                    name: '',
                    category: 'Analytics',
                    description: '',
                    sql_template: '',
                    semantic_tags: [],
                    required_columns: {}
                  })
                }}
                disabled={processing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={processing}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Criar Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

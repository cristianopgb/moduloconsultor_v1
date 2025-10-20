import React, { useState, useEffect } from 'react'
import { X, Save, Brain, Code, AlertTriangle } from 'lucide-react'

interface AIAgent {
  id: string
  name: string
  description: string
  function_name: string
  prompt: string
  model: string
  provider_id: string
  tools: string[]
  active: boolean
  usage_count: number
  test_input?: string
}

interface AIProvider {
  id: string
  name: string
  type: string
  models: string[]
  active: boolean
}

interface AgentModalProps {
  agent?: AIAgent | null
  providers: AIProvider[]
  onSave: (data: Partial<AIAgent>) => Promise<void>
  onClose: () => void
}

export function AgentModal({ agent, providers, onSave, onClose }: AgentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    function_name: '',
    prompt: '',
    model: 'gpt-4o',
    provider_id: '',
    tools: [] as string[],
    active: true,
    test_input: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const availableTools = [
    'template_generation',
    'variable_detection', 
    'document_processing',
    'file_generation',
    'conversation',
    'knowledge_base',
    'data_analysis',
    'text_formatting'
  ]

  const isEditing = !!agent

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description,
        function_name: agent.function_name,
        prompt: agent.prompt,
        model: agent.model,
        provider_id: agent.provider_id,
        tools: agent.tools,
        active: agent.active,
        test_input: agent.test_input || ''
      })
    } else {
      // Set default provider
      const defaultProvider = providers.find(p => p.active) || providers[0]
      if (defaultProvider) {
        setFormData(prev => ({ 
          ...prev, 
          provider_id: defaultProvider.id,
          model: defaultProvider.models[0] || 'gpt-4o'
        }))
      }
    }
  }, [agent, providers])

  // Atualizar modelo quando provedor muda
  useEffect(() => {
    const selectedProvider = providers.find(p => p.id === formData.provider_id)
    if (selectedProvider && selectedProvider.models.length > 0) {
      // Se o modelo atual não está na lista do provedor, usar o primeiro
      if (!selectedProvider.models.includes(formData.model)) {
        setFormData(prev => ({ ...prev, model: selectedProvider.models[0] }))
      }
    }
  }, [formData.provider_id, providers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (!formData.function_name.trim()) {
      setError('Nome da função é obrigatório')
      return
    }

    if (!formData.prompt.trim()) {
      setError('Prompt é obrigatório')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        function_name: formData.function_name.trim(),
        prompt: formData.prompt.trim(),
        test_input: formData.test_input.trim()
      })
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar agente')
    } finally {
      setLoading(false)
    }
  }

  const toggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter(t => t !== tool)
        : [...prev.tools, tool]
    }))
  }

  const selectedProvider = providers.find(p => p.id === formData.provider_id)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isEditing ? 'Editar Agente' : 'Novo Agente IA'}
              </h2>
              <p className="text-gray-400 text-sm">Configure comportamento e funcionalidades</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome do Agente *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Template Creator"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o que este agente faz"
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome da Função *
                  </label>
                  <input
                    type="text"
                    value={formData.function_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, function_name: e.target.value }))}
                    placeholder="template-creator"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 font-mono"
                    required
                  />
                  <p className="text-gray-500 text-xs mt-1">Nome da Edge Function no Supabase</p>
                </div>

                {/* Provider and Model */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Provedor
                    </label>
                    <select
                      value={formData.provider_id}
                      onChange={(e) => {
                        const provider = providers.find(p => p.id === e.target.value)
                        setFormData(prev => ({ 
                          ...prev, 
                          provider_id: e.target.value,
                          model: provider?.models[0] || prev.model
                        }))
                      }}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="">Selecione um provedor...</option>
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name} ({provider.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Modelo
                    </label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                      disabled={!selectedProvider || selectedProvider.models.length === 0}
                    >
                      {!selectedProvider ? (
                        <option value="">Selecione um provedor primeiro</option>
                      ) : selectedProvider.models.length === 0 ? (
                        <option value="">Nenhum modelo disponível</option>
                      ) : (
                        selectedProvider?.models.map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                        ))
                      )}
                    </select>
                    {selectedProvider && (
                      <p className="text-gray-500 text-xs mt-1">
                        {selectedProvider.models.length} modelo(s) disponível(is)
                      </p>
                    )}
                  </div>
                </div>

                {/* Tools */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Ferramentas Disponíveis
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTools.map((tool) => (
                      <label
                        key={tool}
                        className="flex items-center gap-2 p-3 bg-gray-900/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.tools.includes(tool)}
                          onChange={() => toggleTool(tool)}
                          className="w-4 h-4 text-purple-600 bg-gray-900 border-gray-700 rounded"
                        />
                        <span className="text-gray-300 text-sm">{tool.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prompt do Sistema *
                  </label>
                  <textarea
                    value={formData.prompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Você é um assistente especializado em..."
                    rows={12}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 resize-none font-mono text-sm"
                    required
                  />
                  <p className="text-gray-500 text-xs mt-1">Define o comportamento e personalidade do agente</p>
                </div>

                {/* Test Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Entrada de Teste
                  </label>
                  <input
                    type="text"
                    value={formData.test_input}
                    onChange={(e) => setFormData(prev => ({ ...prev, test_input: e.target.value }))}
                    placeholder="Ex: crie um modelo de contrato"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
                  />
                  <p className="text-gray-500 text-xs mt-1">Usado para testar o agente</p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Ativar Agente</h4>
                    <p className="text-gray-400 text-sm">Disponibilizar para uso no sistema</p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                      className="w-4 h-4 text-green-600 bg-gray-900 border-gray-700 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
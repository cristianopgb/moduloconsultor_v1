import React, { useState, useEffect } from 'react'
import { X, Save, Eye, EyeOff, Globe, AlertTriangle } from 'lucide-react'

interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'local'
  api_key: string
  models: string[]
  active: boolean
  status: 'connected' | 'error' | 'testing'
}

interface ProviderModalProps {
  provider?: AIProvider | null
  onSave: (data: Partial<AIProvider>) => Promise<void>
  onClose: () => void
}

export function ProviderModal({ provider, onSave, onClose }: ProviderModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'openai' as const,
    api_key: '',
    models: [] as string[],
    active: true
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const providerTypes = [
    { 
      value: 'openai', 
      label: 'OpenAI', 
      icon: '🤖', 
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      placeholder: 'sk-proj-...'
    },
    { 
      value: 'anthropic', 
      label: 'Anthropic', 
      icon: '🧠', 
      models: ['claude-3-5-sonnet', 'claude-3-haiku'],
      placeholder: 'sk-ant-...'
    },
    { 
      value: 'google', 
      label: 'Google AI', 
      icon: '🔍', 
      models: ['gemini-pro', 'gemini-pro-vision'],
      placeholder: 'AIza...'
    },
    { 
      value: 'local', 
      label: 'Local/Custom', 
      icon: '🏠', 
      models: ['llama-2', 'custom-model'],
      placeholder: 'http://localhost:8000'
    }
  ]

  const isEditing = !!provider

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name,
        type: provider.type,
        api_key: provider.api_key,
        models: provider.models,
        active: provider.active
      })
    }
  }, [provider])

  const selectedProviderType = providerTypes.find(pt => pt.value === formData.type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }


    setLoading(true)
    setError('')

    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        api_key: formData.api_key.trim(),
        models: formData.models.length > 0 ? formData.models : selectedProviderType?.models || []
      })
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar provedor')
    } finally {
      setLoading(false)
    }
  }

  const toggleModel = (model: string) => {
    setFormData(prev => ({
      ...prev,
      models: prev.models.includes(model)
        ? prev.models.filter(m => m !== model)
        : [...prev.models, model]
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isEditing ? 'Editar Provedor' : 'Novo Provedor de IA'}
              </h2>
              <p className="text-gray-400 text-sm">Configure conexão com provedor de IA</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Provider Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Tipo de Provedor
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {providerTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    type: type.value as any,
                    models: type.models 
                  }))}
                  className={`p-3 border rounded-xl transition-all ${
                    formData.type === type.value
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <h3 className="text-white font-medium text-sm">{type.label}</h3>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome do Provedor *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={`${selectedProviderType?.label} Principal`}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {formData.type === 'local' ? 'URL do Endpoint' : 'API Key'} *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder={selectedProviderType?.placeholder}
                className="w-full px-4 py-3 pr-12 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
                required={formData.type !== 'local'}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Models */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Modelos Disponíveis
            </label>
            <div className="grid grid-cols-2 gap-2">
              {selectedProviderType?.models.map((model) => (
                <label
                  key={model}
                  className="flex items-center gap-2 p-3 bg-gray-900/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800/50"
                >
                  <input
                    type="checkbox"
                    checked={formData.models.includes(model)}
                    onChange={() => toggleModel(model)}
                    className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded"
                  />
                  <span className="text-gray-300 text-sm">{model}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Ativar Provedor</h4>
              <p className="text-gray-400 text-sm">Disponibilizar para uso nos agentes</p>
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
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
  )
}
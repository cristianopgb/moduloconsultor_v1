import React, { useState, useEffect } from 'react'
import {
  Brain, Plus, Settings, Globe, Key, Zap, Users, 
  CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Edit, Trash2, Play, Pause, Eye, EyeOff, TestTube,
  Activity, BarChart3, Clock, Download, Upload
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProviderModal } from './ProviderModal'
import { AgentModal } from './AgentModal'

interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'local'
  api_key: string
  models: string[]
  active: boolean
  status: 'connected' | 'error' | 'testing'
  created_at: string
  updated_at: string
}

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
  created_at: string
  updated_at: string
}

export function AIIntegrationsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('agents')
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null)
  const [testingAgent, setTestingAgent] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, any>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tabs = [
    { id: 'agents', label: 'Agentes IA', icon: Brain, count: agents.length },
    { id: 'providers', label: 'Provedores', icon: Globe, count: providers.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, count: 0 }
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [providersResult, agentsResult] = await Promise.all([
        supabase.from('ai_providers').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_agents').select('*').order('created_at', { ascending: false })
      ])

      if (providersResult.error) throw providersResult.error
      if (agentsResult.error) throw agentsResult.error

      setProviders(providersResult.data || [])
      setAgents(agentsResult.data || [])
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveProvider = async (providerData: Partial<AIProvider>) => {
    try {
      if (editingProvider) {
        const { data, error } = await supabase
          .from('ai_providers')
          .update(providerData)
          .eq('id', editingProvider.id)
          .select()

        if (error) throw error
        if (data && data[0]) {
          setProviders(prev => prev.map(p => p.id === editingProvider.id ? data[0] : p))
        }
      } else {
        const { data, error } = await supabase
          .from('ai_providers')
          .insert([providerData])
          .select()

        if (error) throw error
        if (data && data[0]) {
          setProviders(prev => [data[0], ...prev])
        }
      }

      setShowProviderModal(false)
      setEditingProvider(null)
      setSuccess('Provedor salvo com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao salvar provedor')
    }
  }

  const saveAgent = async (agentData: Partial<AIAgent>) => {
    try {
      if (editingAgent) {
        const { data, error } = await supabase
          .from('ai_agents')
          .update(agentData)
          .eq('id', editingAgent.id)
          .select()

        if (error) throw error
        if (data && data[0]) {
          setAgents(prev => prev.map(a => a.id === editingAgent.id ? data[0] : a))
        }
      } else {
        const { data, error } = await supabase
          .from('ai_agents')
          .insert([agentData])
          .select()

        if (error) throw error
        if (data && data[0]) {
          setAgents(prev => [data[0], ...prev])
        }
      }

      setShowAgentModal(false)
      setEditingAgent(null)
      setSuccess('Agente salvo com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao salvar agente')
    }
  }

  const deleteProvider = async (providerId: string) => {
    if (!confirm('Tem certeza que deseja excluir este provedor?')) return

    try {
      const { error } = await supabase
        .from('ai_providers')
        .delete()
        .eq('id', providerId)

      if (error) throw error

      setProviders(prev => prev.filter(p => p.id !== providerId))
      setSuccess('Provedor excluído com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return

    try {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agentId)

      if (error) throw error

      setAgents(prev => prev.filter(a => a.id !== agentId))
      setSuccess('Agente excluído com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const toggleProvider = async (providerId: string) => {
    try {
      const provider = providers.find(p => p.id === providerId)
      if (!provider) return

      const { data, error } = await supabase
        .from('ai_providers')
        .update({ active: !provider.active })
        .eq('id', providerId)
        .select()

      if (error) throw error
      if (data && data[0]) {
        setProviders(prev => prev.map(p => p.id === providerId ? data[0] : p))
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const toggleAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) return

      const { data, error } = await supabase
        .from('ai_agents')
        .update({ active: !agent.active })
        .eq('id', agentId)
        .select()

      if (error) throw error
      if (data && data[0]) {
        setAgents(prev => prev.map(a => a.id === agentId ? data[0] : a))
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const testProvider = async (providerId: string) => {
    try {
      const provider = providers.find(p => p.id === providerId)
      if (!provider) return

      setProviders(prev => prev.map(p => 
        p.id === providerId ? { ...p, status: 'testing' } : p
      ))

      // Simular teste de conexão
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const success = Math.random() > 0.3 // 70% chance de sucesso
      
      const { data, error } = await supabase
        .from('ai_providers')
        .update({ status: success ? 'connected' : 'error' })
        .eq('id', providerId)
        .select()

      if (error) throw error
      if (data && data[0]) {
        setProviders(prev => prev.map(p => p.id === providerId ? data[0] : p))
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const testAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) return

      setTestingAgent(agentId)
      setError('')

      // Obter token da sessão autenticada
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('Usuário não autenticado. Faça login novamente.')
      }

      const testInput = agent.test_input || 'teste básico'
      
      // Chamar a Edge Function correspondente via helper
      const { data: result, error: fnErr } = await (await import('../../lib/functionsClient')).callEdgeFunction(agent.function_name, {
        message: testInput,
        instruction: testInput,
        text: testInput,
        user_request: testInput
      });

      if (fnErr) throw fnErr;
      
      setTestResults(prev => ({
        ...prev,
        [agentId]: {
          success: response.ok,
          response: result,
          timestamp: new Date().toISOString()
        }
      }))

      // Incrementar contador de uso
      await supabase
        .from('ai_agents')
        .update({ usage_count: agent.usage_count + 1 })
        .eq('id', agentId)

      setAgents(prev => prev.map(a => 
        a.id === agentId ? { ...a, usage_count: a.usage_count + 1 } : a
      ))

    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [agentId]: {
          success: false,
          error: err.message,
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setTestingAgent(null)
    }
  }

  const exportConfiguration = () => {
    const config = {
      providers: providers.map(p => ({
        ...p,
        api_key: p.api_key ? '[REDACTED]' : null
      })),
      agents: agents,
      exported_at: new Date().toISOString(),
      version: '2.0.0'
    }

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai_config_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getProviderStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'testing':
        return <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />
    }
  }

  const getProviderStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-400 bg-green-900/20 border-green-500/30'
      case 'error':
        return 'text-red-400 bg-red-900/20 border-red-500/30'
      case 'testing':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-500/30'
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
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
          <h1 className="text-2xl font-bold text-white mb-2">Integrações IA</h1>
          <p className="text-gray-400">Gerencie provedores de IA e agentes inteligentes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={exportConfiguration}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Config
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{agents.filter(a => a.active).length}</p>
            <p className="text-sm text-gray-400 mb-2">Agentes Ativos</p>
            <p className="text-xs text-gray-500">{agents.length} total</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <Globe className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{providers.filter(p => p.status === 'connected').length}</p>
            <p className="text-sm text-gray-400 mb-2">Provedores Conectados</p>
            <p className="text-xs text-gray-500">{providers.length} total</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">
              {agents.reduce((sum, a) => sum + a.usage_count, 0)}
            </p>
            <p className="text-sm text-gray-400 mb-2">Total de Execuções</p>
            <p className="text-xs text-gray-500">Todos os agentes</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">
              {providers.filter(p => p.active).reduce((sum, p) => sum + p.models.length, 0)}
            </p>
            <p className="text-sm text-gray-400 mb-2">Modelos Disponíveis</p>
            <p className="text-xs text-gray-500">Provedores ativos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        {activeTab === 'agents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Agentes IA ({agents.length})</h2>
              <button
                onClick={() => setShowAgentModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Agente
              </button>
            </div>
            
            <div className="space-y-3">
              {agents.map((agent) => {
                const testResult = testResults[agent.id]
                const provider = providers.find(p => p.id === agent.provider_id)
                
                return (
                  <div key={agent.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleAgent(agent.id)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            agent.active ? 'bg-green-600' : 'bg-gray-600'
                          }`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                            agent.active ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </button>
                        <div className={`p-2 rounded-lg ${agent.active ? 'bg-purple-600' : 'bg-gray-600'}`}>
                          <Brain className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{agent.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full border ${
                            agent.active 
                              ? 'bg-green-900/20 border-green-500/30 text-green-400'
                              : 'bg-gray-900/20 border-gray-500/30 text-gray-400'
                          }`}>
                            {agent.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="px-2 py-1 bg-blue-900/20 border border-blue-500/30 text-blue-400 text-xs rounded-full">
                            {agent.function_name}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{agent.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Modelo: {agent.model}</span>
                          <span>Provedor: {provider?.name || 'Não definido'}</span>
                          <span>Execuções: {agent.usage_count}</span>
                          <span>Ferramentas: {agent.tools.length}</span>
                        </div>
                        
                        {/* Test Result */}
                        {testResult && (
                          <div className={`mt-3 p-3 rounded-lg border text-sm ${
                            testResult.success 
                              ? 'bg-green-900/20 border-green-500/30 text-green-400'
                              : 'bg-red-900/20 border-red-500/30 text-red-400'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              {testResult.success ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              <span className="font-medium">
                                {testResult.success ? 'Teste bem-sucedido' : 'Teste falhou'}
                              </span>
                              <span className="text-xs opacity-75">
                                {formatTime(testResult.timestamp)}
                              </span>
                            </div>
                            {testResult.error && (
                              <p className="text-xs opacity-90">Erro: {testResult.error}</p>
                            )}
                            {testResult.response && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs opacity-75">Ver resposta</summary>
                                <pre className="mt-1 text-xs bg-gray-800/50 p-2 rounded overflow-auto max-h-32">
                                  {JSON.stringify(testResult.response, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => testAgent(agent.id)}
                          disabled={testingAgent === agent.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                        >
                          {testingAgent === agent.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <TestTube className="w-3 h-3" />
                          )}
                          {testingAgent === agent.id ? 'Testando...' : 'Testar'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAgent(agent)
                            setShowAgentModal(true)
                          }}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteAgent(agent.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Provedores de IA ({providers.length})</h2>
              <button
                onClick={() => setShowProviderModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Provedor
              </button>
            </div>
            
            <div className="space-y-3">
              {providers.map((provider) => (
                <div key={provider.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleProvider(provider.id)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          provider.active ? 'bg-green-600' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          provider.active ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                      <div className={`p-2 rounded-lg ${provider.active ? 'bg-blue-600' : 'bg-gray-600'}`}>
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{provider.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full border ${getProviderStatusColor(provider.status)}`}>
                          {provider.status === 'connected' ? 'Conectado' :
                           provider.status === 'error' ? 'Erro' : 'Testando'}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full capitalize">
                          {provider.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                        <span>Modelos: {provider.models.length}</span>
                        <span>API Key: {provider.api_key ? '••••••••' : 'Não configurada'}</span>
                        <span>Criado: {formatTime(provider.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {provider.models.slice(0, 3).map((model, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                            {model}
                          </span>
                        ))}
                        {provider.models.length > 3 && (
                          <span className="px-2 py-1 bg-gray-600 text-gray-400 text-xs rounded">
                            +{provider.models.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testProvider(provider.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        {getProviderStatusIcon(provider.status)}
                        Testar
                      </button>
                      <button
                        onClick={() => {
                          setEditingProvider(provider)
                          setShowProviderModal(true)
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProvider(provider.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Analytics de IA</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Usage by Agent */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4">Uso por Agente</h3>
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${agent.active ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                        <span className="text-gray-300 text-sm">{agent.name}</span>
                      </div>
                      <span className="text-white font-medium">{agent.usage_count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provider Status */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4">Status dos Provedores</h3>
                <div className="space-y-3">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getProviderStatusIcon(provider.status)}
                        <span className="text-gray-300 text-sm">{provider.name}</span>
                      </div>
                      <span className="text-gray-400 text-xs capitalize">{provider.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showProviderModal && (
        <ProviderModal
          provider={editingProvider}
          onSave={saveProvider}
          onClose={() => {
            setShowProviderModal(false)
            setEditingProvider(null)
          }}
        />
      )}

      {showAgentModal && (
        <AgentModal
          agent={editingAgent}
          providers={providers.filter(p => p.active)}
          onSave={saveAgent}
          onClose={() => {
            setShowAgentModal(false)
            setEditingAgent(null)
          }}
        />
      )}
    </div>
  )
}
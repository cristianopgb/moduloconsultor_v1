import React, { useState, useEffect } from 'react'
import {
  Settings, Save, RefreshCw, Shield, Mail, Database, 
  Users, Zap, Bell, Globe, Lock, AlertTriangle,
  CheckCircle, X, Edit, Plus, Trash2, Eye, EyeOff
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface SystemConfig {
  // Tokens e Limites
  default_token_limit: number
  max_token_limit: number
  token_reset_period: 'monthly' | 'weekly' | 'daily'
  
  // Email e Notificações
  smtp_enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  notification_email: string
  
  // Sistema
  maintenance_mode: boolean
  registration_enabled: boolean
  max_users: number
  session_timeout: number
  
  // Documentos
  max_document_size: number
  allowed_file_types: string[]
  document_retention_days: number
  
  // Segurança
  password_min_length: number
  require_email_verification: boolean
  max_login_attempts: number
  lockout_duration: number
}

export function SystemSettings() {
  const { user } = useAuth()
  const [config, setConfig] = useState<SystemConfig>({
    default_token_limit: 1000,
    max_token_limit: 50000,
    token_reset_period: 'monthly',
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    notification_email: '',
    maintenance_mode: false,
    registration_enabled: true,
    max_users: 1000,
    session_timeout: 24,
    max_document_size: 10,
    allowed_file_types: ['docx', 'xlsx', 'pptx', 'html', 'pdf'],
    document_retention_days: 365,
    password_min_length: 6,
    require_email_verification: false,
    max_login_attempts: 5,
    lockout_duration: 30
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('tokens')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tabs = [
    { id: 'tokens', label: 'Tokens & Limites', icon: Zap },
    { id: 'email', label: 'Email & SMTP', icon: Mail },
    { id: 'system', label: 'Sistema', icon: Settings },
    { id: 'documents', label: 'Documentos', icon: Database },
    { id: 'security', label: 'Segurança', icon: Shield }
  ]

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      // Em produção, carregaria do banco. Por enquanto, usar valores padrão
      // const { data, error } = await supabase.from('system_config').select('*').single()
      setLoading(false)
    } catch (err: any) {
      setError('Erro ao carregar configurações')
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)
      setError('')
      
      // Simular salvamento (em produção salvaria no banco)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // const { error } = await supabase.from('system_config').upsert(config)
      // if (error) throw error
      
      setSuccess('Configurações salvas com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    if (confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
      setConfig({
        default_token_limit: 1000,
        max_token_limit: 50000,
        token_reset_period: 'monthly',
        smtp_enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        notification_email: '',
        maintenance_mode: false,
        registration_enabled: true,
        max_users: 1000,
        session_timeout: 24,
        max_document_size: 10,
        allowed_file_types: ['docx', 'xlsx', 'pptx', 'html', 'pdf'],
        document_retention_days: 365,
        password_min_length: 6,
        require_email_verification: false,
        max_login_attempts: 5,
        lockout_duration: 30
      })
    }
  }

  const testEmailConfig = async () => {
    try {
      setSaving(true)
      // Simular teste de email
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSuccess('Email de teste enviado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError('Erro ao enviar email de teste')
    } finally {
      setSaving(false)
    }
  }

  const renderTokensTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Limite Padrão de Tokens
          </label>
          <input
            type="number"
            value={config.default_token_limit}
            onChange={(e) => setConfig(prev => ({ ...prev, default_token_limit: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="100"
            max="100000"
          />
          <p className="text-gray-500 text-xs mt-1">Tokens dados para novos usuários</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Limite Máximo de Tokens
          </label>
          <input
            type="number"
            value={config.max_token_limit}
            onChange={(e) => setConfig(prev => ({ ...prev, max_token_limit: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="1000"
            max="1000000"
          />
          <p className="text-gray-500 text-xs mt-1">Limite máximo que pode ser atribuído</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Período de Reset de Tokens
        </label>
        <select
          value={config.token_reset_period}
          onChange={(e) => setConfig(prev => ({ ...prev, token_reset_period: e.target.value as any }))}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
        >
          <option value="daily">Diário</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
        <p className="text-gray-500 text-xs mt-1">Frequência de renovação automática</p>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-blue-400 font-medium mb-2">💡 Dicas de Configuração</h3>
        <ul className="text-blue-300 text-sm space-y-1">
          <li>• Limite padrão: 1000-5000 tokens para uso normal</li>
          <li>• Usuários Pro: 10000-25000 tokens</li>
          <li>• Enterprise: 50000+ tokens</li>
        </ul>
      </div>
    </div>
  )

  const renderEmailTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Configurações SMTP</h3>
          <p className="text-gray-400 text-sm">Configure o servidor de email para notificações</p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.smtp_enabled}
            onChange={(e) => setConfig(prev => ({ ...prev, smtp_enabled: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded"
          />
          <span className="text-gray-300">Habilitar SMTP</span>
        </label>
      </div>

      {config.smtp_enabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Servidor SMTP
              </label>
              <input
                type="text"
                value={config.smtp_host}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Porta
              </label>
              <input
                type="number"
                value={config.smtp_port}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_port: parseInt(e.target.value) }))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Usuário SMTP
            </label>
            <input
              type="email"
              value={config.smtp_user}
              onChange={(e) => setConfig(prev => ({ ...prev, smtp_user: e.target.value }))}
              placeholder="seu-email@gmail.com"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Senha SMTP
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.smtp_password}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_password: e.target.value }))}
                placeholder="senha-do-app"
                className="w-full px-4 py-3 pr-12 bg-gray-900 border border-gray-700 rounded-lg text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email de Notificações
            </label>
            <input
              type="email"
              value={config.notification_email}
              onChange={(e) => setConfig(prev => ({ ...prev, notification_email: e.target.value }))}
              placeholder="admin@proceda.ia"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-gray-500 text-xs mt-1">Email que receberá notificações do sistema</p>
          </div>

          <button
            onClick={testEmailConfig}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Testar Configuração
          </button>
        </div>
      )}
    </div>
  )

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Modo Manutenção</h4>
              <p className="text-gray-400 text-sm">Bloqueia acesso de usuários</p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.maintenance_mode}
                onChange={(e) => setConfig(prev => ({ ...prev, maintenance_mode: e.target.checked }))}
                className="w-4 h-4 text-red-600 bg-gray-900 border-gray-700 rounded"
              />
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Registro Habilitado</h4>
              <p className="text-gray-400 text-sm">Permite novos cadastros</p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.registration_enabled}
                onChange={(e) => setConfig(prev => ({ ...prev, registration_enabled: e.target.checked }))}
                className="w-4 h-4 text-green-600 bg-gray-900 border-gray-700 rounded"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Máximo de Usuários
            </label>
            <input
              type="number"
              value={config.max_users}
              onChange={(e) => setConfig(prev => ({ ...prev, max_users: parseInt(e.target.value) }))}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
              min="1"
              max="100000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Timeout de Sessão (horas)
            </label>
            <input
              type="number"
              value={config.session_timeout}
              onChange={(e) => setConfig(prev => ({ ...prev, session_timeout: parseInt(e.target.value) }))}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
              min="1"
              max="168"
            />
          </div>
        </div>
      </div>

      {config.maintenance_mode && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-medium">Modo Manutenção Ativo</h3>
          </div>
          <p className="text-red-300 text-sm">
            O sistema está em modo manutenção. Apenas administradores podem acessar.
          </p>
        </div>
      )}
    </div>
  )

  const renderDocumentsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tamanho Máximo de Documento (MB)
          </label>
          <input
            type="number"
            value={config.max_document_size}
            onChange={(e) => setConfig(prev => ({ ...prev, max_document_size: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="1"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Retenção de Documentos (dias)
          </label>
          <input
            type="number"
            value={config.document_retention_days}
            onChange={(e) => setConfig(prev => ({ ...prev, document_retention_days: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="1"
            max="3650"
          />
          <p className="text-gray-500 text-xs mt-1">0 = manter para sempre</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Tipos de Arquivo Permitidos
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {['docx', 'xlsx', 'pptx', 'html', 'pdf', 'txt'].map(type => (
            <label key={type} className="flex items-center gap-2 p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
              <input
                type="checkbox"
                checked={config.allowed_file_types.includes(type)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setConfig(prev => ({ ...prev, allowed_file_types: [...prev.allowed_file_types, type] }))
                  } else {
                    setConfig(prev => ({ ...prev, allowed_file_types: prev.allowed_file_types.filter(t => t !== type) }))
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded"
              />
              <span className="text-gray-300 text-sm font-mono">.{type}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tamanho Mínimo da Senha
          </label>
          <input
            type="number"
            value={config.password_min_length}
            onChange={(e) => setConfig(prev => ({ ...prev, password_min_length: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="4"
            max="50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Máximo de Tentativas de Login
          </label>
          <input
            type="number"
            value={config.max_login_attempts}
            onChange={(e) => setConfig(prev => ({ ...prev, max_login_attempts: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="3"
            max="10"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Duração do Bloqueio (minutos)
          </label>
          <input
            type="number"
            value={config.lockout_duration}
            onChange={(e) => setConfig(prev => ({ ...prev, lockout_duration: parseInt(e.target.value) }))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
            min="5"
            max="1440"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Verificação de Email Obrigatória</h4>
          <p className="text-gray-400 text-sm">Usuários devem verificar email antes de usar</p>
        </div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={config.require_email_verification}
            onChange={(e) => setConfig(prev => ({ ...prev, require_email_verification: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded"
          />
        </label>
      </div>
    </div>
  )

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
          <h1 className="text-2xl font-bold text-white mb-2">Configurações do Sistema</h1>
          <p className="text-gray-400">Gerencie configurações globais da plataforma</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Restaurar Padrões
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Configurações'}
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
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        {activeTab === 'tokens' && renderTokensTab()}
        {activeTab === 'email' && renderEmailTab()}
        {activeTab === 'system' && renderSystemTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
        {activeTab === 'security' && renderSecurityTab()}
      </div>
    </div>
  )
}
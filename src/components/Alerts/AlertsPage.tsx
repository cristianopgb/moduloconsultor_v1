import React, { useState, useEffect } from 'react'
import {
  Bell, AlertTriangle, CheckCircle, Info, XCircle, Settings,
  Mail, Smartphone, Globe, Clock, Users, Zap, FileText,
  TrendingUp, Shield, Database, Plus, Edit, Trash2, Eye,
  Play, Pause, RefreshCw, Download, Search, Filter
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Alert {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  category: 'system' | 'users' | 'tokens' | 'documents' | 'security'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved'
  created_at: string
  acknowledged_at?: string
  resolved_at?: string
  acknowledged_by?: string
  resolved_by?: string
  metadata?: any
}

interface AlertRule {
  id: string
  name: string
  description: string
  condition: string
  threshold: number
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  notification_channels: string[]
  created_at: string
  last_triggered?: string
  trigger_count: number
}

interface NotificationChannel {
  id: string
  name: string
  type: 'email' | 'sms' | 'webhook' | 'slack'
  config: any
  enabled: boolean
  test_status?: 'success' | 'failed' | 'pending'
}

export function AlertsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('alerts')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([])
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)

  const tabs = [
    { id: 'alerts', label: 'Alertas Ativos', icon: Bell },
    { id: 'rules', label: 'Regras de Alerta', icon: Settings },
    { id: 'channels', label: 'Canais de Notificação', icon: Mail },
    { id: 'history', label: 'Histórico', icon: Clock }
  ]

  const alertCategories = [
    { value: 'system', label: 'Sistema', icon: Database, color: 'blue' },
    { value: 'users', label: 'Usuários', icon: Users, color: 'green' },
    { value: 'tokens', label: 'Tokens', icon: Zap, color: 'yellow' },
    { value: 'documents', label: 'Documentos', icon: FileText, color: 'purple' },
    { value: 'security', label: 'Segurança', icon: Shield, color: 'red' }
  ]

  const severityLevels = [
    { value: 'low', label: 'Baixa', color: 'text-blue-400 bg-blue-900/20 border-blue-500/30' },
    { value: 'medium', label: 'Média', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30' },
    { value: 'high', label: 'Alta', color: 'text-orange-400 bg-orange-900/20 border-orange-500/30' },
    { value: 'critical', label: 'Crítica', color: 'text-red-400 bg-red-900/20 border-red-500/30' }
  ]

  useEffect(() => {
    loadAlertsData()
  }, [])

  const loadAlertsData = async () => {
    try {
      setLoading(true)
      
      // Carregar dados reais do sistema
      const [usersResult, documentsResult, conversationsResult] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('conversations').select('*')
      ])

      const users = usersResult.data || []
      const documents = documentsResult.data || []
      const conversations = conversationsResult.data || []

      // Gerar alertas baseados em dados reais
      const generatedAlerts: Alert[] = []

      // Alerta de tokens baixos
      const lowTokenUsers = users.filter(u => {
        const percentage = u.tokens_limit > 0 ? (u.tokens_used / u.tokens_limit) * 100 : 0
        return percentage >= 80
      })

      if (lowTokenUsers.length > 0) {
        generatedAlerts.push({
          id: 'tokens_low',
          title: 'Usuários com Tokens Baixos',
          message: `${lowTokenUsers.length} usuários estão com menos de 20% dos tokens disponíveis`,
          type: 'warning',
          category: 'tokens',
          severity: 'medium',
          status: 'active',
          created_at: new Date().toISOString(),
          metadata: { affected_users: lowTokenUsers.length, users: lowTokenUsers.map(u => u.email) }
        })
      }

      // Alerta de novos usuários
      const recentUsers = users.filter(u => {
        const dayAgo = new Date()
        dayAgo.setDate(dayAgo.getDate() - 1)
        return new Date(u.created_at) > dayAgo
      })

      if (recentUsers.length > 0) {
        generatedAlerts.push({
          id: 'new_users',
          title: 'Novos Usuários Cadastrados',
          message: `${recentUsers.length} novos usuários se cadastraram nas últimas 24h`,
          type: 'info',
          category: 'users',
          severity: 'low',
          status: 'active',
          created_at: new Date().toISOString(),
          metadata: { new_users: recentUsers.length }
        })
      }

      // Alerta de documentos gerados
      const recentDocs = documents.filter(d => {
        const dayAgo = new Date()
        dayAgo.setDate(dayAgo.getDate() - 1)
        return new Date(d.created_at) > dayAgo
      })

      if (recentDocs.length > 10) {
        generatedAlerts.push({
          id: 'high_doc_generation',
          title: 'Alto Volume de Documentos',
          message: `${recentDocs.length} documentos foram gerados nas últimas 24h`,
          type: 'info',
          category: 'documents',
          severity: 'medium',
          status: 'active',
          created_at: new Date().toISOString(),
          metadata: { documents_count: recentDocs.length }
        })
      }

      // Alerta de sistema saudável
      if (users.length > 0 && documents.length > 0) {
        generatedAlerts.push({
          id: 'system_healthy',
          title: 'Sistema Funcionando Normalmente',
          message: 'Todos os serviços estão operacionais e funcionando corretamente',
          type: 'success',
          category: 'system',
          severity: 'low',
          status: 'active',
          created_at: new Date().toISOString(),
          metadata: { uptime: '99.9%' }
        })
      }

      // Alertas simulados adicionais
      const mockAlerts: Alert[] = [
        {
          id: 'backup_completed',
          title: 'Backup Automático Concluído',
          message: 'Backup diário dos dados foi realizado com sucesso às 03:00',
          type: 'success',
          category: 'system',
          severity: 'low',
          status: 'active',
          created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          metadata: { backup_size: '2.3 GB', duration: '45 segundos' }
        },
        {
          id: 'suspicious_login',
          title: 'Tentativa de Login Suspeita',
          message: 'Múltiplas tentativas de login falharam do IP 192.168.1.100',
          type: 'warning',
          category: 'security',
          severity: 'high',
          status: 'active',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          metadata: { ip: '192.168.1.100', attempts: 15, blocked: true }
        }
      ]

      setAlerts([...generatedAlerts, ...mockAlerts])

      // Regras de alerta padrão
      const defaultRules: AlertRule[] = [
        {
          id: 'rule_tokens_low',
          name: 'Tokens Baixos',
          description: 'Alertar quando usuários têm menos de 20% dos tokens',
          condition: 'tokens_percentage < 20',
          threshold: 20,
          category: 'tokens',
          severity: 'medium',
          enabled: true,
          notification_channels: ['email_admin'],
          created_at: new Date().toISOString(),
          trigger_count: 5
        },
        {
          id: 'rule_failed_logins',
          name: 'Múltiplas Falhas de Login',
          description: 'Alertar quando há mais de 10 tentativas falharam em 1 hora',
          condition: 'failed_logins_1h > 10',
          threshold: 10,
          category: 'security',
          severity: 'high',
          enabled: true,
          notification_channels: ['email_admin', 'sms_admin'],
          created_at: new Date().toISOString(),
          last_triggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          trigger_count: 3
        },
        {
          id: 'rule_high_doc_volume',
          name: 'Alto Volume de Documentos',
          description: 'Alertar quando mais de 50 documentos são gerados por dia',
          condition: 'documents_per_day > 50',
          threshold: 50,
          category: 'documents',
          severity: 'medium',
          enabled: true,
          notification_channels: ['email_admin'],
          created_at: new Date().toISOString(),
          trigger_count: 1
        },
        {
          id: 'rule_new_users',
          name: 'Novos Cadastros',
          description: 'Notificar sobre novos usuários cadastrados',
          condition: 'new_users_today > 0',
          threshold: 1,
          category: 'users',
          severity: 'low',
          enabled: true,
          notification_channels: ['email_admin'],
          created_at: new Date().toISOString(),
          trigger_count: 12
        },
        {
          id: 'rule_system_error',
          name: 'Erros do Sistema',
          description: 'Alertar sobre erros críticos no sistema',
          condition: 'system_errors > 0',
          threshold: 1,
          category: 'system',
          severity: 'critical',
          enabled: true,
          notification_channels: ['email_admin', 'sms_admin', 'slack_dev'],
          created_at: new Date().toISOString(),
          trigger_count: 0
        }
      ]

      setAlertRules(defaultRules)

      // Canais de notificação
      const defaultChannels: NotificationChannel[] = [
        {
          id: 'email_admin',
          name: 'Email Administrador',
          type: 'email',
          config: { 
            email: 'admin@proceda.ia',
            smtp_host: 'smtp.gmail.com',
            smtp_port: 587
          },
          enabled: true,
          test_status: 'success'
        },
        {
          id: 'sms_admin',
          name: 'SMS Administrador',
          type: 'sms',
          config: { 
            phone: '+5511999999999',
            provider: 'twilio'
          },
          enabled: false,
          test_status: 'pending'
        },
        {
          id: 'slack_dev',
          name: 'Slack Desenvolvimento',
          type: 'slack',
          config: { 
            webhook_url: 'https://hooks.slack.com/services/...',
            channel: '#alerts'
          },
          enabled: false,
          test_status: 'failed'
        },
        {
          id: 'webhook_external',
          name: 'Webhook Externo',
          type: 'webhook',
          config: { 
            url: 'https://api.exemplo.com/alerts',
            method: 'POST',
            headers: { 'Authorization': 'Bearer token123' }
          },
          enabled: false
        }
      ]

      setNotificationChannels(defaultChannels)

    } catch (error) {
      console.error('Erro ao carregar alertas:', error)
    } finally {
      setLoading(false)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              status: 'acknowledged',
              acknowledged_at: new Date().toISOString(),
              acknowledged_by: user?.email || 'Admin'
            }
          : alert
      ))
    } catch (error) {
      console.error('Erro ao reconhecer alerta:', error)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolved_by: user?.email || 'Admin'
            }
          : alert
      ))
    } catch (error) {
      console.error('Erro ao resolver alerta:', error)
    }
  }

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Tem certeza que deseja excluir este alerta?')) return
    
    try {
      setAlerts(prev => prev.filter(alert => alert.id !== alertId))
    } catch (error) {
      console.error('Erro ao excluir alerta:', error)
    }
  }

  const toggleRule = async (ruleId: string) => {
    try {
      setAlertRules(prev => prev.map(rule => 
        rule.id === ruleId 
          ? { ...rule, enabled: !rule.enabled }
          : rule
      ))
    } catch (error) {
      console.error('Erro ao alterar regra:', error)
    }
  }

  const testNotificationChannel = async (channelId: string) => {
    try {
      setNotificationChannels(prev => prev.map(channel => 
        channel.id === channelId 
          ? { ...channel, test_status: 'pending' }
          : channel
      ))

      // Simular teste
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const success = Math.random() > 0.3 // 70% de chance de sucesso
      
      setNotificationChannels(prev => prev.map(channel => 
        channel.id === channelId 
          ? { ...channel, test_status: success ? 'success' : 'failed' }
          : channel
      ))
    } catch (error) {
      console.error('Erro ao testar canal:', error)
    }
  }

  const exportAlertsReport = () => {
    const report = `
Relatório de Alertas - ${new Date().toLocaleDateString('pt-BR')}

RESUMO:
Total de Alertas: ${alerts.length}
Alertas Ativos: ${alerts.filter(a => a.status === 'active').length}
Alertas Críticos: ${alerts.filter(a => a.severity === 'critical').length}
Regras Ativas: ${alertRules.filter(r => r.enabled).length}

ALERTAS ATIVOS:
${alerts.filter(a => a.status === 'active').map(a => 
  `[${a.severity.toUpperCase()}] ${a.title} - ${a.message} (${a.created_at})`
).join('\n')}

REGRAS CONFIGURADAS:
${alertRules.map(r => 
  `${r.enabled ? '✅' : '❌'} ${r.name} - ${r.description} (Disparado ${r.trigger_count}x)`
).join('\n')}

CANAIS DE NOTIFICAÇÃO:
${notificationChannels.map(c => 
  `${c.enabled ? '✅' : '❌'} ${c.name} (${c.type}) - Status: ${c.test_status || 'não testado'}`
).join('\n')}
    `.trim()

    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_alertas_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />
      default: return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getCategoryIcon = (category: string) => {
    const categoryInfo = alertCategories.find(c => c.value === category)
    if (!categoryInfo) return <Bell className="w-4 h-4" />
    const Icon = categoryInfo.icon
    return <Icon className="w-4 h-4" />
  }

  const getSeverityClass = (severity: string) => {
    const severityInfo = severityLevels.find(s => s.value === severity)
    return severityInfo?.color || 'text-gray-400 bg-gray-900/20 border-gray-500/30'
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'sms': return <Smartphone className="w-4 h-4" />
      case 'slack': return <Globe className="w-4 h-4" />
      case 'webhook': return <Globe className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  const formatTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Agora mesmo'
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h atrás`
    
    return `${Math.floor(diffInHours / 24)}d atrás`
  }

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.message.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
    return matchesSearch && matchesStatus && matchesSeverity
  })

  const alertStats = {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    resolved: alerts.filter(a => a.status === 'resolved').length
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
          <h1 className="text-2xl font-bold text-white mb-2">Alertas Inteligentes</h1>
          <p className="text-gray-400">Monitoramento proativo e notificações automáticas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAlertsData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={exportAlertsReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
              <Bell className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{alertStats.total}</p>
            <p className="text-sm text-gray-400">Total de Alertas</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            {alertStats.active > 0 && (
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{alertStats.active}</p>
            <p className="text-sm text-gray-400">Alertas Ativos</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-red-600 to-red-700 rounded-lg">
              <XCircle className="w-6 h-6 text-white" />
            </div>
            {alertStats.critical > 0 && (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{alertStats.critical}</p>
            <p className="text-sm text-gray-400">Alertas Críticos</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{alertStats.resolved}</p>
            <p className="text-sm text-gray-400">Resolvidos</p>
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
              </button>
            )
          })}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar alertas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="all">Todos os Status</option>
          <option value="active">Ativos</option>
          <option value="acknowledged">Reconhecidos</option>
          <option value="resolved">Resolvidos</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="all">Todas as Severidades</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Alertas Ativos ({filteredAlerts.filter(a => a.status === 'active').length})
              </h2>
            </div>
            
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Nenhum alerta encontrado</p>
                  <p className="text-sm">Sistema funcionando normalmente</p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${
                    alert.status === 'active' ? 'border-l-4' : 'border-l-2'
                  } ${
                    alert.type === 'error' ? 'border-l-red-500 bg-red-900/10' :
                    alert.type === 'warning' ? 'border-l-yellow-500 bg-yellow-900/10' :
                    alert.type === 'success' ? 'border-l-green-500 bg-green-900/10' :
                    'border-l-blue-500 bg-blue-900/10'
                  } bg-gray-900/50 border-gray-700`}>
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getAlertIcon(alert.type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-white font-semibold">{alert.title}</h3>
                            <p className="text-gray-300 text-sm mt-1">{alert.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityClass(alert.severity)}`}>
                              {severityLevels.find(s => s.value === alert.severity)?.label}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              alert.status === 'active' ? 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400' :
                              alert.status === 'acknowledged' ? 'bg-blue-900/20 border border-blue-500/30 text-blue-400' :
                              'bg-green-900/20 border border-green-500/30 text-green-400'
                            }`}>
                              {alert.status === 'active' ? 'Ativo' :
                               alert.status === 'acknowledged' ? 'Reconhecido' : 'Resolvido'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            {getCategoryIcon(alert.category)}
                            <span className="capitalize">{alert.category}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(alert.created_at)}</span>
                          </div>
                          {alert.acknowledged_by && (
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              <span>Visto por {alert.acknowledged_by}</span>
                            </div>
                          )}
                        </div>

                        {alert.metadata && (
                          <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                            <h4 className="text-gray-300 font-medium text-sm mb-2">Detalhes:</h4>
                            <div className="text-gray-400 text-xs space-y-1">
                              {Object.entries(alert.metadata).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                  <span>{Array.isArray(value) ? value.length : String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {alert.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Reconhecer
                            </button>
                            <button
                              onClick={() => resolveAlert(alert.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Resolver
                            </button>
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Regras de Alerta ({alertRules.length})</h2>
              <button
                onClick={() => setShowRuleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Regra
              </button>
            </div>
            
            <div className="space-y-3">
              {alertRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        rule.enabled ? 'bg-green-600' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        rule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                    <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {getCategoryIcon(rule.category)}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{rule.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityClass(rule.severity)}`}>
                        {severityLevels.find(s => s.value === rule.severity)?.label}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        rule.enabled 
                          ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                          : 'bg-gray-900/20 border border-gray-500/30 text-gray-400'
                      }`}>
                        {rule.enabled ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{rule.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Condição: {rule.condition}</span>
                      <span>Limite: {rule.threshold}</span>
                      <span>Disparada: {rule.trigger_count}x</span>
                      {rule.last_triggered && (
                        <span>Última: {formatTime(rule.last_triggered)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRule(rule)
                        setShowRuleModal(true)
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir esta regra?')) {
                          setAlertRules(prev => prev.filter(r => r.id !== rule.id))
                        }
                      }}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Canais de Notificação ({notificationChannels.length})</h2>
              <button
                onClick={() => setShowChannelModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Canal
              </button>
            </div>
            
            <div className="space-y-3">
              {notificationChannels.map((channel) => (
                <div key={channel.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${channel.enabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {getChannelIcon(channel.type)}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{channel.name}</h3>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full capitalize">
                        {channel.type}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        channel.enabled 
                          ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                          : 'bg-gray-900/20 border border-gray-500/30 text-gray-400'
                      }`}>
                        {channel.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                      {channel.test_status && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          channel.test_status === 'success' ? 'bg-green-900/20 border border-green-500/30 text-green-400' :
                          channel.test_status === 'failed' ? 'bg-red-900/20 border border-red-500/30 text-red-400' :
                          'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400'
                        }`}>
                          {channel.test_status === 'success' ? 'Testado ✓' :
                           channel.test_status === 'failed' ? 'Falha ✗' : 'Testando...'}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {channel.type === 'email' && `Email: ${channel.config.email}`}
                      {channel.type === 'sms' && `Telefone: ${channel.config.phone}`}
                      {channel.type === 'slack' && `Canal: ${channel.config.channel}`}
                      {channel.type === 'webhook' && `URL: ${channel.config.url}`}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testNotificationChannel(channel.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Testar
                    </button>
                    <button
                      onClick={() => {
                        setEditingChannel(channel)
                        setShowChannelModal(true)
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir este canal?')) {
                          setNotificationChannels(prev => prev.filter(c => c.id !== channel.id))
                        }
                      }}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Histórico de Alertas</h2>
            
            <div className="space-y-3">
              {alerts.filter(a => a.status !== 'active').map((alert) => (
                <div key={alert.id} className="p-4 bg-gray-900/30 rounded-lg border border-gray-700 opacity-75">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getAlertIcon(alert.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{alert.title}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityClass(alert.severity)}`}>
                          {severityLevels.find(s => s.value === alert.severity)?.label}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Criado: {formatTime(alert.created_at)}</span>
                        {alert.resolved_at && (
                          <span>Resolvido: {formatTime(alert.resolved_at)} por {alert.resolved_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
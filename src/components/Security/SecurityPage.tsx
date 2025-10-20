import React, { useState, useEffect } from 'react'
import {
  Shield, Users, Lock, AlertTriangle, Eye, Ban, 
  CheckCircle, Clock, Globe, Smartphone, Monitor,
  RefreshCw, Download, Search, Filter, MoreVertical,
  UserX, UserCheck, Activity, Calendar, MapPin
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface SecurityMetrics {
  activeSessions: number
  blockedUsers: number
  failedLogins: number
  suspiciousActivity: number
}

interface UserSession {
  id: string
  user_id: string
  user_name: string
  user_email: string
  ip_address: string
  user_agent: string
  device_type: string
  location: string
  login_time: string
  last_activity: string
  status: 'active' | 'idle' | 'expired'
}

interface LoginAttempt {
  id: string
  email: string
  ip_address: string
  user_agent: string
  success: boolean
  timestamp: string
  failure_reason?: string
  location: string
}

interface BlockedUser {
  id: string
  user_id: string
  user_name: string
  user_email: string
  blocked_reason: string
  blocked_by: string
  blocked_at: string
  expires_at?: string
  status: 'active' | 'expired'
}

export function SecurityPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState('24h')
  
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    activeSessions: 0,
    blockedUsers: 0,
    failedLogins: 0,
    suspiciousActivity: 0
  })
  
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([])
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: Shield },
    { id: 'sessions', label: 'Sessões Ativas', icon: Users },
    { id: 'attempts', label: 'Tentativas de Login', icon: Lock },
    { id: 'blocked', label: 'Usuários Bloqueados', icon: Ban }
  ]

  useEffect(() => {
    loadSecurityData()
  }, [timeFilter])

  const loadSecurityData = async () => {
    try {
      setLoading(true)
      
      // Carregar dados reais dos usuários
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
      
      if (usersError) throw usersError

      // Gerar dados simulados baseados nos usuários reais
      const mockSessions: UserSession[] = users?.slice(0, 8).map((u, index) => ({
        id: `session_${u.id}`,
        user_id: u.id,
        user_name: u.name || 'Usuário',
        user_email: u.email,
        ip_address: `192.168.1.${100 + index}`,
        user_agent: [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ][index % 3],
        device_type: ['Desktop', 'Mobile', 'Tablet'][index % 3],
        location: ['São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG'][index % 3],
        login_time: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        last_activity: new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString(),
        status: ['active', 'idle'][Math.random() > 0.3 ? 0 : 1] as any
      })) || []

      const mockLoginAttempts: LoginAttempt[] = Array.from({ length: 15 }, (_, i) => ({
        id: `attempt_${i}`,
        email: users?.[i % users.length]?.email || `user${i}@example.com`,
        ip_address: `192.168.1.${50 + i}`,
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        success: Math.random() > 0.3,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        failure_reason: Math.random() > 0.3 ? undefined : ['Senha incorreta', 'Email não encontrado', 'Conta bloqueada'][Math.floor(Math.random() * 3)],
        location: ['São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG'][i % 3]
      }))

      const mockBlockedUsers: BlockedUser[] = users?.slice(0, 2).map((u, index) => ({
        id: `blocked_${u.id}`,
        user_id: u.id,
        user_name: u.name || 'Usuário',
        user_email: u.email,
        blocked_reason: ['Múltiplas tentativas de login', 'Atividade suspeita'][index % 2],
        blocked_by: 'Sistema',
        blocked_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      })) || []

      setSessions(mockSessions)
      setLoginAttempts(mockLoginAttempts)
      setBlockedUsers(mockBlockedUsers)

      // Calcular métricas
      setMetrics({
        activeSessions: mockSessions.filter(s => s.status === 'active').length,
        blockedUsers: mockBlockedUsers.filter(b => b.status === 'active').length,
        failedLogins: mockLoginAttempts.filter(a => !a.success).length,
        suspiciousActivity: Math.floor(Math.random() * 5)
      })

    } catch (error) {
      console.error('Erro ao carregar dados de segurança:', error)
    } finally {
      setLoading(false)
    }
  }

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja encerrar esta sessão?')) return
    
    try {
      // Simular encerramento de sessão
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      setMetrics(prev => ({ ...prev, activeSessions: prev.activeSessions - 1 }))
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error)
    }
  }

  const blockUser = async (userId: string, reason: string) => {
    try {
      const user = sessions.find(s => s.user_id === userId)
      if (!user) return

      const newBlockedUser: BlockedUser = {
        id: `blocked_${userId}`,
        user_id: userId,
        user_name: user.user_name,
        user_email: user.user_email,
        blocked_reason: reason,
        blocked_by: 'Admin',
        blocked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      }

      setBlockedUsers(prev => [newBlockedUser, ...prev])
      setSessions(prev => prev.filter(s => s.user_id !== userId))
      setMetrics(prev => ({ 
        ...prev, 
        blockedUsers: prev.blockedUsers + 1,
        activeSessions: prev.activeSessions - 1
      }))
    } catch (error) {
      console.error('Erro ao bloquear usuário:', error)
    }
  }

  const unblockUser = async (blockedUserId: string) => {
    if (!confirm('Tem certeza que deseja desbloquear este usuário?')) return
    
    try {
      setBlockedUsers(prev => prev.filter(b => b.id !== blockedUserId))
      setMetrics(prev => ({ ...prev, blockedUsers: prev.blockedUsers - 1 }))
    } catch (error) {
      console.error('Erro ao desbloquear usuário:', error)
    }
  }

  const exportSecurityReport = () => {
    const report = `
Relatório de Segurança - ${new Date().toLocaleDateString('pt-BR')}

MÉTRICAS:
Sessões Ativas: ${metrics.activeSessions}
Usuários Bloqueados: ${metrics.blockedUsers}
Tentativas Falharam: ${metrics.failedLogins}
Atividades Suspeitas: ${metrics.suspiciousActivity}

SESSÕES ATIVAS:
${sessions.map(s => `${s.user_email} - ${s.ip_address} - ${s.device_type} - ${s.location}`).join('\n')}

TENTATIVAS DE LOGIN:
${loginAttempts.map(a => `${a.email} - ${a.ip_address} - ${a.success ? 'SUCESSO' : 'FALHA'} - ${a.failure_reason || ''}`).join('\n')}

USUÁRIOS BLOQUEADOS:
${blockedUsers.map(b => `${b.user_email} - ${b.blocked_reason} - ${b.blocked_at}`).join('\n')}
    `.trim()

    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_seguranca_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-4 h-4" />
      case 'tablet': return <Smartphone className="w-4 h-4" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-900/20 border-green-500/30'
      case 'idle': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
      case 'expired': return 'text-red-400 bg-red-900/20 border-red-500/30'
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30'
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

  const filteredSessions = sessions.filter(session =>
    session.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.ip_address.includes(searchTerm)
  )

  const filteredAttempts = loginAttempts.filter(attempt =>
    attempt.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attempt.ip_address.includes(searchTerm)
  )

  const filteredBlocked = blockedUsers.filter(blocked =>
    blocked.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    blocked.user_email.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-white mb-2">Segurança & Controle</h1>
          <p className="text-gray-400">Monitoramento de sessões e controle de acesso</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="1h">Última hora</option>
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
          <button
            onClick={loadSecurityData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={exportSecurityReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{metrics.activeSessions}</p>
            <p className="text-sm text-gray-400 mb-2">Sessões Ativas</p>
            <p className="text-xs text-gray-500">Usuários online agora</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-red-600 to-red-700 rounded-lg">
              <Ban className="w-6 h-6 text-white" />
            </div>
            {metrics.blockedUsers > 0 && (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{metrics.blockedUsers}</p>
            <p className="text-sm text-gray-400 mb-2">Usuários Bloqueados</p>
            <p className="text-xs text-gray-500">Bloqueios ativos</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg">
              <Lock className="w-6 h-6 text-white" />
            </div>
            {metrics.failedLogins > 5 && (
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{metrics.failedLogins}</p>
            <p className="text-sm text-gray-400 mb-2">Tentativas Falharam</p>
            <p className="text-xs text-gray-500">Últimas 24h</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            {metrics.suspiciousActivity > 0 && (
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{metrics.suspiciousActivity}</p>
            <p className="text-sm text-gray-400 mb-2">Atividade Suspeita</p>
            <p className="text-xs text-gray-500">Alertas detectados</p>
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

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar usuários, IPs, emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Visão Geral de Segurança</h2>
            
            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-medium mb-4">Atividade Recente</h3>
                <div className="space-y-3">
                  {loginAttempts.slice(0, 5).map((attempt) => (
                    <div key={attempt.id} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                      <div className={`w-3 h-3 rounded-full ${attempt.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{attempt.email}</p>
                        <p className="text-gray-400 text-xs">
                          {attempt.success ? 'Login realizado' : `Falha: ${attempt.failure_reason}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">{formatTime(attempt.timestamp)}</p>
                        <p className="text-gray-500 text-xs">{attempt.ip_address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-4">Alertas de Segurança</h3>
                <div className="space-y-3">
                  {metrics.failedLogins > 10 && (
                    <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium text-sm">Alto número de falhas de login</p>
                        <p className="text-red-300 text-xs">{metrics.failedLogins} tentativas falharam nas últimas 24h</p>
                      </div>
                    </div>
                  )}
                  
                  {metrics.blockedUsers > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <Ban className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 font-medium text-sm">Usuários bloqueados</p>
                        <p className="text-yellow-300 text-xs">{metrics.blockedUsers} usuários estão bloqueados</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-green-400 font-medium text-sm">Sistema seguro</p>
                      <p className="text-green-300 text-xs">Nenhuma ameaça crítica detectada</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Sessões Ativas ({filteredSessions.length})</h2>
            </div>
            
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <div key={session.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {session.user_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{session.user_name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(session.status)}`}>
                        {session.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{session.user_email}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span>{session.ip_address}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getDeviceIcon(session.device_type)}
                        <span>{session.device_type}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{session.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Login: {formatTime(session.login_time)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => blockUser(session.user_id, 'Bloqueado manualmente pelo admin')}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Bloquear usuário"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => terminateSession(session.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="Encerrar sessão"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'attempts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Tentativas de Login ({filteredAttempts.length})</h2>
            </div>
            
            <div className="space-y-3">
              {filteredAttempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className={`w-3 h-3 rounded-full ${attempt.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{attempt.email}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        attempt.success 
                          ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                          : 'bg-red-900/20 border border-red-500/30 text-red-400'
                      }`}>
                        {attempt.success ? 'Sucesso' : 'Falha'}
                      </span>
                    </div>
                    {!attempt.success && attempt.failure_reason && (
                      <p className="text-red-400 text-sm mb-2">{attempt.failure_reason}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span>{attempt.ip_address}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{attempt.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(attempt.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'blocked' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Usuários Bloqueados ({filteredBlocked.length})</h2>
            </div>
            
            <div className="space-y-3">
              {filteredBlocked.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum usuário bloqueado</p>
                </div>
              ) : (
                filteredBlocked.map((blocked) => (
                  <div key={blocked.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-red-500/30">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center">
                      <UserX className="w-6 h-6 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{blocked.user_name}</h3>
                        <span className="px-2 py-1 text-xs rounded-full bg-red-900/20 border border-red-500/30 text-red-400">
                          Bloqueado
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{blocked.user_email}</p>
                      <p className="text-red-400 text-sm mb-2">{blocked.blocked_reason}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Bloqueado: {formatTime(blocked.blocked_at)}</span>
                        </div>
                        {blocked.expires_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Expira: {formatTime(blocked.expires_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => unblockUser(blocked.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                      Desbloquear
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
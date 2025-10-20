import React, { useState } from 'react'
import { 
  X, Bell, Send, Users, CheckSquare, Square, 
  AlertTriangle, Info, CheckCircle, Filter, Search
} from 'lucide-react'
import { User } from '../../lib/supabase'

interface ExtendedUser extends User {
  subscription_status?: 'active' | 'trial' | 'suspended'
  plan?: string
}

interface MassNotificationModalProps {
  users: ExtendedUser[]
  onSend: (message: string, type: string, targetUsers: string[]) => Promise<void>
  onClose: () => void
}

export function MassNotificationModal({ users, onSend, onClose }: MassNotificationModalProps) {
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'info' | 'warning' | 'success'>('info')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlan, setFilterPlan] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const notificationTypes = [
    { 
      value: 'info', 
      label: 'Informação', 
      icon: Info, 
      color: 'text-blue-400 bg-blue-600',
      description: 'Notificação geral'
    },
    { 
      value: 'warning', 
      label: 'Aviso', 
      icon: AlertTriangle, 
      color: 'text-yellow-400 bg-yellow-600',
      description: 'Alerta importante'
    },
    { 
      value: 'success', 
      label: 'Sucesso', 
      icon: CheckCircle, 
      color: 'text-green-400 bg-green-600',
      description: 'Boa notícia'
    }
  ]

  const quickMessages = [
    'Novos templates disponíveis na plataforma!',
    'Manutenção programada para este fim de semana.',
    'Promoção especial: 50% de desconto em upgrades!',
    'Nova funcionalidade de IA foi lançada.',
    'Lembrete: Renovação de assinatura se aproxima.',
    'Sistema atualizado com melhorias de performance.'
  ]

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || user.subscription_status === filterStatus
    const matchesPlan = filterPlan === 'all' || user.plan === filterPlan
    return matchesSearch && matchesStatus && matchesPlan
  })

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id))
    }
  }

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim()) {
      setError('Mensagem é obrigatória')
      return
    }

    if (selectedUsers.length === 0) {
      setError('Selecione pelo menos um usuário')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSend(message.trim(), type, selectedUsers)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar notificações')
    } finally {
      setLoading(false)
    }
  }

  const selectedTypeInfo = notificationTypes.find(t => t.value === type)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Notificação em Massa</h2>
              <p className="text-gray-400 text-sm">Enviar para múltiplos usuários</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Notificação */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Tipo de Notificação
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {notificationTypes.map((notifType) => {
                  const Icon = notifType.icon
                  return (
                    <button
                      key={notifType.value}
                      type="button"
                      onClick={() => setType(notifType.value as any)}
                      className={`p-3 border rounded-xl transition-all ${
                        type === notifType.value
                          ? 'border-blue-500 bg-blue-600/10'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center mx-auto mb-2 ${notifType.color}`}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      <h3 className="text-white font-medium text-xs mb-1">{notifType.label}</h3>
                      <p className="text-gray-400 text-xs">{notifType.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mensagens Rápidas */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Mensagens Rápidas
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-24 overflow-y-auto">
                {quickMessages.map((quickMsg, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setMessage(quickMsg)}
                    className="text-left p-2 bg-gray-900/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg text-gray-300 text-xs transition-colors"
                  >
                    {quickMsg}
                  </button>
                ))}
              </div>
            </div>

            {/* Mensagem */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mensagem
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 resize-none"
                required
              />
            </div>

            {/* Seleção de Usuários */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-300">
                  Selecionar Usuários ({selectedUsers.length}/{filteredUsers.length})
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  {selectedUsers.length === filteredUsers.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {selectedUsers.length === filteredUsers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar usuários..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 text-sm"
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white text-sm"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativo</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspenso</option>
                </select>

                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white text-sm"
                >
                  <option value="all">Todos os Planos</option>
                  <option value="Básico">Básico</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              {/* Lista de Usuários */}
              <div className="border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum usuário encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-700/30 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-white font-medium text-sm truncate">{user.name || 'Sem nome'}</p>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                {user.plan || 'Básico'}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                user.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                                user.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {user.subscription_status === 'active' ? 'Ativo' :
                                 user.subscription_status === 'trial' ? 'Trial' : 'Suspenso'}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-400 text-xs truncate">{user.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {message.trim() && selectedUsers.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Preview da Notificação
                </h3>
                <div className={`p-3 rounded-lg border ${
                  type === 'info' ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' :
                  type === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                  'bg-green-900/20 border-green-500/30 text-green-400'
                }`}>
                  <div className="flex items-start gap-2">
                    {selectedTypeInfo && <selectedTypeInfo.icon className="w-4 h-4 mt-0.5" />}
                    <p className="text-sm">{message}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  Será enviada para {selectedUsers.length} usuário(s) selecionado(s)
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
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
                disabled={loading || !message.trim() || selectedUsers.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {loading ? 'Enviando...' : `Enviar para ${selectedUsers.length} usuário(s)`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
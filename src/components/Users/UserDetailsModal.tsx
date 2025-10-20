import React from 'react'
import { 
  X, User, Mail, Phone, MapPin, Calendar, CreditCard, 
  Zap, Crown, CheckCircle, Clock, AlertTriangle, Bell,
  FileText, BarChart3, Activity
} from 'lucide-react'
import { User as UserType } from '../../lib/supabase'

interface ExtendedUser extends UserType {
  subscription_status?: 'active' | 'trial' | 'suspended'
  plan?: string
  phone?: string
  address?: string
  payment_method?: string
  renewal_date?: string
}

interface UserDetailsModalProps {
  user: ExtendedUser
  onClose: () => void
}

export function UserDetailsModal({ user, onClose }: UserDetailsModalProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'trial':
        return <Clock className="w-5 h-5 text-blue-400" />
      case 'suspended':
        return <AlertTriangle className="w-5 h-5 text-red-400" />
      default:
        return <User className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-900/20 border-green-500/30'
      case 'trial':
        return 'text-blue-400 bg-blue-900/20 border-blue-500/30'
      case 'suspended':
        return 'text-red-400 bg-red-900/20 border-red-500/30'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-500/30'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const tokenPercentage = user.tokens_limit > 0 ? (user.tokens_used / user.tokens_limit) * 100 : 0

  // Mock data para demonstração
  const mockNotifications = [
    { id: 1, message: 'Bem-vindo ao proceda.ia!', date: '2025-01-01T10:00:00Z', read: true },
    { id: 2, message: 'Seus tokens estão acabando', date: '2025-01-02T15:30:00Z', read: false },
    { id: 3, message: 'Novo template disponível', date: '2025-01-03T09:15:00Z', read: true }
  ]

  const mockDocuments = [
    { id: 1, title: 'Contrato de Serviços', type: 'docx', date: '2025-01-01T14:20:00Z' },
    { id: 2, title: 'Relatório Mensal', type: 'xlsx', date: '2025-01-02T11:45:00Z' },
    { id: 3, title: 'Apresentação Comercial', type: 'pptx', date: '2025-01-03T16:30:00Z' }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              {user.role === 'master' ? (
                <Crown className="w-6 h-6 text-white" />
              ) : (
                <User className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user.name || 'Usuário'}</h2>
              <p className="text-gray-400">{user.email}</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(user.subscription_status || 'active')}`}>
              {getStatusIcon(user.subscription_status || 'active')}
              <span className="text-sm font-medium">
                {user.subscription_status === 'active' ? 'Ativo' : 
                 user.subscription_status === 'trial' ? 'Trial' : 'Suspenso'}
              </span>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dados Cadastrais */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Dados Cadastrais
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="text-white">{user.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Telefone</p>
                    <p className="text-white">{user.phone || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Endereço</p>
                    <p className="text-white">{user.address || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Membro desde</p>
                    <p className="text-white">{formatDate(user.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Tipo de Conta</p>
                    <p className="text-white capitalize">{user.role}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assinatura e Pagamento */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Assinatura
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Plano Atual</p>
                  <p className="text-white font-medium">{user.plan || 'Básico'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-400">Forma de Pagamento</p>
                  <p className="text-white">{user.payment_method || 'Cartão de Crédito'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-400">Próxima Renovação</p>
                  <p className="text-white">
                    {user.renewal_date ? formatDate(user.renewal_date) : 'Não definida'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-400">Status da Assinatura</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(user.subscription_status || 'active')}`}>
                    {getStatusIcon(user.subscription_status || 'active')}
                    <span className="text-sm">
                      {user.subscription_status === 'active' ? 'Ativa' : 
                       user.subscription_status === 'trial' ? 'Trial' : 'Suspensa'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Uso de Tokens */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Uso de Tokens
              </h3>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-3">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#374151"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={tokenPercentage >= 80 ? '#ef4444' : tokenPercentage >= 60 ? '#f59e0b' : '#10b981'}
                        strokeWidth="2"
                        strokeDasharray={`${tokenPercentage}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-white">{Math.round(tokenPercentage)}%</span>
                    </div>
                  </div>
                  <p className="text-white font-medium">
                    {user.tokens_used.toLocaleString()} / {user.tokens_limit.toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-sm">Tokens utilizados</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Restantes</span>
                    <span className="text-white">{(user.tokens_limit - user.tokens_used).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Última atualização</span>
                    <span className="text-white">{formatDate(user.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Atividade Recente */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Documentos Criados */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documentos Recentes
              </h3>
              <div className="space-y-3">
                {mockDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{doc.title}</p>
                        <p className="text-gray-400 text-xs">{doc.type.toUpperCase()}</p>
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs">
                      {formatDate(doc.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notificações */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Histórico de Notificações
              </h3>
              <div className="space-y-3">
                {mockNotifications.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className={`w-2 h-2 rounded-full mt-2 ${notification.read ? 'bg-gray-500' : 'bg-blue-500'}`}></div>
                    <div className="flex-1">
                      <p className="text-white text-sm">{notification.message}</p>
                      <p className="text-gray-400 text-xs">{formatDateTime(notification.date)}</p>
                    </div>
                    {!notification.read && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full">Nova</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estatísticas de Uso */}
          <div className="mt-6 bg-gray-900/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Estatísticas de Uso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{mockDocuments.length}</p>
                <p className="text-gray-400 text-sm">Documentos</p>
              </div>

              <div className="text-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">47</p>
                <p className="text-gray-400 text-sm">Sessões</p>
              </div>

              <div className="text-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{user.tokens_used}</p>
                <p className="text-gray-400 text-sm">Tokens Usados</p>
              </div>

              <div className="text-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">12h</p>
                <p className="text-gray-400 text-sm">Tempo Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
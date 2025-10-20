import React, { useState, useEffect } from 'react'
import {
  Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, Crown, User, Zap,
  Bell, Calendar, Mail, Phone
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { UserModal } from './UserModal'
import { UserDetailsModal } from './UserDetailsModal'
import { AddTokensModal } from './AddTokensModal'
import { NotificationModal } from './NotificationModal'
import { MassNotificationModal } from './MassNotificationModal'

interface ExtendedUser {
  id: string
  name: string
  email: string
  role: string
  tokens_limit: number
  tokens_used: number
  created_at: string
  phone?: string
  address?: string
  subscription_status?: 'active' | 'trial' | 'suspended'
  plan?: string
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ExtendedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null)
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showTokensModal, setShowTokensModal] = useState(false)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [showMassNotificationModal, setShowMassNotificationModal] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const isMaster = currentUser?.user_metadata?.role === 'master'

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const enrichedUsers = (data || []).map(user => ({
        ...user,
        subscription_status: Math.random() > 0.7 ? 'trial' : Math.random() > 0.3 ? 'active' : 'suspended',
        plan: ['Básico', 'Pro', 'Enterprise'][Math.floor(Math.random() * 3)],
        phone: `(11) 9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
        address: `Rua ${Math.floor(Math.random() * 999) + 1}, São Paulo - SP`
      }))

      setUsers(enrichedUsers)
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [isMaster])

  const handleCreateUser = async (userData: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          tokens_limit: userData.tokens_limit ?? 5000,
          sendInvite: userData.sendInvite
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      await loadUsers()
      setShowModal(false)
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err)
      throw err
    }
  }

  const handleEditUser = async (userData: any) => {
    if (!editingUser) return

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: userData.name,
          email: userData.email,
          role: userData.role,
          tokens_limit: userData.tokens_limit
        })
        .eq('id', editingUser.id)

      if (error) throw error

      await loadUsers()
      setEditingUser(null)
      setShowModal(false)
    } catch (err: any) {
      console.error('Erro ao editar usuário:', err)
      throw err
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) throw error

      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao excluir usuário:', err)
    }
  }

  const handleAddTokens = async (userId: string, amount: number, reason: string) => {
    try {
      const user = users.find(u => u.id === userId)
      if (!user) throw new Error('Usuário não encontrado')

      const newLimit = user.tokens_limit + amount
      const { error } = await supabase
        .from('users')
        .update({ tokens_limit: newLimit })
        .eq('id', userId)

      if (error) throw error

      await loadUsers()
      setShowTokensModal(false)
      setSelectedUser(null)
    } catch (err: any) {
      console.error('Erro ao adicionar tokens:', err)
      throw err
    }
  }

  const handleSendNotification = async (message: string, type: string) => {
    try {
      // Simular envio de notificação
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Notificação enviada:', { message, type, user: selectedUser?.email })
      setShowNotificationModal(false)
      setSelectedUser(null)
    } catch (err: any) {
      console.error('Erro ao enviar notificação:', err)
      throw err
    }
  }

  const handleSendMassNotification = async (message: string, type: string, targetUsers: string[]) => {
    try {
      // Simular envio de notificação em massa
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('Notificação em massa enviada:', { message, type, count: targetUsers.length })
      setShowMassNotificationModal(false)
    } catch (err: any) {
      console.error('Erro ao enviar notificação em massa:', err)
      throw err
    }
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setShowModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'trial':
        return 'bg-blue-100 text-blue-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'trial': return 'Trial'
      case 'suspended': return 'Suspenso'
      default: return 'Desconhecido'
    }
  }

  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Gerenciar Usuários</h1>
          <p className="text-gray-400">Administre usuários, tokens e permissões</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMassNotificationModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            Notificação em Massa
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          </h3>
          <p className="text-gray-400 mb-4">
            {searchTerm
              ? 'Tente ajustar sua busca ou cadastrar um novo usuário'
              : 'Comece cadastrando o primeiro usuário do sistema'}
          </p>
          {!searchTerm && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Cadastrar Primeiro Usuário
            </button>
          )}
        </div>
      ) : (
        /* Users Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => {
            const tokenPercentage = user.tokens_limit > 0 ? (user.tokens_used / user.tokens_limit) * 100 : 0
            const isMenuOpen = menuOpen === user.id

            return (
              <div key={user.id} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all duration-200 group">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                      {user.role === 'master' ? (
                        <Crown className="w-6 h-6 text-white" />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{user.name || 'Sem nome'}</h3>
                      <p className="text-gray-400 text-sm truncate">{user.email}</p>
                    </div>
                  </div>
                  
                  {/* Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(isMenuOpen ? null : user.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {isMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setMenuOpen(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDetailsModal(true)
                              setMenuOpen(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Detalhes
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setShowModal(true)
                              setMenuOpen(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowTokensModal(true)
                              setMenuOpen(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                          >
                            <Zap className="w-4 h-4" />
                            Adicionar Tokens
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowNotificationModal(true)
                              setMenuOpen(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                          >
                            <Bell className="w-4 h-4" />
                            Enviar Notificação
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteUser(user.id)
                              setMenuOpen(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-gray-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Status and Plan */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(user.subscription_status || 'active')}`}>
                    {getStatusLabel(user.subscription_status || 'active')}
                  </span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                    {user.plan || 'Básico'}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full capitalize">
                    {user.role}
                  </span>
                </div>

                {/* Token Usage */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Tokens</span>
                    <span className="text-white text-sm font-medium">
                      {user.tokens_used.toLocaleString()} / {user.tokens_limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        tokenPercentage >= 90 ? 'bg-red-500' :
                        tokenPercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, tokenPercentage)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {Math.round(tokenPercentage)}% usado
                    </span>
                    <span className="text-xs text-gray-500">
                      {(user.tokens_limit - user.tokens_used).toLocaleString()} restantes
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  {user.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Phone className="w-4 h-4" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>Desde {formatDate(user.created_at)}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowDetailsModal(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(user)
                      setShowModal(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <UserModal
          user={editingUser}
          onSave={editingUser ? handleEditUser : handleCreateUser}
          onClose={() => {
            setShowModal(false)
            setEditingUser(null)
          }}
        />
      )}

      {showDetailsModal && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedUser(null)
          }}
        />
      )}

      {showTokensModal && selectedUser && (
        <AddTokensModal
          user={selectedUser}
          onSave={handleAddTokens}
          onClose={() => {
            setShowTokensModal(false)
            setSelectedUser(null)
          }}
        />
      )}

      {showNotificationModal && selectedUser && (
        <NotificationModal
          user={selectedUser}
          onSend={handleSendNotification}
          onClose={() => {
            setShowNotificationModal(false)
            setSelectedUser(null)
          }}
        />
      )}

      {showMassNotificationModal && (
        <MassNotificationModal
          users={users}
          onSend={handleSendMassNotification}
          onClose={() => setShowMassNotificationModal(false)}
        />
      )}
    </div>
  )
}
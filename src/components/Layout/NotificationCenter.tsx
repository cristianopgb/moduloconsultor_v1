import React, { useState, useEffect } from 'react'
import { Bell, X, Check, Trash2, AlertTriangle, Info, CheckCircle, Clock, Settings } from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success'
  read: boolean
  created_at: string
  from?: string
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onDeleteNotification: (id: string) => void
}

export function NotificationCenter({ isOpen, onClose, notifications, onMarkAsRead, onDeleteNotification }: NotificationCenterProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.read
    if (filter === 'read') return notif.read
    return true
  })

  const markAsRead = (id: string) => {
    onMarkAsRead(id)
  }

  const markAllAsRead = () => {
    notifications.filter(n => !n.read).forEach(n => onMarkAsRead(n.id))
  }

  const deleteNotification = (id: string) => {
    onDeleteNotification(id)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      default:
        return <Info className="w-4 h-4 text-blue-400" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-l-yellow-500'
      case 'success':
        return 'border-l-green-500'
      default:
        return 'border-l-blue-500'
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
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d atrás`
    
    return date.toLocaleDateString('pt-BR')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 lg:hidden" 
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Notificações</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Não lidas
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === 'read' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Lidas
            </button>
            <button
              onClick={markAllAsRead}
              className="ml-auto p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Marcar todas como lidas"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto max-h-96">
          {filteredNotifications.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {filter === 'unread' ? 'Nenhuma notificação não lida' :
                 filter === 'read' ? 'Nenhuma notificação lida' :
                 'Nenhuma notificação'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-700/30 transition-colors border-l-4 ${getTypeColor(notification.type)} ${
                    !notification.read ? 'bg-gray-700/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-2 flex-shrink-0"></div>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(notification.created_at)}</span>
                          {notification.from && (
                            <>
                              <span>•</span>
                              <span>{notification.from}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Marcar como lida"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button className="w-full flex items-center justify-center gap-2 py-2 text-gray-400 hover:text-white text-sm transition-colors">
            <Settings className="w-4 h-4" />
            Configurações de Notificação
          </button>
        </div>
      </div>
    </>
  )
}
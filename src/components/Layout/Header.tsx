import React from 'react'
import { Menu, Bell, Search, X } from 'lucide-react'
import { TokenDisplay } from '../Tokens/TokenDisplay'
import { NotificationCenter } from './NotificationCenter'
import { NotificationManager } from '../PWA/NotificationManager'

interface HeaderProps {
  onMenuToggle: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(3)
  const [notifications, setNotifications] = React.useState([
    {
      id: '1',
      title: 'Bem-vindo ao proceda.ia!',
      message: 'Sua conta foi criada com sucesso. Explore todas as funcionalidades disponíveis.',
      type: 'success',
      read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      from: 'Sistema'
    },
    {
      id: '2',
      title: 'Tokens se esgotando',
      message: 'Você já usou 85% dos seus tokens disponíveis. Considere fazer um upgrade.',
      type: 'warning',
      read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      from: 'Sistema'
    },
    {
      id: '3',
      title: 'Novo template disponível',
      message: 'Um novo template de contrato foi adicionado à sua categoria preferida.',
      type: 'info',
      read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      from: 'Administrador'
    }
  ])

  // Simular recebimento de novas notificações
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Simular nova notificação a cada 30 segundos (para demonstração)
      const shouldAddNotification = Math.random() > 0.95 // 5% de chance
      if (shouldAddNotification) {
        const newNotification = {
          id: Date.now().toString(),
          title: 'Nova notificação',
          message: 'Esta é uma notificação de teste gerada automaticamente.',
          type: ['info', 'warning', 'success'][Math.floor(Math.random() * 3)] as any,
          read: false,
          created_at: new Date().toISOString(),
          from: 'Sistema'
        }
        setNotifications(prev => [newNotification, ...prev])
        setUnreadCount(prev => prev + 1)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 h-16 flex items-center justify-between px-4 lg:px-6">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-gray-400 hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="hidden md:flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 min-w-[300px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar processos, usuários..."
            className="bg-transparent text-white placeholder-gray-400 outline-none flex-1"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <TokenDisplay showDetails={true} />
        </div>
        <div className="sm:hidden">
          <TokenDisplay />
        </div>
        
        <NotificationManager />
        
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          <NotificationCenter 
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onDeleteNotification={(id) => {
              setNotifications(prev => prev.filter(n => n.id !== id))
              const notification = notifications.find(n => n.id === id)
              if (notification && !notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1))
              }
            }}
          />
        </div>
      </div>
    </header>
  )
}
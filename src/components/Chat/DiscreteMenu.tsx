import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, FileText, Users, Settings, BarChart3, Database, Bell, Shield, MessageSquare, Zap, LayoutGrid as Layout, Calculator } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function DiscreteMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Determinar se é master baseado no email (como no Dashboard atual)
  const isMaster = user?.email?.includes('master') || user?.email?.includes('admin')

  const userMenuItems = [
    { id: 'dashboard', path: '/dashboard', icon: Home, title: 'Dashboard' },
    { id: 'chat', path: '/chat', icon: MessageSquare, title: 'Chat' },
    { id: 'documents', path: '/documents', icon: FileText, title: 'Documentos' },
    { id: 'datasets', path: '/datasets', icon: Calculator, title: 'Dados' },
    { id: 'datasets', path: '/datasets', icon: Calculator, title: 'Dados' },
    { id: 'datasets', path: '/datasets', icon: Calculator, title: 'Dados' },
    { id: 'tokens', path: '/tokens', icon: Zap, title: 'Tokens' },
  ]

  const masterMenuItems = [
    { id: 'dashboard', path: '/dashboard', icon: Home, title: 'Dashboard' },
    { id: 'chat', path: '/chat', icon: MessageSquare, title: 'Chat' },
    { id: 'alerts', path: '/alerts', icon: Bell, title: 'Alertas' },
    { id: 'users', path: '/users', icon: Users, title: 'Usuários' },
    { id: 'reports', path: '/reports', icon: BarChart3, title: 'Relatórios' },
    { id: 'templates', path: '/templates', icon: Layout, title: 'Templates' },
    { id: 'datasets', path: '/datasets', icon: Calculator, title: 'Dados' },
    { id: 'system', path: '/system', icon: Settings, title: 'Sistema' },
  ]

  const menuItems = isMaster ? masterMenuItems : userMenuItems

  const handleNavigation = (path: string) => {
    navigate(path)
  }

  return (
    <div className="border-t border-gray-800 p-3">
      <div className="grid grid-cols-3 gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className={`p-3 rounded-lg transition-colors flex flex-col items-center gap-1 ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={item.title}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs truncate">{item.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Home, MessageSquare, FileText, Users, Settings, 
  BarChart3, Database, Bell, Shield, Activity 
} from 'lucide-react'

interface MobileNavigationProps {
  isMaster?: boolean
}

export function MobileNavigation({ isMaster = false }: MobileNavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const userTabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
    { id: 'documents', label: 'Docs', icon: FileText, path: '/documents' },
    { id: 'projects', label: 'Projetos', icon: FileText, path: '/projects' },
    { id: 'settings', label: 'Config', icon: Settings, path: '/settings' }
  ]

  const masterTabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard' },
    { id: 'alerts', label: 'Alertas', icon: Bell, path: '/alerts' },
    { id: 'users', label: 'Users', icon: Users, path: '/users' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'system', label: 'Config', icon: Settings, path: '/system' }
  ]

  const tabs = isMaster ? masterTabs : userTabs

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 z-40 md:hidden">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = location.pathname === tab.path
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? 'text-blue-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
              {isActive && (
                <div className="w-1 h-1 bg-blue-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
// /src/components/Layout/Sidebar.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, BarChart3, Users, Settings, FileText, File, Brain, Crown, User, LogOut,
  Database, MessageSquare, Zap, LayoutGrid as Layout, Shield, Bell, Calculator, Sparkles, Activity
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  isMaster?: boolean
}

type MenuItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  badge?: number
}

export function Sidebar({ isOpen, onToggle, isMaster = false }: SidebarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (isMaster) {
      loadPendingCount()
      const interval = setInterval(loadPendingCount, 30000)
      return () => clearInterval(interval)
    }
  }, [isMaster])

  const loadPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('custom_sql_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (!error && count !== null) {
        setPendingCount(count)
      }
    } catch (err) {
      console.error('Erro ao carregar contagem de pendentes:', err)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('[DEBUG] Error signing out:', error)
    }
  }

  const userMenuItems: MenuItem[] = [
    { id: 'dashboard',      label: 'Dashboard',          icon: Home,         path: '/dashboard' },
    { id: 'database-test',  label: 'Teste DB',           icon: Database,     path: '/database-test' },
    { id: 'chat',           label: 'Chat IA',            icon: MessageSquare,path: '/chat' },
    { id: 'projects',       label: 'Projetos',           icon: FileText,     path: '/projects' },
    { id: 'documents',      label: 'Documentos',         icon: File,         path: '/documents' },
    { id: 'datasets',       label: 'Análise de Dados',   icon: Calculator,   path: '/datasets' },
    { id: 'tokens',         label: 'Tokens',             icon: Zap,          path: '/tokens' },
    { id: 'analytics',      label: 'Análises',           icon: BarChart3,    path: '/analytics' },
    { id: 'settings',       label: 'Configurações',      icon: Settings,     path: '/settings' },
  ]

  // ✅ Versão sem duplicatas (ids únicos)
  const masterMenuItems: MenuItem[] = [
    { id: 'dashboard',       label: 'Dashboard',            icon: Home,          path: '/dashboard' },
    { id: 'database-test',   label: 'Teste DB',             icon: Database,      path: '/database-test' },
    { id: 'analysis-health', label: 'Saúde das Análises',   icon: Activity,      path: '/admin/analysis-health' },
    { id: 'alerts',          label: 'Alertas Inteligentes', icon: Bell,          path: '/alerts' },
    { id: 'backup',          label: 'Backup & Restore',     icon: Database,      path: '/backup' },
    { id: 'ai-integrations', label: 'Integrações IA',       icon: Brain,         path: '/ai-integrations' },
    { id: 'security',        label: 'Segurança',            icon: Shield,        path: '/security' },
    { id: 'chat',            label: 'Chat IA',              icon: MessageSquare, path: '/chat' },
    { id: 'reports',         label: 'Relatórios',           icon: BarChart3,     path: '/reports' },
    { id: 'templates',       label: 'Templates',            icon: Layout,        path: '/templates' },
    { id: 'learning',        label: 'Aprendizado',          icon: Sparkles,      path: '/admin/learning', badge: pendingCount },
    { id: 'documents',       label: 'Documentos',           icon: File,          path: '/documents' },
    { id: 'datasets',        label: 'Análise de Dados',     icon: Calculator,    path: '/datasets' },
    { id: 'tokens',          label: 'Tokens',               icon: Zap,           path: '/tokens' },
    { id: 'users',           label: 'Usuários',             icon: Users,         path: '/users' },
    { id: 'projects',        label: 'Projetos',             icon: FileText,      path: '/projects' },
    { id: 'analytics',       label: 'Análises',             icon: BarChart3,     path: '/analytics' },
    { id: 'system',          label: 'Configurações',        icon: Settings,      path: '/system' },
  ]

  // 🛡️ Dedupe defensivo por id e por path (caso alguém adicione duplicado no futuro)
  const dedupeBy = (items: MenuItem[]) => {
    const byId = new Map<string, MenuItem>()
    const byPath = new Map<string, MenuItem>()
    for (const it of items) {
      if (!byId.has(it.id) && !byPath.has(it.path)) {
        byId.set(it.id, it)
        byPath.set(it.path, it)
      } else {
        console.log('[DEBUG] Menu duplicado ignorado:', it)
      }
    }
    return Array.from(byId.values())
  }

  const menuItems = dedupeBy(isMaster ? masterMenuItems : userMenuItems)

  const handleNavigation = (path: string) => {
    navigate(path)
    // Fechar sidebar no mobile após navegação
    if (window.innerWidth < 1024) {
      onToggle()
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white">SeivaAI</h1>
              <p className="text-xs text-gray-400">Painel de Controle</p>
            </div>
          </div>

          <div className="px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
            <span className="text-xs font-medium text-blue-400">Beta</span>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              {isMaster ? (
                <Crown className="w-5 h-5 text-white" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-400">
                {isMaster ? 'Master' : 'Usuário'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg transition-colors ${
                      isActive ? 'bg-gray-800 text-white' : 'hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </div>
    </>
  )
}

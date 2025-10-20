import React from 'react'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Calendar,
  Target,
  Activity
} from 'lucide-react'

export function UserDashboard() {
  const stats = [
    {
      title: 'Processos Ativos',
      value: '12',
      change: '+2 esta semana',
      icon: FileText,
      color: 'blue'
    },
    {
      title: 'Pendentes',
      value: '5',
      change: '-1 desde ontem',
      icon: Clock,
      color: 'yellow'
    },
    {
      title: 'Concluídos',
      value: '28',
      change: '+4 este mês',
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: 'Urgentes',
      value: '3',
      change: 'Requer atenção',
      icon: AlertCircle,
      color: 'red'
    }
  ]

  const recentProcesses = [
    {
      id: 1,
      title: 'Análise de Contrato - Cliente ABC',
      status: 'Em andamento',
      priority: 'Alta',
      dueDate: '2025-01-15',
      progress: 75
    },
    {
      id: 2,
      title: 'Revisão de Política Interna',
      status: 'Pendente',
      priority: 'Média',
      dueDate: '2025-01-20',
      progress: 30
    },
    {
      id: 3,
      title: 'Auditoria de Processos Q1',
      status: 'Concluído',
      priority: 'Alta',
      dueDate: '2025-01-10',
      progress: 100
    }
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'from-blue-600 to-blue-700 text-blue-100',
      yellow: 'from-yellow-600 to-yellow-700 text-yellow-100',
      green: 'from-green-600 to-green-700 text-green-100',
      red: 'from-red-600 to-red-700 text-red-100'
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em andamento': return 'bg-blue-100 text-blue-800'
      case 'Pendente': return 'bg-yellow-100 text-yellow-800'
      case 'Concluído': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'text-red-400'
      case 'Média': return 'text-yellow-400'
      case 'Baixa': return 'text-green-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Visão geral dos seus processos e atividades</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-r ${getColorClasses(stat.color)}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-gray-400 mb-2">{stat.title}</p>
                <p className="text-xs text-gray-500">{stat.change}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Processes */}
        <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Processos Recentes</h2>
            <button className="text-blue-400 hover:text-blue-300 text-sm">Ver todos</button>
          </div>
          
          <div className="space-y-4">
            {recentProcesses.map((process) => (
              <div key={process.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">{process.title}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(process.status)}`}>
                        {process.status}
                      </span>
                      <span className={`text-xs ${getPriorityColor(process.priority)}`}>
                        {process.priority}
                      </span>
                      <span className="text-gray-400 text-xs">
                        Prazo: {new Date(process.dueDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${process.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{process.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h2>
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">
                <FileText className="w-5 h-5" />
                Novo Processo
              </button>
              <button className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
                <Calendar className="w-5 h-5" />
                Agendar Revisão
              </button>
              <button className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
                <Target className="w-5 h-5" />
                Definir Meta
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Atividade Recente</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Processo "Análise ABC" atualizado</p>
                  <p className="text-xs text-gray-400">2 horas atrás</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Nova tarefa atribuída</p>
                  <p className="text-xs text-gray-400">4 horas atrás</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Prazo se aproximando</p>
                  <p className="text-xs text-gray-400">1 dia atrás</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
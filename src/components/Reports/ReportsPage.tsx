import React, { useState, useEffect } from 'react'
import {
  BarChart3, Users, FileText, Zap, TrendingUp, Clock,
  Calendar, Target, Activity, PieChart, Download, Filter,
  RefreshCw, Eye, ArrowUp, ArrowDown, Minus
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface ReportData {
  totalUsers: number
  activeUsers: number
  totalDocuments: number
  totalTokensUsed: number
  documentsToday: number
  usersGrowth: number
  documentsGrowth: number
  tokensGrowth: number
}

interface ChartData {
  labels: string[]
  values: number[]
}

export function ReportsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData>({
    totalUsers: 0,
    activeUsers: 0,
    totalDocuments: 0,
    totalTokensUsed: 0,
    documentsToday: 0,
    usersGrowth: 0,
    documentsGrowth: 0,
    tokensGrowth: 0
  })
  const [timeRange, setTimeRange] = useState('7d')
  const [documentsChart, setDocumentsChart] = useState<ChartData>({ labels: [], values: [] })
  const [usersChart, setUsersChart] = useState<ChartData>({ labels: [], values: [] })
  const [topTemplates, setTopTemplates] = useState<any[]>([])
  const [topUsers, setTopUsers] = useState<any[]>([])

  const loadReports = async () => {
    try {
      setLoading(true)

      // Carregar dados básicos
      const [usersResult, documentsResult, templatesResult] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('models').select('*')
      ])

      const users = usersResult.data || []
      const documents = documentsResult.data || []
      const templates = templatesResult.data || []

      // Calcular métricas
      const totalUsers = users.length
      const activeUsers = users.filter(u => {
        const lastWeek = new Date()
        lastWeek.setDate(lastWeek.getDate() - 7)
        return new Date(u.updated_at) > lastWeek
      }).length

      const totalDocuments = documents.length
      const totalTokensUsed = users.reduce((sum, u) => sum + (u.tokens_used || 0), 0)

      const today = new Date().toDateString()
      const documentsToday = documents.filter(d => 
        new Date(d.created_at).toDateString() === today
      ).length

      // Simular crescimento (em produção, comparar com período anterior)
      const usersGrowth = Math.floor(Math.random() * 20) - 5 // -5% a +15%
      const documentsGrowth = Math.floor(Math.random() * 30) - 10 // -10% a +20%
      const tokensGrowth = Math.floor(Math.random() * 25) - 5 // -5% a +20%

      setReportData({
        totalUsers,
        activeUsers,
        totalDocuments,
        totalTokensUsed,
        documentsToday,
        usersGrowth,
        documentsGrowth,
        tokensGrowth
      })

      // Gerar dados para gráficos (últimos 7 dias)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      })

      // Simular dados de documentos por dia
      const documentsPerDay = last7Days.map(() => Math.floor(Math.random() * 20) + 5)
      setDocumentsChart({ labels: last7Days, values: documentsPerDay })

      // Simular dados de usuários ativos por dia
      const usersPerDay = last7Days.map(() => Math.floor(Math.random() * 15) + 3)
      setUsersChart({ labels: last7Days, values: usersPerDay })

      // Top templates (simulado baseado nos templates reais)
      const templatesWithUsage = templates.map(t => ({
        ...t,
        usage: Math.floor(Math.random() * 50) + 10
      })).sort((a, b) => b.usage - a.usage).slice(0, 5)
      setTopTemplates(templatesWithUsage)

      // Top usuários (simulado baseado nos usuários reais)
      const usersWithActivity = users.map(u => ({
        ...u,
        documents_created: Math.floor(Math.random() * 25) + 5,
        tokens_consumed: u.tokens_used || Math.floor(Math.random() * 500) + 100
      })).sort((a, b) => b.documents_created - a.documents_created).slice(0, 5)
      setTopUsers(usersWithActivity)

    } catch (error) {
      console.error('Erro ao carregar relatórios:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [timeRange])

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <ArrowUp className="w-4 h-4 text-green-400" />
    if (growth < 0) return <ArrowDown className="w-4 h-4 text-red-400" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-400'
    if (growth < 0) return 'text-red-400'
    return 'text-gray-400'
  }

  const exportReport = () => {
    const csvContent = `
Relatório do Sistema - ${new Date().toLocaleDateString('pt-BR')}

Métricas Principais:
Total de Usuários,${reportData.totalUsers}
Usuários Ativos,${reportData.activeUsers}
Total de Documentos,${reportData.totalDocuments}
Tokens Consumidos,${reportData.totalTokensUsed}
Documentos Hoje,${reportData.documentsToday}

Top Templates:
${topTemplates.map(t => `${t.name},${t.usage} usos`).join('\n')}

Top Usuários:
${topUsers.map(u => `${u.name || u.email},${u.documents_created} docs`).join('\n')}
    `.trim()

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
          <h1 className="text-2xl font-bold text-white mb-2">Relatórios & Analytics</h1>
          <p className="text-gray-400">Métricas detalhadas do sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <button
            onClick={loadReports}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1">
              {getGrowthIcon(reportData.usersGrowth)}
              <span className={`text-sm ${getGrowthColor(reportData.usersGrowth)}`}>
                {Math.abs(reportData.usersGrowth)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{reportData.totalUsers}</p>
            <p className="text-sm text-gray-400 mb-2">Total de Usuários</p>
            <p className="text-xs text-gray-500">{reportData.activeUsers} ativos esta semana</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1">
              {getGrowthIcon(reportData.documentsGrowth)}
              <span className={`text-sm ${getGrowthColor(reportData.documentsGrowth)}`}>
                {Math.abs(reportData.documentsGrowth)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{reportData.totalDocuments}</p>
            <p className="text-sm text-gray-400 mb-2">Documentos Gerados</p>
            <p className="text-xs text-gray-500">{reportData.documentsToday} hoje</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1">
              {getGrowthIcon(reportData.tokensGrowth)}
              <span className={`text-sm ${getGrowthColor(reportData.tokensGrowth)}`}>
                {Math.abs(reportData.tokensGrowth)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{reportData.totalTokensUsed.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mb-2">Tokens Consumidos</p>
            <p className="text-xs text-gray-500">Todos os usuários</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">
              {Math.round((reportData.activeUsers / reportData.totalUsers) * 100)}%
            </p>
            <p className="text-sm text-gray-400 mb-2">Taxa de Atividade</p>
            <p className="text-xs text-gray-500">Usuários ativos/total</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documentos por Dia */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Documentos por Dia
          </h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {documentsChart.values.map((value, index) => (
              <div key={index} className="flex flex-col items-center gap-2 flex-1">
                <div className="text-xs text-gray-400">{value}</div>
                <div 
                  className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t w-full transition-all duration-500"
                  style={{ height: `${(value / Math.max(...documentsChart.values)) * 200}px` }}
                />
                <div className="text-xs text-gray-500 transform -rotate-45 origin-center">
                  {documentsChart.labels[index]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usuários Ativos por Dia */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Usuários Ativos por Dia
          </h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {usersChart.values.map((value, index) => (
              <div key={index} className="flex flex-col items-center gap-2 flex-1">
                <div className="text-xs text-gray-400">{value}</div>
                <div 
                  className="bg-gradient-to-t from-green-600 to-green-400 rounded-t w-full transition-all duration-500"
                  style={{ height: `${(value / Math.max(...usersChart.values)) * 200}px` }}
                />
                <div className="text-xs text-gray-500 transform -rotate-45 origin-center">
                  {usersChart.labels[index]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Templates */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Templates Mais Usados
          </h3>
          <div className="space-y-3">
            {topTemplates.map((template, index) => (
              <div key={template.id} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">{template.name}</h4>
                  <p className="text-gray-400 text-sm">{template.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{template.usage}</p>
                  <p className="text-gray-400 text-xs">usos</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Usuários */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usuários Mais Ativos
          </h3>
          <div className="space-y-3">
            {topUsers.map((user, index) => (
              <div key={user.id} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">{user.name || 'Usuário'}</h4>
                  <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{user.documents_created}</p>
                  <p className="text-gray-400 text-xs">docs</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo Detalhado */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Resumo Detalhado
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">
              {Math.round((reportData.activeUsers / reportData.totalUsers) * 100)}%
            </div>
            <p className="text-gray-300 font-medium">Taxa de Engajamento</p>
            <p className="text-gray-500 text-sm">Usuários ativos vs total</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {Math.round(reportData.totalDocuments / reportData.totalUsers)}
            </div>
            <p className="text-gray-300 font-medium">Docs por Usuário</p>
            <p className="text-gray-500 text-sm">Média de documentos</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">
              {Math.round(reportData.totalTokensUsed / reportData.totalUsers)}
            </div>
            <p className="text-gray-300 font-medium">Tokens por Usuário</p>
            <p className="text-gray-500 text-sm">Consumo médio</p>
          </div>
        </div>
      </div>
    </div>
  )
}
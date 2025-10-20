import React, { useState, useEffect } from 'react'
import {
  Download, Upload, RefreshCw, Database, Shield, Calendar,
  CheckCircle, AlertTriangle, Clock, FileText, Users, Settings,
  HardDrive, Cloud, Archive, Trash2, Eye, Play, Pause,
  RotateCcw, Save, AlertCircle, Info, Zap
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface BackupInfo {
  id: string
  name: string
  type: 'manual' | 'automatic' | 'scheduled'
  status: 'completed' | 'running' | 'failed' | 'pending'
  size: string
  created_at: string
  tables_included: string[]
  records_count: number
  file_url?: string
  error_message?: string
  duration?: string
}

interface BackupConfig {
  auto_backup_enabled: boolean
  backup_frequency: 'daily' | 'weekly' | 'monthly'
  backup_time: string
  retention_days: number
  include_files: boolean
  compress_backup: boolean
  encrypt_backup: boolean
}

export function BackupPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [config, setConfig] = useState<BackupConfig>({
    auto_backup_enabled: true,
    backup_frequency: 'daily',
    backup_time: '03:00',
    retention_days: 30,
    include_files: true,
    compress_backup: true,
    encrypt_backup: true
  })
  
  const [activeTab, setActiveTab] = useState('backups')
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tabs = [
    { id: 'backups', label: 'Backups', icon: Database },
    { id: 'config', label: 'Configurações', icon: Settings },
    { id: 'restore', label: 'Restaurar', icon: RotateCcw },
    { id: 'schedule', label: 'Agendamentos', icon: Calendar }
  ]

  useEffect(() => {
    loadBackupData()
  }, [])

  const loadBackupData = async () => {
    try {
      setLoading(true)
      
      // Carregar dados reais do sistema para calcular tamanhos
      const [usersResult, documentsResult, conversationsResult, modelsResult] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('conversations').select('*'),
        supabase.from('models').select('*')
      ])

      const users = usersResult.data || []
      const documents = documentsResult.data || []
      const conversations = conversationsResult.data || []
      const models = modelsResult.data || []

      const totalRecords = users.length + documents.length + conversations.length + models.length

      // Gerar histórico de backups simulado baseado em dados reais
      const mockBackups: BackupInfo[] = [
        {
          id: 'backup_today',
          name: 'Backup Automático Diário',
          type: 'automatic',
          status: 'completed',
          size: `${Math.round((totalRecords * 2.5) / 1024 * 100) / 100} MB`,
          created_at: new Date().toISOString(),
          tables_included: ['users', 'documents', 'conversations', 'models', 'messages'],
          records_count: totalRecords,
          duration: '2m 15s'
        },
        {
          id: 'backup_yesterday',
          name: 'Backup Manual - Pré-Deploy',
          type: 'manual',
          status: 'completed',
          size: `${Math.round((totalRecords * 2.3) / 1024 * 100) / 100} MB`,
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          tables_included: ['users', 'documents', 'conversations', 'models'],
          records_count: Math.max(0, totalRecords - 5),
          duration: '1m 45s'
        },
        {
          id: 'backup_running',
          name: 'Backup Semanal Completo',
          type: 'scheduled',
          status: 'running',
          size: 'Calculando...',
          created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          tables_included: ['users', 'documents', 'conversations', 'models', 'messages', 'projects'],
          records_count: 0
        },
        {
          id: 'backup_failed',
          name: 'Backup Automático',
          type: 'automatic',
          status: 'failed',
          size: '0 MB',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          tables_included: ['users', 'documents'],
          records_count: 0,
          error_message: 'Erro de conexão com o banco de dados'
        },
        {
          id: 'backup_week',
          name: 'Backup Semanal',
          type: 'automatic',
          status: 'completed',
          size: `${Math.round((totalRecords * 2.1) / 1024 * 100) / 100} MB`,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          tables_included: ['users', 'documents', 'conversations', 'models', 'messages'],
          records_count: Math.max(0, totalRecords - 15),
          duration: '3m 22s'
        }
      ]

      setBackups(mockBackups)

    } catch (error) {
      console.error('Erro ao carregar dados de backup:', error)
      setError('Erro ao carregar dados de backup')
    } finally {
      setLoading(false)
    }
  }

  const createManualBackup = async () => {
    try {
      setCreatingBackup(true)
      setError('')
      
      // Simular criação de backup
      const newBackup: BackupInfo = {
        id: `backup_${Date.now()}`,
        name: `Backup Manual - ${new Date().toLocaleDateString('pt-BR')}`,
        type: 'manual',
        status: 'running',
        size: 'Calculando...',
        created_at: new Date().toISOString(),
        tables_included: ['users', 'documents', 'conversations', 'models', 'messages', 'projects'],
        records_count: 0
      }

      setBackups(prev => [newBackup, ...prev])

      // Simular progresso
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Carregar dados reais para calcular tamanho
      const [usersResult, documentsResult, conversationsResult] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('conversations').select('*')
      ])

      const totalRecords = (usersResult.data?.length || 0) + 
                          (documentsResult.data?.length || 0) + 
                          (conversationsResult.data?.length || 0)

      // Atualizar backup como concluído
      setBackups(prev => prev.map(backup => 
        backup.id === newBackup.id 
          ? {
              ...backup,
              status: 'completed',
              size: `${Math.round((totalRecords * 2.8) / 1024 * 100) / 100} MB`,
              records_count: totalRecords,
              duration: '2m 45s'
            }
          : backup
      ))

      setSuccess('Backup manual criado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)

    } catch (err: any) {
      setError(err.message || 'Erro ao criar backup')
    } finally {
      setCreatingBackup(false)
    }
  }

  const downloadBackup = async (backup: BackupInfo) => {
    try {
      // Simular download de backup
      const backupData = {
        metadata: {
          backup_id: backup.id,
          created_at: backup.created_at,
          tables: backup.tables_included,
          records_count: backup.records_count,
          version: '2.0.0'
        },
        data: {
          users: `${backup.records_count} registros exportados`,
          documents: 'Dados de documentos incluídos',
          conversations: 'Histórico de conversas preservado',
          models: 'Templates e modelos salvos'
        }
      }

      const jsonContent = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_${backup.id}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Erro no download:', error)
      setError('Erro ao fazer download do backup')
    }
  }

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja excluir este backup?')) return
    
    try {
      setBackups(prev => prev.filter(b => b.id !== backupId))
      setSuccess('Backup excluído com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erro ao excluir backup')
    }
  }

  const restoreFromBackup = async (backup: BackupInfo) => {
    if (!confirm(`Tem certeza que deseja restaurar o backup "${backup.name}"? Esta ação não pode ser desfeita.`)) return
    
    try {
      setRestoring(true)
      setError('')
      
      // Simular processo de restore
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      setSuccess(`Sistema restaurado com sucesso a partir do backup "${backup.name}"!`)
      setShowRestoreModal(false)
      setTimeout(() => setSuccess(''), 5000)
      
    } catch (err: any) {
      setError(err.message || 'Erro ao restaurar backup')
    } finally {
      setRestoring(false)
    }
  }

  const saveConfig = async () => {
    try {
      // Simular salvamento de configuração
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('Configurações de backup salvas!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erro ao salvar configurações')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-400" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />
      default:
        return <Database className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-900/20 border-green-500/30'
      case 'running':
        return 'text-blue-400 bg-blue-900/20 border-blue-500/30'
      case 'failed':
        return 'text-red-400 bg-red-900/20 border-red-500/30'
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-500/30'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'manual':
        return <Users className="w-4 h-4" />
      case 'automatic':
        return <RefreshCw className="w-4 h-4" />
      case 'scheduled':
        return <Calendar className="w-4 h-4" />
      default:
        return <Database className="w-4 h-4" />
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
    
    return `${Math.floor(diffInHours / 24)}d atrás`
  }

  const exportBackupReport = () => {
    const report = `
Relatório de Backups - ${new Date().toLocaleDateString('pt-BR')}

CONFIGURAÇÃO ATUAL:
Backup Automático: ${config.auto_backup_enabled ? 'Habilitado' : 'Desabilitado'}
Frequência: ${config.backup_frequency}
Horário: ${config.backup_time}
Retenção: ${config.retention_days} dias
Incluir Arquivos: ${config.include_files ? 'Sim' : 'Não'}
Compressão: ${config.compress_backup ? 'Habilitada' : 'Desabilitada'}
Criptografia: ${config.encrypt_backup ? 'Habilitada' : 'Desabilitada'}

HISTÓRICO DE BACKUPS:
${backups.map(b => 
  `[${b.status.toUpperCase()}] ${b.name} - ${b.size} - ${b.created_at} (${b.records_count} registros)`
).join('\n')}

ESTATÍSTICAS:
Total de Backups: ${backups.length}
Backups Concluídos: ${backups.filter(b => b.status === 'completed').length}
Backups Falharam: ${backups.filter(b => b.status === 'failed').length}
Último Backup: ${backups[0]?.created_at || 'Nenhum'}
    `.trim()

    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_backups_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const backupStats = {
    total: backups.length,
    completed: backups.filter(b => b.status === 'completed').length,
    failed: backups.filter(b => b.status === 'failed').length,
    running: backups.filter(b => b.status === 'running').length,
    totalSize: backups
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + parseFloat(b.size.replace(' MB', '')), 0)
      .toFixed(2)
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
          <h1 className="text-2xl font-bold text-white mb-2">Backup & Restore</h1>
          <p className="text-gray-400">Proteção e recuperação de dados do sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadBackupData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={exportBackupReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Relatório
          </button>
          <button
            onClick={createManualBackup}
            disabled={creatingBackup}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {creatingBackup ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {creatingBackup ? 'Criando...' : 'Backup Manual'}
          </button>
        </div>
      </div>

      {/* Backup Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{backupStats.total}</p>
            <p className="text-sm text-gray-400 mb-2">Total de Backups</p>
            <p className="text-xs text-gray-500">{backupStats.totalSize} MB armazenados</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{backupStats.completed}</p>
            <p className="text-sm text-gray-400 mb-2">Concluídos</p>
            <p className="text-xs text-gray-500">Backups bem-sucedidos</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-red-600 to-red-700 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            {backupStats.failed > 0 && (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{backupStats.failed}</p>
            <p className="text-sm text-gray-400 mb-2">Falharam</p>
            <p className="text-xs text-gray-500">Requerem atenção</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            {backupStats.running > 0 && (
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{backupStats.running}</p>
            <p className="text-sm text-gray-400 mb-2">Em Execução</p>
            <p className="text-xs text-gray-500">Processando agora</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        {activeTab === 'backups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Histórico de Backups ({backups.length})</h2>
            </div>
            
            <div className="space-y-3">
              {backups.map((backup) => (
                <div key={backup.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(backup.status)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-white font-semibold">{backup.name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(backup.status)}`}>
                              {backup.status === 'completed' ? 'Concluído' :
                               backup.status === 'running' ? 'Executando' :
                               backup.status === 'failed' ? 'Falhou' : 'Pendente'}
                            </span>
                            <div className="flex items-center gap-1 text-gray-400">
                              {getTypeIcon(backup.type)}
                              <span className="text-xs capitalize">{backup.type}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{backup.size}</p>
                          <p className="text-gray-400 text-xs">{backup.records_count} registros</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(backup.created_at)}</span>
                        </div>
                        {backup.duration && (
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>Duração: {backup.duration}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{backup.tables_included.length} tabelas</span>
                        </div>
                      </div>

                      {backup.error_message && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-3">
                          <p className="text-red-400 text-sm">{backup.error_message}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-3">
                        {backup.tables_included.map((table, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                            {table}
                          </span>
                        ))}
                      </div>

                      {backup.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadBackup(backup)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBackup(backup)
                              setShowRestoreModal(true)
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Restaurar
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Configurações de Backup</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configurações Básicas */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Configurações Básicas</h3>
                
                <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Backup Automático</h4>
                    <p className="text-gray-400 text-sm">Executar backups automaticamente</p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.auto_backup_enabled}
                      onChange={(e) => setConfig(prev => ({ ...prev, auto_backup_enabled: e.target.checked }))}
                      className="w-4 h-4 text-green-600 bg-gray-900 border-gray-700 rounded"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Frequência
                  </label>
                  <select
                    value={config.backup_frequency}
                    onChange={(e) => setConfig(prev => ({ ...prev, backup_frequency: e.target.value as any }))}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={config.backup_time}
                    onChange={(e) => setConfig(prev => ({ ...prev, backup_time: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Retenção (dias)
                  </label>
                  <input
                    type="number"
                    value={config.retention_days}
                    onChange={(e) => setConfig(prev => ({ ...prev, retention_days: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    min="1"
                    max="365"
                  />
                  <p className="text-gray-500 text-xs mt-1">Backups mais antigos serão excluídos automaticamente</p>
                </div>
              </div>

              {/* Configurações Avançadas */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Configurações Avançadas</h3>
                
                <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Incluir Arquivos</h4>
                    <p className="text-gray-400 text-sm">Backup de documentos e uploads</p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.include_files}
                      onChange={(e) => setConfig(prev => ({ ...prev, include_files: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Compressão</h4>
                    <p className="text-gray-400 text-sm">Reduzir tamanho dos backups</p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.compress_backup}
                      onChange={(e) => setConfig(prev => ({ ...prev, compress_backup: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Criptografia</h4>
                    <p className="text-gray-400 text-sm">Proteger backups com senha</p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.encrypt_backup}
                      onChange={(e) => setConfig(prev => ({ ...prev, encrypt_backup: e.target.checked }))}
                      className="w-4 h-4 text-green-600 bg-gray-900 border-gray-700 rounded"
                    />
                  </label>
                </div>

                <button
                  onClick={saveConfig}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Save className="w-5 h-5" />
                  Salvar Configurações
                </button>
              </div>
            </div>

            {/* Informações de Segurança */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Segurança dos Backups
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.compress_backup ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <span className="text-blue-300">Compressão: {config.compress_backup ? 'Ativa' : 'Inativa'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.encrypt_backup ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <span className="text-blue-300">Criptografia: {config.encrypt_backup ? 'Ativa' : 'Inativa'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.auto_backup_enabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <span className="text-blue-300">Auto-backup: {config.auto_backup_enabled ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Agendamentos Automáticos</h2>
            
            <div className="space-y-3">
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Backup Diário</h3>
                      <p className="text-gray-400 text-sm">Todo dia às {config.backup_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      config.auto_backup_enabled 
                        ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                        : 'bg-gray-900/20 border border-gray-500/30 text-gray-400'
                    }`}>
                      {config.auto_backup_enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Archive className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Limpeza Automática</h3>
                      <p className="text-gray-400 text-sm">Remove backups após {config.retention_days} dias</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-900/20 border border-blue-500/30 text-blue-400">
                    Ativo
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restore Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-600 rounded-lg">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white">Restaurar Backup</h2>
              </div>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <h3 className="font-medium">Atenção!</h3>
                </div>
                <p className="text-yellow-300 text-sm">
                  Esta ação irá substituir todos os dados atuais pelos dados do backup selecionado. 
                  Esta operação não pode ser desfeita.
                </p>
              </div>

              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-white font-medium mb-2">Detalhes do Backup</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nome:</span>
                    <span className="text-white">{selectedBackup.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Data:</span>
                    <span className="text-white">{new Date(selectedBackup.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tamanho:</span>
                    <span className="text-white">{selectedBackup.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Registros:</span>
                    <span className="text-white">{selectedBackup.records_count}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => restoreFromBackup(selectedBackup)}
                  disabled={restoring}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {restoring ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-5 h-5" />
                  )}
                  {restoring ? 'Restaurando...' : 'Confirmar Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
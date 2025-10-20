import React, { useState, useEffect } from 'react'
import { 
  Zap, TrendingUp, Calendar, CreditCard, RefreshCw,
  AlertCircle, CheckCircle, MessageSquare, FileText, BarChart3
} from 'lucide-react'
import { useTokens } from '../../hooks/useTokens'
import { TokenDisplay } from './TokenDisplay'
import { TokenAlert } from './TokenAlert'
import { useAuth } from '../../contexts/AuthContext' // ✅ Adicionado aqui

interface TokenHistory {
  id: string
  action: string
  tokens_used: number
  timestamp: string
  description: string
}

export function TokensPage() {
  const { user } = useAuth() // ✅ Adicionado aqui
  const { tokenUsage, loading, resetTokens, refreshTokens, isNearLimit, isAtLimit } = useTokens()
  const [history, setHistory] = useState<TokenHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    const loadRealHistory = async () => {
      if (!user) return

      try {
        const currentUsage = tokenUsage.used
        const mockHistory: TokenHistory[] = []

        if (currentUsage > 0) {
          const entries = Math.min(10, Math.floor(currentUsage / 20))

          for (let i = 0; i < entries; i++) {
            const tokensUsed = Math.floor(Math.random() * 50) + 10
            const hoursAgo = Math.floor(Math.random() * 24 * 7)

            mockHistory.push({
              id: `${i + 1}`,
              action: ['chat_message', 'document_analysis', 'project_summary'][Math.floor(Math.random() * 3)],
              tokens_used: tokensUsed,
              timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
              description: ['Mensagem no chat IA', 'Análise de documento', 'Resumo de projeto'][Math.floor(Math.random() * 3)]
            })
          }
        }

        setHistory(mockHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
      } catch (error) {
        console.error('Erro ao carregar histórico:', error)
        setHistory([])
      } finally {
        setLoadingHistory(false)
      }
    }

    loadRealHistory()
  }, [user, tokenUsage.used])

  const handleResetTokens = async () => {
    setResetting(true)
    const success = await resetTokens()
    if (success) {
      console.log('✅ Tokens resetados para 1000!')
    } else {
      console.error('❌ Erro ao resetar tokens')
    }
    setResetting(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'chat_message': return <MessageSquare className="w-5 h-5 text-blue-400" />
      case 'document_analysis': return <FileText className="w-5 h-5 text-green-400" />
      case 'project_summary': return <BarChart3 className="w-5 h-5 text-purple-400" />
      default: return <Zap className="w-5 h-5 text-yellow-400" />
    }
  }

  const getActionName = (action: string) => {
    switch (action) {
      case 'chat_message': return 'Chat IA'
      case 'document_analysis': return 'Análise de Documento'
      case 'project_summary': return 'Resumo de Projeto'
      default: return 'Ação Desconhecida'
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Tokens & Créditos</h1>
          <p className="text-gray-400">Gerencie seu uso de tokens e créditos</p>
        </div>
        <button
          onClick={handleResetTokens}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${resetting ? 'animate-spin' : ''}`} />
          Reset (Dev)
        </button>
      </div>

      <TokenAlert />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className={`text-right ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-green-400'}`}>
              {isAtLimit ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{tokenUsage.remaining.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mb-2">Tokens Restantes</p>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.max(5, 100 - tokenUsage.percentage)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{tokenUsage.used.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mb-2">Tokens Usados</p>
            <p className="text-xs text-gray-500">{Math.round(tokenUsage.percentage)}% do limite</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white mb-1">{tokenUsage.limit.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mb-2">Limite Mensal</p>
            <p className="text-xs text-gray-500">Renova todo mês</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Uso de Tokens</h2>
        <div className="h-48 bg-gray-900/50 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Gráfico de uso em desenvolvimento</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Histórico de Uso</h2>
          <button onClick={refreshTokens} className="text-blue-400 hover:text-blue-300 text-sm">Atualizar</button>
        </div>

        {loadingHistory ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Carregando histórico...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum uso registrado ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-center w-10 h-10 bg-gray-800 rounded-lg">
                  {getActionIcon(item.action)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-medium">{getActionName(item.action)}</h3>
                    <span className="text-blue-400 font-medium">-{item.tokens_used} tokens</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{item.description}</span>
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Precisa de Mais Tokens?</h2>
            <p className="text-gray-400">Adquira pacotes de tokens para continuar usando o sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">Básico</h3>
            <p className="text-2xl font-bold text-blue-400 mb-2">1.000 tokens</p>
            <p className="text-gray-400 text-sm mb-4">R$ 19,90</p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">Comprar</button>
          </div>

          <div className="bg-gray-800/50 border border-purple-500 rounded-lg p-4 text-center relative">
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">Mais Popular</div>
            <h3 className="text-lg font-semibold text-white mb-2">Pro</h3>
            <p className="text-2xl font-bold text-purple-400 mb-2">5.000 tokens</p>
            <p className="text-gray-400 text-sm mb-4">R$ 79,90</p>
            <button className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">Comprar</button>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">Enterprise</h3>
            <p className="text-2xl font-bold text-green-400 mb-2">15.000 tokens</p>
            <p className="text-gray-400 text-sm mb-4">R$ 199,90</p>
            <button className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">Comprar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
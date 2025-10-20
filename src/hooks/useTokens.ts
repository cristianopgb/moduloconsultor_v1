import { useState, useEffect } from 'react'
import { supabase, User } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface TokenUsage {
  used: number
  limit: number
  remaining: number
  percentage: number
}

export function useTokens() {
  const { user } = useAuth()
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    used: 0,
    limit: 1000,
    remaining: 1000,
    percentage: 0
  })
  const [loading, setLoading] = useState(true)

  const loadTokenUsage = async () => {
    if (!user) {
      console.log('⚠️ [useTokens] Sem usuário, pulando carregamento')
      return
    }

    try {
      console.log('🔄 [useTokens] Carregando tokens para:', user.id)

      // Verificar se há sessão ativa
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        console.error('❌ [useTokens] Sem sessão ativa!')
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('tokens_used, tokens_limit')
        .eq('id', user.id)
        .maybeSingle()

      console.log('📊 [useTokens] Resposta:', { data, error })

      if (!data) {
        console.warn('⚠️ [useTokens] Usuário não encontrado na tabela users:', user.id)
        return
      }

      if (error) throw error

      if (data) {
        const used = data.tokens_used || 0
        const limit = data.tokens_limit || 1000
        const remaining = Math.max(0, limit - used)
        const percentage = limit > 0 ? (used / limit) * 100 : 0

        setTokenUsage({
          used,
          limit,
          remaining,
          percentage
        })
      }
    } catch (error) {
      console.error('Erro ao carregar tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  const consumeTokens = async (amount: number): Promise<boolean> => {
    if (!user) return false

    try {
      // Verificar se tem tokens suficientes
      if (tokenUsage.remaining < amount) {
        console.log(`Tokens insuficientes: precisa ${amount}, tem ${tokenUsage.remaining}`)
        return false
      }

      const newUsed = tokenUsage.used + amount
      console.log(`Consumindo ${amount} tokens. Usado: ${tokenUsage.used} -> ${newUsed}`)

      const { error } = await supabase
        .from('users')
        .update({ tokens_used: newUsed })
        .eq('id', user.id)

      if (error) throw error

      // Atualizar estado local
      const remaining = Math.max(0, tokenUsage.limit - newUsed)
      const percentage = tokenUsage.limit > 0 ? (newUsed / tokenUsage.limit) * 100 : 0

      setTokenUsage(prev => ({
        ...prev,
        used: newUsed,
        remaining,
        percentage
      }))

      console.log(`Tokens atualizados: ${remaining} restantes (${Math.round(percentage)}%)`)
      return true
    } catch (error) {
      console.error('Erro ao consumir tokens:', error)
      return false
    }
  }

  const resetTokens = async () => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('users')
        .update({ tokens_used: 0 })
        .eq('id', user.id)

      if (error) throw error

      setTokenUsage(prev => ({
        ...prev,
        used: 0,
        remaining: prev.limit,
        percentage: 0
      }))

      console.log('🔄 Tokens resetados com sucesso!')
      return true
    } catch (error) {
      console.error('Erro ao resetar tokens:', error)
      return false
    }
  }

  useEffect(() => {
    loadTokenUsage()
  }, [user])

  return {
    tokenUsage,
    loading,
    consumeTokens,
    resetTokens,
    refreshTokens: loadTokenUsage,
    hasTokens: tokenUsage.remaining > 0,
    isNearLimit: tokenUsage.percentage >= 80,
    isAtLimit: tokenUsage.remaining === 0
  }
}
import { useState, useEffect, useCallback } from 'react'
import { getGeniusCredits, addGeniusCredits, GeniusCreditsInfo } from '../lib/geniusCredits'

interface UseGeniusCreditsReturn {
  credits: GeniusCreditsInfo | null
  loading: boolean
  error: string | null
  addCredits: (amount: number) => Promise<boolean>
  refreshCredits: () => Promise<void>
}

export function useGeniusCredits(userId: string | undefined): UseGeniusCreditsReturn {
  const [credits, setCredits] = useState<GeniusCreditsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    if (!userId) {
      setCredits(null)
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await getGeniusCredits(userId)
      setCredits(data)
    } catch (err) {
      console.error('[useGeniusCredits] Error:', err)
      setError('Erro ao carregar créditos')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const refreshCredits = useCallback(async () => {
    await fetchCredits()
  }, [fetchCredits])

  const addCreditsHandler = useCallback(async (amount: number): Promise<boolean> => {
    if (!userId) return false

    try {
      setError(null)
      const result = await addGeniusCredits(userId, amount)

      if (result.success) {
        await fetchCredits()
        return true
      } else {
        setError(result.error || 'Erro ao adicionar créditos')
        return false
      }
    } catch (err) {
      console.error('[useGeniusCredits] Add error:', err)
      setError('Erro ao adicionar créditos')
      return false
    }
  }, [userId, fetchCredits])

  useEffect(() => {
    fetchCredits()

    const interval = setInterval(() => {
      fetchCredits()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchCredits])

  return {
    credits,
    loading,
    error,
    addCredits: addCreditsHandler,
    refreshCredits
  }
}

// src/lib/geniusCredits.ts
// Gerenciamento de créditos Genius

import { supabase } from './supabase'

export interface GeniusCreditsInfo {
  credits_available: number
  credits_used: number
  last_recharge_date: string | null
  last_recharge_amount: number
}

/**
 * Buscar créditos Genius disponíveis do usuário
 */
export async function getGeniusCredits(userId: string): Promise<GeniusCreditsInfo | null> {
  try {
    const { data, error } = await supabase.rpc('get_genius_credits', {
      p_user_id: userId
    })

    if (error) {
      console.error('[GeniusCredits] Error fetching credits:', error)
      return null
    }

    return data as GeniusCreditsInfo
  } catch (error) {
    console.error('[GeniusCredits] Exception:', error)
    return null
  }
}

/**
 * Verificar se usuário tem créditos suficientes
 */
export async function hasGeniusCredits(userId: string, required: number = 1): Promise<boolean> {
  const credits = await getGeniusCredits(userId)
  if (!credits) return false
  return credits.credits_available >= required
}

/**
 * Consumir 1 crédito Genius (chamado após criar tarefa)
 * Nota: Esta função deve ser chamada apenas pelo service_role via webhook
 */
export async function consumeGeniusCredit(
  userId: string,
  taskId: string
): Promise<{ success: boolean; error?: string; credits_remaining?: number }> {
  try {
    const { data, error } = await supabase.rpc('consume_genius_credit', {
      p_user_id: userId,
      p_task_id: taskId
    })

    if (error) {
      console.error('[GeniusCredits] Error consuming credit:', error)
      return { success: false, error: error.message }
    }

    if (!data.success) {
      return {
        success: false,
        error: data.message || 'Failed to consume credit'
      }
    }

    return {
      success: true,
      credits_remaining: data.credits_remaining
    }
  } catch (error: any) {
    console.error('[GeniusCredits] Exception:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Adicionar créditos ao usuário (recarga/compra)
 * Nota: Deve ser chamado apenas por masters ou sistema de pagamento
 */
export async function addGeniusCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string; credits_total?: number }> {
  try {
    const { data, error } = await supabase.rpc('add_genius_credits', {
      p_user_id: userId,
      p_amount: amount
    })

    if (error) {
      console.error('[GeniusCredits] Error adding credits:', error)
      return { success: false, error: error.message }
    }

    if (!data.success) {
      return {
        success: false,
        error: data.message || 'Failed to add credits'
      }
    }

    return {
      success: true,
      credits_total: data.credits_total
    }
  } catch (error: any) {
    console.error('[GeniusCredits] Exception:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Formatar mensagem de erro de créditos
 */
export function getCreditsErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    no_credits_record: 'Você ainda não possui créditos Genius. Entre em contato para ativar.',
    insufficient_credits: 'Créditos Genius insuficientes. Recarregue para continuar.',
    invalid_amount: 'Quantidade inválida de créditos.',
  }

  return messages[error] || 'Erro ao processar créditos Genius. Tente novamente.'
}

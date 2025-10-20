import React from 'react'
import { AlertTriangle, XCircle, CreditCard } from 'lucide-react'
import { useTokens } from '../../hooks/useTokens'

export function TokenAlert() {
  const { tokenUsage, isNearLimit, isAtLimit } = useTokens()

  if (!isNearLimit && !isAtLimit) return null

  return (
    <div className={`p-4 rounded-lg border ${
      isAtLimit 
        ? 'bg-red-900/20 border-red-500/30 text-red-400' 
        : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'
    }`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isAtLimit ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="font-medium mb-1">
            {isAtLimit ? 'Tokens Esgotados' : 'Tokens Quase Esgotados'}
          </h3>
          
          <p className="text-sm opacity-90 mb-3">
            {isAtLimit 
              ? `Você usou todos os seus ${tokenUsage.limit.toLocaleString()} tokens disponíveis. Para continuar usando o sistema, você precisa adquirir mais créditos.`
              : `Você já usou ${tokenUsage.used.toLocaleString()} de ${tokenUsage.limit.toLocaleString()} tokens (${Math.round(tokenUsage.percentage)}%). Considere adquirir mais créditos.`
            }
          </p>
          
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
            <CreditCard className="w-4 h-4" />
            Adquirir Mais Tokens
          </button>
        </div>
      </div>
    </div>
  )
}
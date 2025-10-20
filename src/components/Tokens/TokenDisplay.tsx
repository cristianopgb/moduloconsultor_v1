import React from 'react'
import { Zap, AlertTriangle, XCircle } from 'lucide-react'
import { useTokens } from '../../hooks/useTokens'

interface TokenDisplayProps {
  showDetails?: boolean
  className?: string
}

export function TokenDisplay({ showDetails = false, className = '' }: TokenDisplayProps) {
  const { tokenUsage, loading, isNearLimit, isAtLimit } = useTokens()

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Carregando...</span>
      </div>
    )
  }

  const getStatusColor = () => {
    if (isAtLimit) return 'text-red-400'
    if (isNearLimit) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getStatusIcon = () => {
    if (isAtLimit) return <XCircle className="w-4 h-4" />
    if (isNearLimit) return <AlertTriangle className="w-4 h-4" />
    return <Zap className="w-4 h-4" />
  }

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-red-500'
    if (isNearLimit) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={getStatusColor()}>
        {getStatusIcon()}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white font-medium">
            {tokenUsage.remaining.toLocaleString()} tokens
          </span>
          {showDetails && (
            <span className="text-gray-400 text-xs">
              {tokenUsage.used.toLocaleString()}/{tokenUsage.limit.toLocaleString()}
            </span>
          )}
        </div>
        
        {showDetails && (
          <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${Math.min(100, tokenUsage.percentage)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
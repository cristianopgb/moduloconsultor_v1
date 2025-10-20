import React, { useState } from 'react'
import { X, Zap, Plus, Minus } from 'lucide-react'
import { User } from '../../lib/supabase'

interface AddTokensModalProps {
  user: User
  onSave: (userId: string, amount: number, reason: string) => Promise<void>
  onClose: () => void
}

export function AddTokensModal({ user, onSave, onClose }: AddTokensModalProps) {
  const [amount, setAmount] = useState(1000)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const presetAmounts = [500, 1000, 2500, 5000, 10000]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (amount <= 0) {
      setError('Quantidade deve ser maior que zero')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSave(user.id, amount, reason)
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar tokens')
    } finally {
      setLoading(false)
    }
  }

  const adjustAmount = (delta: number) => {
    setAmount(prev => Math.max(0, prev + delta))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-600 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Adicionar Tokens</h2>
              <p className="text-gray-400 text-sm">{user.name || user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Status */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-white font-medium mb-2">Status Atual</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Tokens Usados:</span>
              <span className="text-white">{user.tokens_used.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Limite Atual:</span>
              <span className="text-white">{user.tokens_limit.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Restantes:</span>
              <span className="text-white">{(user.tokens_limit - user.tokens_used).toLocaleString()}</span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantidade de Tokens
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => adjustAmount(-100)}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                min="1"
                step="100"
                className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-center"
              />
              <button
                type="button"
                onClick={() => adjustAmount(100)}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preset Amounts */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Valores Rápidos
            </label>
            <div className="grid grid-cols-3 gap-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    amount === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* New Total Preview */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-400 font-medium mb-2">Novo Limite</h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Limite atual:</span>
              <span className="text-white">{user.tokens_limit.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Adicionando:</span>
              <span className="text-green-400">+{amount.toLocaleString()}</span>
            </div>
            <div className="border-t border-blue-500/30 mt-2 pt-2 flex items-center justify-between">
              <span className="text-blue-400 font-medium">Novo limite:</span>
              <span className="text-blue-400 font-bold text-lg">
                {(user.tokens_limit + amount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Motivo (Opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Upgrade de plano, bônus promocional, compensação..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || amount <= 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              {loading ? 'Adicionando...' : 'Adicionar Tokens'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
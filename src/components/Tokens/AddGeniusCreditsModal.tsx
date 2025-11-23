import React, { useState } from 'react'
import { X, Sparkles, Plus } from 'lucide-react'

interface AddGeniusCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (amount: number) => Promise<boolean>
  currentCredits: number
}

export function AddGeniusCreditsModal({
  isOpen,
  onClose,
  onAdd,
  currentCredits
}: AddGeniusCreditsModalProps) {
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  if (!isOpen) return null

  const handleAdd = async () => {
    if (amount < 1 || amount > 1000) {
      alert('Por favor, insira um valor entre 1 e 1000 créditos')
      return
    }

    setLoading(true)
    const success = await onAdd(amount)

    if (success) {
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onClose()
        setAmount(10)
      }, 2000)
    } else {
      alert('Erro ao adicionar créditos. Tente novamente.')
    }

    setLoading(false)
  }

  const quickAdd = (value: number) => {
    setAmount(value)
  }

  const totalAfter = currentCredits + amount

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Adicionar Créditos Genius</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Créditos Adicionados!</h3>
            <p className="text-gray-400">{amount} créditos foram adicionados com sucesso</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-4">
                Cada crédito = 1 uso do Genius. Adicione créditos para continuar usando análises avançadas.
              </p>

              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Créditos atuais:</span>
                  <span className="text-white font-semibold">{currentCredits}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">A adicionar:</span>
                  <span className="text-yellow-400 font-semibold">+{amount}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">Total após:</span>
                    <span className="text-green-400 font-bold text-lg">{totalAfter}</span>
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantidade de créditos
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 0)))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500"
              />

              <div className="grid grid-cols-4 gap-2 mt-3">
                {[5, 10, 50, 100].map((value) => (
                  <button
                    key={value}
                    onClick={() => quickAdd(value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      amount === value
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    +{value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={loading || amount < 1}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Adicionar {amount} Créditos
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

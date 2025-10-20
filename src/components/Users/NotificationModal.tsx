import React, { useState } from 'react'
import { X, Bell, Send, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { User } from '../../lib/supabase'

interface NotificationModalProps {
  user: User
  onSend: (message: string, type: 'info' | 'warning' | 'success') => void
  onClose: () => void
}

export function NotificationModal({ user, onSend, onClose }: NotificationModalProps) {
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'info' | 'warning' | 'success'>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const notificationTypes = [
    { 
      value: 'info', 
      label: 'Informação', 
      icon: Info, 
      color: 'text-blue-400 bg-blue-600',
      description: 'Notificação geral ou informativa'
    },
    { 
      value: 'warning', 
      label: 'Aviso', 
      icon: AlertTriangle, 
      color: 'text-yellow-400 bg-yellow-600',
      description: 'Alerta importante que requer atenção'
    },
    { 
      value: 'success', 
      label: 'Sucesso', 
      icon: CheckCircle, 
      color: 'text-green-400 bg-green-600',
      description: 'Confirmação ou boa notícia'
    }
  ]

  const quickMessages = [
    'Seus tokens estão acabando. Considere fazer um upgrade.',
    'Novo template disponível na sua categoria preferida.',
    'Sua assinatura será renovada em breve.',
    'Parabéns! Você atingiu um marco importante.',
    'Lembrete: Você tem documentos pendentes para revisar.',
    'Promoção especial: 50% de desconto no upgrade do plano.'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim()) {
      setError('Mensagem é obrigatória')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Simular envio
      await new Promise(resolve => setTimeout(resolve, 1000))
      onSend(message.trim(), type)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar notificação')
    } finally {
      setLoading(false)
    }
  }

  const selectedTypeInfo = notificationTypes.find(t => t.value === type)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Enviar Notificação</h2>
              <p className="text-gray-400 text-sm">Para: {user.name || user.email}</p>
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
          {/* Tipo de Notificação */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Tipo de Notificação
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {notificationTypes.map((notifType) => {
                const Icon = notifType.icon
                return (
                  <button
                    key={notifType.value}
                    type="button"
                    onClick={() => setType(notifType.value as any)}
                    className={`p-4 border rounded-xl transition-all ${
                      type === notifType.value
                        ? 'border-blue-500 bg-blue-600/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 ${notifType.color}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-white font-medium text-sm mb-1">{notifType.label}</h3>
                    <p className="text-gray-400 text-xs">{notifType.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mensagens Rápidas */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Mensagens Rápidas
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
              {quickMessages.map((quickMsg, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setMessage(quickMsg)}
                  className="text-left p-3 bg-gray-900/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                >
                  {quickMsg}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem Personalizada */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mensagem Personalizada
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem personalizada..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 resize-none"
              required
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-500 text-xs">
                {message.length}/500 caracteres
              </span>
              {selectedTypeInfo && (
                <div className="flex items-center gap-2 text-xs">
                  <selectedTypeInfo.icon className={`w-3 h-3 ${selectedTypeInfo.color.split(' ')[0]}`} />
                  <span className="text-gray-400">Tipo: {selectedTypeInfo.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {message.trim() && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Preview da Notificação
              </h3>
              <div className={`p-3 rounded-lg border ${
                type === 'info' ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' :
                type === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                'bg-green-900/20 border-green-500/30 text-green-400'
              }`}>
                <div className="flex items-start gap-2">
                  {selectedTypeInfo && <selectedTypeInfo.icon className="w-4 h-4 mt-0.5" />}
                  <p className="text-sm">{message}</p>
                </div>
              </div>
            </div>
          )}

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
              disabled={loading || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {loading ? 'Enviando...' : 'Enviar Notificação'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
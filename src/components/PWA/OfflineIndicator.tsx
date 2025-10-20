import React from 'react'
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react'
import { usePWA } from '../../hooks/usePWA'

export function OfflineIndicator() {
  const { isOnline } = usePWA()
  const [showOfflineMessage, setShowOfflineMessage] = React.useState(false)

  React.useEffect(() => {
    if (!isOnline) {
      setShowOfflineMessage(true)
    } else {
      const timer = window.setTimeout(() => {
        setShowOfflineMessage(false)
      }, 3000)
      return () => window.clearTimeout(timer)
    }
  }, [isOnline])

  if (!showOfflineMessage) return null

  return (
    <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-lg border transition-all duration-300 ${
      isOnline 
        ? 'bg-green-900/20 border-green-500/30 text-green-400'
        : 'bg-red-900/20 border-red-500/30 text-red-400'
    }`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-current/20 rounded-lg">
          {isOnline ? (
            <Wifi className="w-5 h-5" />
          ) : (
            <WifiOff className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium">
            {isOnline ? 'Conexão Restaurada' : 'Sem Conexão'}
          </h3>
          <p className="text-sm opacity-90">
            {isOnline 
              ? 'Você está online novamente. Dados sincronizados.'
              : 'Modo offline ativo. Algumas funcionalidades podem estar limitadas.'
            }
          </p>
        </div>
        {!isOnline && (
          <AlertTriangle className="w-5 h-5" />
        )}
      </div>
    </div>
  )
}